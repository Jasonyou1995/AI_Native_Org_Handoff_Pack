// Copyright 2026 Jason You
// SPDX-License-Identifier: LicenseRef-Handoff-Community-1.0
// See LICENSES/Handoff-Community-1.0.txt and LICENSE-SCOPE.md.

use privacy_scanner::{scan, Request, MAX_REQUEST};
use std::io::{self, Read};

fn run() -> Result<(), &'static str> {
    let mut bytes = Vec::new();
    io::stdin()
        .take(MAX_REQUEST + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "READ_ERROR")?;
    if bytes.len() as u64 > MAX_REQUEST {
        return Err("INPUT_LIMIT");
    }
    let request: Request = serde_json::from_slice(&bytes).map_err(|_| "INVALID_INPUT")?;
    let result = scan(request)?;
    serde_json::to_writer(io::stdout().lock(), &result).map_err(|_| "WRITE_ERROR")?;
    Ok(())
}

fn main() {
    if let Err(code) = run() {
        // Never print deserializer details or request content.
        eprintln!("{code}");
        std::process::exit(1);
    }
}
