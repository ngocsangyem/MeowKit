//! Supervisors in threads against a temporary host directory: admission never
//! exceeds K, a shrinking K stops new admissions, exit codes pass through,
//! cancel stops the job, and a vanished supervisor reads as `lost`.
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use super::jobs::{JobDir, JobState, Meta, new_id};
use super::model::Verdict;
use super::paths::HostPaths;
use super::slots::Slots;
use super::supervisor::{CANCELLED_EXIT, Options, run};
use super::time_now_ms;

fn argv(parts: &[&str]) -> Vec<String> {
    parts.iter().map(|s| (*s).to_string()).collect()
}

#[cfg(unix)]
fn sleep_argv(secs: u32) -> Vec<String> {
    argv(&["sleep", &secs.to_string()])
}
#[cfg(windows)]
fn sleep_argv(secs: u32) -> Vec<String> {
    argv(&["ping", "-n", &(secs + 1).to_string(), "127.0.0.1"])
}
#[cfg(unix)]
fn exit_argv(code: i32) -> Vec<String> {
    argv(&["sh", "-c", &format!("echo out; exit {code}")])
}
#[cfg(windows)]
fn exit_argv(code: i32) -> Vec<String> {
    argv(&["cmd", "/C", &format!("echo out& exit {code}")])
}

fn new_job(paths: &HostPaths, n: usize) -> JobDir {
    let job = JobDir::new(paths, &format!("{}-{n}", new_id(time_now_ms())));
    super::paths::create_private_dir(&job.dir).unwrap();
    job.write_meta(&Meta {
        id: job.id.clone(),
        cmd_hash: format!("h{n}"),
        exe_base: "sleep".into(),
        enqueued_at_ms: time_now_ms(),
        ..Meta::default()
    })
    .unwrap();
    job
}

fn fast() -> Options {
    Options {
        poll: Duration::from_millis(20),
        ..Options::default()
    }
}

/// Run `n` supervisors at once; return the held-slot samples over time.
fn contend(
    paths: &HostPaths,
    n: usize,
    cmd: Vec<String>,
    k: Arc<dyn Fn() -> (usize, Verdict) + Send + Sync>,
) -> Vec<(Duration, usize)> {
    let done = Arc::new(AtomicUsize::new(0));
    let samples = Arc::new(Mutex::new(Vec::new()));
    let started = Instant::now();
    let monitor = {
        let (paths, done, samples) = (paths.clone(), done.clone(), samples.clone());
        std::thread::spawn(move || {
            let slots = Slots::new(&paths.dir("slots"));
            while done.load(Ordering::SeqCst) < n {
                samples
                    .lock()
                    .unwrap()
                    .push((started.elapsed(), slots.held()));
                std::thread::sleep(Duration::from_millis(15));
            }
        })
    };
    let workers: Vec<_> = (0..n)
        .map(|i| {
            let (paths, cmd, k, done) = (paths.clone(), cmd.clone(), k.clone(), done.clone());
            std::thread::spawn(move || {
                let job = new_job(&paths, i);
                let code = run(&paths, &job, &cmd, &fast(), &*k);
                done.fetch_add(1, Ordering::SeqCst);
                (code, job.state())
            })
        })
        .collect();
    for w in workers {
        assert_eq!(w.join().unwrap(), (0, JobState::Done(0)));
    }
    monitor.join().unwrap();
    Arc::try_unwrap(samples).unwrap().into_inner().unwrap()
}

#[test]
fn eight_supervisors_with_k_two_never_run_more_than_two() {
    let home = tempfile::tempdir().unwrap();
    let paths = HostPaths::under_home(home.path());
    let samples = contend(&paths, 8, sleep_argv(1), Arc::new(|| (2, Verdict::Go)));
    let peak = samples.iter().map(|s| s.1).max().unwrap();
    assert!(peak <= 2, "peak {peak}");
    assert_eq!(peak, 2, "two should run together at some point");
}

#[test]
fn shrinking_k_from_four_to_one_stops_new_admissions_until_one_is_left() {
    let home = tempfile::tempdir().unwrap();
    let paths = HostPaths::under_home(home.path());
    // Let the 30 s hysteresis window lapse almost at once.
    super::paths::create_private_dir(&paths.dir("slots")).unwrap();
    let seeded = format!("{{\"k\":4,\"changed_at_ms\":{}}}", time_now_ms() - 29_900);
    std::fs::write(paths.dir("slots").join("k.json"), seeded).unwrap();
    let shrunk = Arc::new(AtomicBool::new(false));
    let flag = shrunk.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(300));
        flag.store(true, Ordering::SeqCst);
    });
    let k = move || {
        (
            if shrunk.load(Ordering::SeqCst) { 1 } else { 4 },
            Verdict::Go,
        )
    };
    let samples = contend(&paths, 6, sleep_argv(1), Arc::new(k));
    assert!(samples.iter().map(|s| s.1).max().unwrap() <= 4);
    // The first wave ends by about 1.3 s; from then on at most one runs.
    let late = samples
        .iter()
        .filter(|s| s.0 > Duration::from_millis(1_800))
        .map(|s| s.1)
        .max();
    assert!(late.unwrap_or(0) <= 1, "late peak {late:?}");
}

#[test]
fn the_exit_code_passes_through_and_output_is_logged() {
    let home = tempfile::tempdir().unwrap();
    let paths = HostPaths::under_home(home.path());
    let job = new_job(&paths, 0);
    assert_eq!(
        run(&paths, &job, &exit_argv(3), &fast(), &|| (1, Verdict::Go)),
        3
    );
    assert_eq!(job.state(), JobState::Done(3));
    assert!(std::fs::read_to_string(job.log()).unwrap().contains("out"));
    assert!(job.read_meta().unwrap().child_pid.is_some());
}

#[test]
fn cancel_stops_a_queued_job_and_a_running_one() {
    let home = tempfile::tempdir().unwrap();
    let paths = HostPaths::under_home(home.path());
    let queued = new_job(&paths, 0);
    std::fs::write(queued.cancel(), "1").unwrap();
    assert_eq!(
        run(&paths, &queued, &sleep_argv(5), &fast(), &|| (
            0,
            Verdict::Hold
        )),
        CANCELLED_EXIT
    );
    assert_eq!(queued.state(), JobState::Cancelled);

    let running = new_job(&paths, 1);
    let cancel = running.cancel();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(400));
        std::fs::write(cancel, "1").unwrap();
    });
    let started = Instant::now();
    assert_eq!(
        run(&paths, &running, &sleep_argv(30), &fast(), &|| (
            1,
            Verdict::Go
        )),
        CANCELLED_EXIT
    );
    assert!(started.elapsed() < Duration::from_secs(10));
    assert_eq!(running.state(), JobState::Cancelled);
    assert_eq!(super::stats::read(&paths).get("cancelled"), Some(&2));
}

#[test]
fn a_job_without_its_supervisor_is_lost_and_frees_its_slot() {
    let home = tempfile::tempdir().unwrap();
    let paths = HostPaths::under_home(home.path());
    let job = new_job(&paths, 0);
    let slots = Slots::new(&paths.dir("slots"));
    {
        let _alive = super::locks::try_hold(&job.alive()).unwrap().unwrap();
        let _slot = slots.try_admit(1, time_now_ms()).unwrap().unwrap();
        std::fs::write(job.admitted(), "1").unwrap();
        assert_eq!(job.state(), JobState::Running);
        assert_eq!(slots.held(), 1);
    } // the supervisor dies: the OS drops both locks
    assert!(super::locks::eventually(|| job.state() == JobState::Lost));
    assert!(super::locks::eventually(|| slots.held() == 0));
}
