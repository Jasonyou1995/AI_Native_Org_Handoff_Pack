#!/usr/bin/env python3
# Copyright 2026 Jason You
# SPDX-License-Identifier: Apache-2.0
# See LICENSE and LICENSE-SCOPE.md.
"""Standard-library client using only synthetic input and explicit cloud review."""

import argparse
import json
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise RuntimeError("Gateway redirects are not allowed")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--with-file", action="store_true",
                        help="Include an inline synthetic text attachment")
    parser.add_argument("--review-cloud", action="store_true",
                        help="Review a public synthetic request; requires interactive SEND")
    args = parser.parse_args()
    base = os.environ.get("GATEWAY_URL", "http://127.0.0.1:3000").rstrip("/")
    address = urlsplit(base)
    if (address.scheme not in ("http", "https")
            or address.hostname not in ("127.0.0.1", "localhost", "::1")
            or address.username or address.password or address.query
            or address.fragment or address.path):
        raise RuntimeError("GATEWAY_URL must be a loopback HTTP(S) origin")
    token = os.environ.get("GATEWAY_TOKEN", "")
    if not token:
        raise RuntimeError("Set GATEWAY_TOKEN in the environment")
    if args.review_cloud and not sys.stdin.isatty():
        raise RuntimeError("Cloud review requires an interactive terminal")
    opener = build_opener(ProxyHandler({}), NoRedirect())

    def call(path, body):
        request = Request(base + path, data=json.dumps(body).encode("utf-8"),
                          headers={"Content-Type": "application/json",
                                   "Authorization": "Bearer " + token}, method="POST")
        try:
            with opener.open(request, timeout=30) as response:
                raw = response.read(262145)
                if len(raw) > 262144:
                    raise RuntimeError("Gateway response exceeded the client limit")
                result = json.loads(raw)
                if not isinstance(result, dict):
                    raise RuntimeError("Unexpected gateway response")
                return result
        except HTTPError as error:
            raise RuntimeError("Gateway rejected request (HTTP %s); inspect again before retrying"
                               % error.code) from None
        except (URLError, TimeoutError, json.JSONDecodeError):
            raise RuntimeError("Gateway unavailable or response invalid; no automatic retry") from None

    payload = {"prompt": "Summarize this synthetic note: alice@example.test has a demo task.",
               "classification": "public" if args.review_cloud else "unknown",
               "mode": "hybrid" if args.review_cloud else "local_only",
               "files": [{"name": "synthetic.txt", "content": "A fictional demo task is due tomorrow."}]
                        if args.with_file else []}
    inspected = call("/api/inspect", payload)
    print("Route:", inspected.get("route"))
    print("Reasons:", json.dumps(inspected.get("reasons"), ensure_ascii=False))
    if args.review_cloud:
        if inspected.get("route") != "approval_required":
            print("Cloud is not eligible. Nothing sent to cloud; no fallback executed.")
            return
        outbound = inspected.get("outboundPayload")
        destination = inspected.get("destination")
        if not isinstance(outbound, dict) or not isinstance(destination, dict):
            raise RuntimeError("Missing outbound preview or destination; refusing approval")
        print("Destination:", json.dumps(destination, ensure_ascii=False, indent=2))
        print("Full outbound body:", json.dumps(outbound, ensure_ascii=False, indent=2))
        print("Redaction is not anonymity. Review all content and confirm authorization.")
        if input("Type SEND to approve this exact request, or anything else to cancel: ") != "SEND":
            print("Canceled. Nothing sent to cloud.")
            return
        approved = call("/api/approve", {"requestId": inspected["requestId"],
                                         "payloadHash": inspected["payloadHash"]})
        result = call("/api/cloud", {"receipt": approved["receipt"]})
    else:
        result = call("/api/local", {"requestId": inspected["requestId"]})
    print("Provider:", result.get("provider"))
    print("Output:", result.get("output"))


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, KeyError, ValueError, EOFError, KeyboardInterrupt) as error:
        message = str(error) if isinstance(error, RuntimeError) else "Canceled or invalid response"
        print("Client stopped: " + message, file=sys.stderr)
        sys.exit(1)
