# Copyright 2026 Jason You
# SPDX-License-Identifier: LicenseRef-Handoff-Community-1.0
# See LICENSES/Handoff-Community-1.0.txt and LICENSE-SCOPE.md.

.PHONY: install build test attacks verify check run docker bench rust-build rust-test
IMAGE = node:24.22.2-bookworm-slim
RUST_IMAGE = rust:1.99.1-slim-bookworm
RUST_RUN = docker run --rm -e CARGO_TARGET_DIR=/app/rust-core/target-docker -v "$(CURDIR):/app" -w /app $(RUST_IMAGE)
RUN = docker run --rm -e PRIVACY_SCANNER_BIN=/app/rust-core/target-docker/release/privacy-scanner -v "$(CURDIR):/app" -w /app $(IMAGE)
install:
	$(RUN) npm ci --ignore-scripts
build: rust-build
	$(RUN) npm run build
test: rust-build
	$(RUN) npm test
attacks: rust-build
	$(RUN) npm run attacks
verify: rust-build
	$(RUN) npm run verify
check:
	$(RUN) npm run typecheck
	$(RUN) npm run lint
run: docker
docker:
	docker compose up --build
bench: rust-build
	$(RUN) npm run bench

rust-build:
	$(RUST_RUN) cargo build --manifest-path rust-core/Cargo.toml --release --locked
rust-test: rust-build
	$(RUST_RUN) cargo test --manifest-path rust-core/Cargo.toml --locked
