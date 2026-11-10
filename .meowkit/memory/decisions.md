## Kit and binary integrity use SHA-256 only; the Ed25519 signing path stays dormant  <!-- 2026-11-10 -->
Why: owner declined signing keys for an open-source project at plan approval; a checksum from the artifact's own origin proves download integrity, not authorship, and that trade-off was accepted explicitly.
Apply when: touching kit download, self-update, release assets, or the unused signing/keyring code under packages/mewkit/src/kit/ — do not wire signing without asking.
Source: docs/architecture/adr/261110-rust-adapter-contract.md
