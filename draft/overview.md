# Overview

`.jigg` is a portable digital jigsaw puzzle container format.

## Core design principle

`puzzle` (immutable definition) and `state` (user progress) are
strictly separated. A `.jigg` file without state is fully valid
and portable — it defines a puzzle that anyone can solve.
State is layered on top and is always optional.

## High-level structure

A `.jigg` file is a ZIP archive containing:
- `mimetype` — format identifier, must be first file, uncompressed
- `manifest.json` — central entry point, references all other files
- `image.jpg` (or similar) — the source image
- `pieces.json` — piece geometry definitions
- `solved.json` — canonical solved positions (immutable)
- `state.json` (optional) — current user progress

## TODO
- [ ] Decide on checksum/integrity strategy
- [ ] Decide on thumbnail/preview spec
- [ ] Finalise piece geometry schema (see pieces.md)
- [ ] Finalise state schema (see state.md)
