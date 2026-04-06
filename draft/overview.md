# Overview

`.jigg` is a portable digital jigsaw puzzle container format.

## Core design principle — Blueprint / Instance

Two separate formats, two separate concerns:

- **`.jigg` (The Blueprint):** An immutable, self-contained ZIP archive. Contains the
  source image, optional vector die-lines, and a thumbnail proxy. Safe to share, publish,
  or archive. Once created, it never changes.

- **`.jiggstate` (The Instance):** A standalone JSON sidecar file. Records one user's
  session — where pieces currently are, z-order, cluster groupings, and completion status.
  References its parent `.jigg` by UUID. Changes on every save.

A `.jigg` file is fully valid and shareable without any `.jiggstate`. A recipient who opens
it starts fresh. The `.jiggstate` is never embedded in the archive.

## Geometry — Implicit vs. Explicit

The geometry mode is signalled by the presence or absence of `puzzle.pieces` in
`manifest.json`. No separate `type` field is needed.

- **Explicit** (`pieces` present) — hand-crafted geometry. The app loads SVG die-lines
  from `pieces.json`. The cut is part of the creative work and is immutable.

- **Implicit** (`pieces` absent or null) — procedural grid. The app generates a standard
  grid at session start from the image dimensions and a user-chosen piece count. Grid
  dimensions and piece IDs are recorded in `.jiggstate`.

## High-level structure

A `.jigg` file is a ZIP archive containing:
- `mimetype` — format identifier, must be first file, uncompressed
- `manifest.json` — central entry point
- `image.jpg` (or similar) — the source image
- `thumb.jpg` *(recommended)* — low-res proxy for library gallery views
- `pieces.json` *(explicit geometry only)* — SVG die-lines and canonical positions

## TODO
- [ ] Finalise .jiggstate schema (see jiggstate.md)
