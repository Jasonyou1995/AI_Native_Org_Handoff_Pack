// Copyright 2026 Jason You
// SPDX-License-Identifier: LicenseRef-Handoff-Community-1.0
// See LICENSES/Handoff-Community-1.0.txt and LICENSE-SCOPE.md.

use regex::Regex;
use serde::{Deserialize, Serialize};

pub const MAX_TEXT: usize = 65_536;
pub const MAX_SPANS: usize = 4096;
pub const MAX_REQUEST: u64 = 524_288;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub text: String,
    pub terms: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Span {
    pub start: usize,
    pub end: usize,
    pub kind: &'static str,
}

#[derive(Debug, Serialize)]
pub struct Response {
    pub version: u8,
    pub offsets: &'static str,
    pub spans: Vec<Span>,
    pub blocked: bool,
}

// Match bodies are bounded; whitespace runs after fixed secret labels are disjoint.
// The private-key marker uses a single linear search, never a suffix iteration.
const PATTERNS: &[(&str, &str)] = &[
    (
        "secret",
        r"(?i)(?:(?-u:\b)(?:sk|ghp|github_pat|AKIA)[-_A-Za-z0-9]{12,256}|(?-u:\b)(?:password|passwd|api[_ -]?key|secret|token)\s*[:=]\s*[^\s,;]{1,1024})",
    ),
    (
        "email",
        r"(?i)[A-Z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Z0-9](?:[A-Z0-9.-]{0,252}[A-Z0-9])?\.[A-Z]{2,63}",
    ),
    (
        "identifier",
        r"(?i)(?-u:\b)[0-9]{17}[0-9X](?-u:\b)|(?-u:\b)[0-9]{3}-[0-9]{2}-[0-9]{4}(?-u:\b)",
    ),
    ("phone", r"\+?[0-9][0-9 ()-]{6,126}[0-9]"),
];

pub fn scan(request: Request) -> Result<Response, &'static str> {
    if request.text.len() > MAX_TEXT || request.terms.len() > 100 {
        return Err("INPUT_LIMIT");
    }
    if request
        .terms
        .iter()
        .any(|t| t.is_empty() || t.chars().count() > 100 || t.len() > 400)
    {
        return Err("TERM_LIMIT");
    }
    let text = &request.text;
    let mut spans = Vec::new();
    let mut blocked = text.contains("[[PG_");
    let mut add = |kind, start, end| {
        if spans.len() >= MAX_SPANS {
            return Err("SPAN_LIMIT");
        }
        spans.push(Span { start, end, kind });
        Ok(())
    };
    // Any private-key opening marker blocks and masks the entire remaining suffix.
    // This intentionally errs toward local-only for truncated/malformed key blocks.
    let key = Regex::new(r"(?i)-----BEGIN [A-Z ]*PRIVATE KEY-----").map_err(|_| "ENGINE_ERROR")?;
    if let Some(m) = key.find(text) {
        blocked = true;
        add("secret", m.start(), text.len())?;
    }
    for &(kind, pattern) in PATTERNS {
        let regex = Regex::new(pattern).map_err(|_| "ENGINE_ERROR")?;
        for m in regex.find_iter(text) {
            if kind == "secret" {
                blocked = true;
            }
            add(kind, m.start(), m.end())?;
        }
    }
    for term in &request.terms {
        let regex =
            Regex::new(&format!("(?i){}", regex::escape(term))).map_err(|_| "ENGINE_ERROR")?;
        for m in regex.find_iter(text) {
            add("organization", m.start(), m.end())?;
        }
    }
    spans.sort_by(|a, b| a.start.cmp(&b.start).then(b.end.cmp(&a.end)));
    let mut merged: Vec<Span> = Vec::new();
    for span in spans {
        if let Some(previous) = merged.last_mut() {
            if span.start < previous.end {
                previous.end = previous.end.max(span.end);
                if span.kind == "secret" {
                    previous.kind = "secret";
                }
                continue;
            }
        }
        merged.push(span);
    }
    // Convert only valid UTF-8 boundaries once, not a prefix scan per finding.
    let mut utf16 = vec![0; text.len() + 1];
    let mut units = 0;
    for (offset, ch) in text.char_indices() {
        utf16[offset] = units;
        units += ch.len_utf16();
    }
    utf16[text.len()] = units;
    for span in &mut merged {
        span.start = utf16[span.start];
        span.end = utf16[span.end];
    }
    Ok(Response {
        version: 1,
        offsets: "utf16",
        spans: merged,
        blocked,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    fn inspect(text: &str, terms: &[&str]) -> Result<Response, &'static str> {
        scan(Request {
            text: text.into(),
            terms: terms.iter().map(|s| (*s).into()).collect(),
        })
    }
    #[test]
    fn detects_synthetic_categories() {
        let r = inspect(
            "alice@example.invalid 123-45-6789 +1 (212) 555-0100 Acme password=synthetic",
            &["Acme"],
        )
        .unwrap();
        assert!(r.blocked);
        for kind in ["email", "identifier", "phone", "organization", "secret"] {
            assert!(r.spans.iter().any(|s| s.kind == kind), "{kind}");
        }
    }
    #[test]
    fn utf16_and_overlap() {
        let r = inspect(
            "😀客户甲公司邮箱 a@example.invalid",
            &["客户甲", "甲公司", "😀客户"],
        )
        .unwrap();
        assert_eq!(
            r.spans[0],
            Span {
                start: 0,
                end: 7,
                kind: "organization"
            }
        );
        assert_eq!(r.spans[1].start, 10);
    }
    #[test]
    fn terms_are_literal_case_insensitive() {
        let r = inspect("a+b A+B", &["a+b"]).unwrap();
        assert_eq!(r.spans.len(), 2);
    }
    #[test]
    fn limits_fail_closed() {
        assert!(inspect(&"a".repeat(MAX_TEXT + 1), &[]).is_err());
        assert!(inspect("a", &[""]).is_err());
        assert!(inspect(&"a ".repeat(4097), &["a"]).is_err());
        assert!(inspect("x", &vec!["x"; 101]).is_err());
    }
    #[test]
    fn reserved_and_private_key_block() {
        assert!(inspect("[[PG_forged", &[]).unwrap().blocked);
        let r = inspect("-----BEGIN PRIVATE KEY-----\nsynthetic", &[]).unwrap();
        assert!(r.blocked);
        assert_eq!(r.spans.len(), 1);
    }
    #[test]
    fn secret_boundaries_match_ascii_reference_in_cjk() {
        for text in [
            "示例password=synthetic-value",
            "用户api_key=synthetic-value",
            "说明sk-syntheticprivatevalue1234",
        ] {
            assert!(inspect(text, &[]).unwrap().blocked);
        }
        assert!(inspect("password                                                                 =synthetic", &[]).unwrap().blocked);
        assert!(
            inspect("-----begin private key-----\nsynthetic", &[])
                .unwrap()
                .blocked
        );
        let r = inspect("😀用户api_key=synthetic", &[]).unwrap();
        assert_eq!(r.spans[0].start, 4);
    }
    #[test]
    fn no_raw_content_in_output() {
        let r = inspect("private@example.invalid", &[]).unwrap();
        assert!(!serde_json::to_string(&r).unwrap().contains("private"));
    }
}
