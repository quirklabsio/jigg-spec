# .jigg Format Specification (v0.1.2-draft)

A `.jigg` file is a portable, sovereign digital jigsaw puzzle container. It uses a **Blueprint/Instance** model to strictly separate immutable puzzle geometry from volatile user progress.

## Core Philosophy
- **Local-First:** Designed for offline-capable, browser-based applications.
- **Data Sovereignty:** The user owns the puzzle (`.jigg`) and their work (`.jiggstate`).
- **Resolution Independence:** Uses normalized coordinates for transforms and SVG paths for geometry.

## File Ecosystem
| Extension | Role | Format | Status |
| :--- | :--- | :--- | :--- |
| **`.jigg`** | The Blueprint | ZIP Archive | Immutable Master |
| **`.jiggstate`** | The Instance | JSON Sidecar | Volatile Progress |

## Documentation
- [Overview](./draft/overview.md) — Architecture & Goals
- [Container](./draft/container.md) — ZIP structure & MimeType
- [Manifest](./draft/manifest.md) — The `manifest.json` entry point
- [Pieces](./draft/pieces.md) — SVG Paths & Normalized Transforms
- [State](./draft/jiggstate.md) — The `.jiggstate` Sidecar Spec
- [Decisions](./draft/decisions.md) — The "Why" behind the format

---
*Status: Draft (pre-1.0). Maintained alongside the Jigg reference implementation. Breaking changes are expected.*