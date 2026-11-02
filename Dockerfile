# Copyright 2026 Jason You
# SPDX-License-Identifier: LicenseRef-Handoff-Community-1.0
# See LICENSES/Handoff-Community-1.0.txt and LICENSE-SCOPE.md.

FROM rust:1.99.1-slim-bookworm AS rust-build
WORKDIR /app/rust-core
COPY LICENSES /app/LICENSES
COPY rust-core/Cargo.toml rust-core/Cargo.lock ./
COPY rust-core/src ./src
RUN cargo build --release --locked
FROM node:24.22.2-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build
RUN npm prune --omit=dev
FROM node:24.22.2-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/package*.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/demo ./demo
COPY --from=rust-build --chown=node:node /app/rust-core/target/release/privacy-scanner ./rust-core/target/release/privacy-scanner
COPY --from=build --chown=node:node /app/LICENSE /app/NOTICE /app/LICENSE-SCOPE.md /app/LICENSING.md /app/THIRD_PARTY_NOTICES.md ./
COPY --from=build --chown=node:node /app/LICENSES ./LICENSES
USER node
EXPOSE 3000
CMD ["npm","start"]
