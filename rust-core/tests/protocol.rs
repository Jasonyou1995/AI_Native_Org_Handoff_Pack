// Copyright 2026 Jason You
// SPDX-License-Identifier: LicenseRef-Handoff-Community-1.0
// See LICENSES/Handoff-Community-1.0.txt and LICENSE-SCOPE.md.

use std::io::Write;
use std::process::{Command, Stdio};

fn invoke(input: &[u8]) -> std::process::Output {
    let mut child = Command::new(env!("CARGO_BIN_EXE_privacy-scanner"))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    child.stdin.take().unwrap().write_all(input).unwrap();
    child.wait_with_output().unwrap()
}
#[test]
fn protocol_returns_only_metadata() {
    let out = invoke(br#"{"text":"alice@example.invalid","terms":[]}"#);
    assert!(out.status.success());
    assert!(out.stderr.is_empty());
    let json: serde_json::Value = serde_json::from_slice(&out.stdout).unwrap();
    assert_eq!(json["version"], 1);
    assert_eq!(json["offsets"], "utf16");
    assert_eq!(json["spans"][0]["kind"], "email");
    assert!(!String::from_utf8(out.stdout).unwrap().contains("alice"));
}
#[test]
fn malformed_and_unknown_fields_are_sanitized() {
    for input in [
        r#"{"text":"sensitive synthetic content","terms":[],"extra":true}"#,
        r#"{"text":"sensitive synthetic content","terms":[],"#,
        r#"{"text":"\ud800","terms":[]}"#,
    ] {
        let out = invoke(input.as_bytes());
        assert!(!out.status.success());
        assert!(out.stdout.is_empty());
        assert_eq!(out.stderr, b"INVALID_INPUT\n");
    }
}
#[test]
fn input_and_match_capacity_fail_without_partial_results() {
    for text in ["x".repeat(65537), "a ".repeat(4097)] {
        let input = serde_json::json!({"text":text,"terms":["a"]}).to_string();
        let out = invoke(input.as_bytes());
        assert!(!out.status.success());
        assert!(out.stdout.is_empty());
        assert!(out.stderr == b"INPUT_LIMIT\n" || out.stderr == b"SPAN_LIMIT\n");
    }
}
