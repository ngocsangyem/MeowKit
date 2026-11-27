//! Queue order, crash-safe numbering and slot admission under contention.
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Barrier};
use std::time::Duration;

use super::model::Verdict;
use super::queue::{AGING_MS, Priority, Queue, Ticket};
use super::slots::{K_HYSTERESIS_MS, Slots, k_for};

fn ticket(priority: Priority, at: i64) -> Ticket {
    Ticket {
        seq: 0,
        priority,
        enqueued_at_ms: at,
        pid: 1,
        job_id: "j".into(),
        worktree: "/w".into(),
        exe_base: "cargo".into(),
        cmd_class: Some("test".into()),
        cmd_hash: "h".into(),
    }
}

#[test]
fn order_is_priority_then_seq_and_waiting_ages_a_ticket_up() {
    let dir = tempfile::tempdir().unwrap();
    let q = Queue::new(dir.path());
    let low = q.enqueue(ticket(Priority::Low, 0)).unwrap();
    let normal = q.enqueue(ticket(Priority::Normal, 2 * AGING_MS)).unwrap();
    let high = q.enqueue(ticket(Priority::High, 2 * AGING_MS)).unwrap();
    let seqs = |now| q.ordered(now).iter().map(|t| t.seq).collect::<Vec<_>>();
    assert_eq!(
        seqs(0),
        vec![high.ticket.seq, normal.ticket.seq, low.ticket.seq]
    );
    // After 20 min of waiting the low ticket reaches level 2 and, being older,
    // goes ahead of the fresh high one.
    assert_eq!(
        seqs(2 * AGING_MS),
        vec![low.ticket.seq, high.ticket.seq, normal.ticket.seq]
    );
    assert_eq!(q.position(normal.ticket.seq, 0), Some(1));
}

#[test]
fn a_dead_ticket_is_swept_and_its_number_is_never_reused_while_live() {
    let dir = tempfile::tempdir().unwrap();
    let q = Queue::new(dir.path());
    let a = q.enqueue(ticket(Priority::Normal, 0)).unwrap();
    let b = q.enqueue(ticket(Priority::Normal, 0)).unwrap();
    // A crash between the ticket write and the counter write: counter lags.
    std::fs::write(dir.path().join("seq"), "0").unwrap();
    let c = q.enqueue(ticket(Priority::Normal, 0)).unwrap();
    assert!(c.ticket.seq > b.ticket.seq);
    drop(a); // supervisor died: lock released, json left behind
    assert!(super::locks::eventually(|| q.live().len() == 2));
    assert!(!dir.path().join(format!("{:012}.json", 1)).exists());
    b.leave();
    assert!(super::locks::eventually(|| q.live().len() == 1));
}

#[test]
fn k_follows_the_verdict() {
    assert_eq!(k_for(Verdict::Go, 3), 3);
    assert_eq!(k_for(Verdict::Go, 99), 8);
    assert_eq!(k_for(Verdict::Throttle, 4), 1);
    assert_eq!(k_for(Verdict::Unknown, 4), 1);
    assert_eq!(k_for(Verdict::Hold, 4), 0);
    assert_eq!(k_for(Verdict::Clean, 4), 0);
}

#[test]
fn eight_contenders_never_exceed_k_two() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().to_path_buf();
    let running = Arc::new(AtomicUsize::new(0));
    let peak = Arc::new(AtomicUsize::new(0));
    let done = Arc::new(AtomicUsize::new(0));
    let start = Arc::new(Barrier::new(8));
    let handles: Vec<_> = (0..8)
        .map(|_| {
            let (path, running, peak, done, start) = (
                path.clone(),
                running.clone(),
                peak.clone(),
                done.clone(),
                start.clone(),
            );
            std::thread::spawn(move || {
                let slots = Slots::new(&path);
                start.wait();
                loop {
                    if let Some(guard) = slots.try_admit(2, 0).unwrap() {
                        let now = running.fetch_add(1, Ordering::SeqCst) + 1;
                        peak.fetch_max(now, Ordering::SeqCst);
                        std::thread::sleep(Duration::from_millis(30));
                        running.fetch_sub(1, Ordering::SeqCst);
                        drop(guard);
                        done.fetch_add(1, Ordering::SeqCst);
                        return;
                    }
                    std::thread::sleep(Duration::from_millis(5));
                }
            })
        })
        .collect();
    for h in handles {
        h.join().unwrap();
    }
    assert_eq!(done.load(Ordering::SeqCst), 8);
    assert!(
        peak.load(Ordering::SeqCst) <= 2,
        "peak {}",
        peak.load(Ordering::SeqCst)
    );
}

#[test]
fn shrinking_k_keeps_running_slots_and_blocks_new_ones_after_hysteresis() {
    let dir = tempfile::tempdir().unwrap();
    let slots = Slots::new(dir.path());
    let mut held: Vec<_> = (0..4)
        .map(|_| slots.try_admit(4, 0).unwrap().unwrap())
        .collect();
    assert_eq!(slots.held(), 4);
    // K wants 1 but the 30 s hysteresis keeps 4 for now: still full.
    assert!(slots.try_admit(1, 1_000).unwrap().is_none());
    held.pop();
    // Within hysteresis K stays 4, so the freed slot can be reused.
    let again = std::cell::RefCell::new(None);
    assert!(super::locks::eventually(|| {
        *again.borrow_mut() = slots.try_admit(1, 2_000).unwrap();
        again.borrow().is_some()
    }));
    drop(again);
    // After hysteresis K = 1 while 3 run: nobody new.
    assert!(slots.try_admit(1, K_HYSTERESIS_MS + 1).unwrap().is_none());
}
