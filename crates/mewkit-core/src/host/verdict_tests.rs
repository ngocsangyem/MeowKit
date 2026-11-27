use super::model::{Cpu, Disk, MachineSample, MemPressure, Memory, Os, Psi, Space, Verdict};
use super::verdict::evaluate;

fn calm(os: Os) -> MachineSample {
    MachineSample {
        os,
        cpu: Some(Cpu {
            busy_pct: Some(20.0),
            cores: 8,
            psi: None,
        }),
        memory: Some(Memory {
            used_pct: Some(40.0),
            pressure: None,
            psi: None,
        }),
        disk: Some(Disk {
            device: "disk0".into(),
            busy_pct: Some(5.0),
            latency_ms: Some(0.3),
            psi: None,
            scope: "host".into(),
        }),
        space: vec![Space {
            path: "/".into(),
            free_gb: 99.0,
            total_gb: 460.0,
            low: false,
        }],
        thermal: Some(0),
    }
}

fn codes(sample: &MachineSample) -> (Verdict, Vec<String>) {
    let (v, reasons) = evaluate(sample);
    (v, reasons.into_iter().map(|r| r.code).collect())
}

#[test]
fn a_calm_machine_is_go_with_no_reasons() {
    assert_eq!(codes(&calm(Os::Macos)), (Verdict::Go, vec![]));
    assert_eq!(codes(&calm(Os::Windows)).0, Verdict::Go);
}

#[test]
fn cpu_thresholds_throttle_then_hold() {
    for (busy, want) in [(84.9, Verdict::Go), (85.0, Verdict::Throttle), (95.0, Verdict::Hold)] {
        let mut s = calm(Os::Windows);
        s.cpu.as_mut().unwrap().busy_pct = Some(busy);
        assert_eq!(evaluate(&s).0, want, "busy {busy}");
    }
}

#[test]
fn macos_disk_uses_device_time_limits_not_percent_of_one() {
    let mut s = calm(Os::Macos);
    s.disk.as_mut().unwrap().busy_pct = Some(150.0);
    assert_eq!(evaluate(&s).0, Verdict::Go, "150 % device time is ordinary on NVMe");
    s.disk.as_mut().unwrap().busy_pct = Some(1632.0);
    assert_eq!(evaluate(&s).0, Verdict::Hold);
    let mut s = calm(Os::Windows);
    s.disk.as_mut().unwrap().busy_pct = Some(92.0);
    assert_eq!(evaluate(&s).0, Verdict::Hold);
}

#[test]
fn latency_alone_can_throttle() {
    let mut s = calm(Os::Macos);
    s.disk.as_mut().unwrap().latency_ms = Some(6.0);
    assert_eq!(codes(&s), (Verdict::Throttle, vec!["disk".into()]));
}

#[test]
fn each_missing_metric_is_unknown_never_go() {
    for drop in ["cpu", "memory", "disk"] {
        let mut s = calm(Os::Macos);
        match drop {
            "cpu" => s.cpu = None,
            "memory" => s.memory = None,
            _ => s.disk = None,
        }
        let (v, c) = codes(&s);
        assert_eq!(v, Verdict::Unknown, "{drop}");
        assert_eq!(c, vec![format!("{drop}_unavailable")]);
    }
    let mut s = calm(Os::Windows);
    let d = s.disk.as_mut().unwrap();
    d.busy_pct = None;
    d.latency_ms = None;
    assert_eq!(evaluate(&s).0, Verdict::Unknown);
}

#[test]
fn rank_is_hold_over_clean_over_unknown_over_throttle() {
    let mut s = calm(Os::Macos);
    s.cpu.as_mut().unwrap().busy_pct = Some(90.0);
    s.memory = None;
    assert_eq!(evaluate(&s).0, Verdict::Unknown);
    s.space[0].free_gb = 10.0;
    assert_eq!(evaluate(&s).0, Verdict::Clean);
    s.thermal = Some(2);
    assert_eq!(evaluate(&s).0, Verdict::Hold);
}

#[test]
fn macos_memory_judges_pressure_not_used_percent() {
    let mut s = calm(Os::Macos);
    let m = s.memory.as_mut().unwrap();
    m.used_pct = Some(97.0);
    m.pressure = Some(MemPressure::Normal);
    assert_eq!(evaluate(&s).0, Verdict::Go);
    s.memory.as_mut().unwrap().pressure = Some(MemPressure::Warn);
    assert_eq!(evaluate(&s).0, Verdict::Throttle);
    s.memory.as_mut().unwrap().pressure = Some(MemPressure::Critical);
    assert_eq!(evaluate(&s).0, Verdict::Hold);
}

#[test]
fn thermal_moderate_throttles_and_heavy_holds() {
    let mut s = calm(Os::Macos);
    s.thermal = Some(1);
    assert_eq!(evaluate(&s).0, Verdict::Throttle);
    s.thermal = Some(4);
    assert_eq!(evaluate(&s).0, Verdict::Hold);
}

#[test]
fn linux_judges_io_stall_and_ignores_util() {
    let mut s = calm(Os::Linux);
    let d = s.disk.as_mut().unwrap();
    d.busy_pct = Some(100.0);
    d.psi = Some(Psi {
        some_avg10: 3.0,
        full_avg10: Some(2.0),
    });
    assert_eq!(evaluate(&s).0, Verdict::Go, "saturated %util alone is not pressure");
    s.disk.as_mut().unwrap().psi = Some(Psi {
        some_avg10: 40.0,
        full_avg10: Some(31.0),
    });
    assert_eq!(evaluate(&s).0, Verdict::Hold);
    s.disk.as_mut().unwrap().psi = None;
    assert_eq!(evaluate(&s).0, Verdict::Unknown);
}

#[test]
fn linux_cpu_and_memory_stall_count() {
    let mut s = calm(Os::Linux);
    s.disk.as_mut().unwrap().psi = Some(Psi {
        some_avg10: 0.0,
        full_avg10: Some(0.0),
    });
    s.cpu.as_mut().unwrap().psi = Some(Psi {
        some_avg10: 60.0,
        full_avg10: None,
    });
    assert_eq!(evaluate(&s).0, Verdict::Throttle);
    s.memory.as_mut().unwrap().psi = Some(Psi {
        some_avg10: 30.0,
        full_avg10: Some(25.0),
    });
    assert_eq!(evaluate(&s).0, Verdict::Hold);
}
