---
section: CLI
---
- The `mewkit` binary now carries the kit's version: kit and binary are released together under one number (the binary moves from 0.2.1 to the 3.x line), so `mewkit --version` and `mewkit versions` name the same release. `mewkit self-update` and `mewkit init` find releases exactly as before.
- Betas are published from every merge into `develop`, for the kit (`mewkit init --beta`, `mewkit upgrade --beta`) and the binary (`mewkit self-update --channel beta`) together. Stable releases come only from `main`, through a reviewed `release/vX.Y.Z` pull request.
