//! The one live Windows read: the `_Total` row of the raw physical-disk perf
//! class through WMI. The `wmi` crate's query API is safe Rust; the COM calls
//! stay inside the dependency. The first query on a boot builds the class and
//! took 1.3–2.0 s on a CI runner; later ones about 7 ms.
use std::collections::{BTreeMap, HashMap};

use wmi::{Variant, WMIConnection};

use super::windows_parse::FIELDS;

const QUERY: &str = "SELECT Name, PercentIdleTime, PercentIdleTime_Base, AvgDisksecPerTransfer, \
     AvgDisksecPerTransfer_Base, Frequency_PerfTime FROM Win32_PerfRawData_PerfDisk_PhysicalDisk \
     WHERE Name = '_Total'";

fn number(v: &Variant) -> Option<f64> {
    match v {
        Variant::UI8(n) => Some(*n as f64),
        Variant::UI4(n) => Some(f64::from(*n)),
        Variant::I8(n) => Some(*n as f64),
        Variant::I4(n) => Some(f64::from(*n)),
        // WMI hands some uint64 properties over as decimal strings.
        Variant::String(s) => s.parse().ok(),
        _ => None,
    }
}

/// Raw counters keyed by the short names `windows_parse` reads, or `None`
/// when WMI is unavailable (the verdict then says disk unavailable).
pub fn read_raw_disk() -> Option<BTreeMap<String, f64>> {
    let con = WMIConnection::new().ok()?;
    let rows: Vec<HashMap<String, Variant>> = con.raw_query(QUERY).ok()?;
    let row = rows.into_iter().next()?;
    FIELDS
        .iter()
        .map(|(property, short)| Some(((*short).to_string(), number(row.get(*property)?)?)))
        .collect()
}
