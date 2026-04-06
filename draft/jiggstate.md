# .jiggstate

A `.jiggstate` file records one user's progress on a puzzle. It is a standalone JSON file
— not embedded in the `.jigg` archive.

## Design

`.jiggstate` is a ledger of current piece positions. It is:
- **Mutable** — changes on every save
- **Standalone** — lives outside the `.jigg` archive, associated by UUID
- **Optional** — a `.jigg` without a corresponding `.jiggstate` is fully valid
- **Flat** — a single `pieces` array, O(1) accessible by piece ID

## Association with .jigg

A `.jiggstate` references its parent `.jigg` via `puzzleId`, which MUST match the `id`
field in the target `manifest.json`. Readers MUST reject mismatches.

Association by convention:
- Filename pairing: `mypuzzle.jigg` ↔ `mypuzzle.jiggstate`
- UUID handshake: verify `puzzleId` before loading

## Formal Schema

`schema/jiggstate.schema.json` is the normative schema for this format. A `.jiggstate`
file can be validated against it independently — without loading the parent `.jigg` archive.
Lightweight handshake:
1. Validate against schema (fast, no ZIP)
2. Check `puzzleId` against target `.jigg` manifest

## Coordinate System

Three coordinate layers. Only the first is persisted:

| Layer | Space | Where used |
|-------|-------|------------|
| **Normalized** | `[0.0, 1.0]` image-relative | Stored in `.jiggstate` (freeform stages) |
| **Image-native** | Absolute pixels of source image | SVG path data, hit-testing |
| **Screen/Viewport** | PixiJS stage pixels | Runtime only, never persisted |

Runtime conversion: `pixelX = pos.x * image.width` — once at load, not per frame.

## Stage Registry

`.jiggstate` defines the available environments in a `stages` array. Every piece declares
which stage it currently occupies via `stageId`.

```ts
interface Stage {
  id: number        // 0 = workspace (always present, always freeform)
  name: string      // e.g. "Workspace", "The Tray", "Sky Pieces"
  type: "freeform" | "managed"
}
```

**Stage types:**
- `freeform` — the interactive workspace. `pos`, `rot`, and `z` are meaningful. Snap,
  physics, and solve logic run here.
- `managed` — a tray or sorting area. Engine renders a sorted list. `pos` may be a
  tray-relative layout hint, or absent if the UI auto-sorts.

**Stage 0 invariant:** `stages[0]` MUST have `id: 0` and `type: "freeform"`. It is the
workspace and must always be present.

## Schema (TypeScript reference)

```ts
interface JiggState {
  puzzleId: string              // UUID v4 — must match target .jigg's id
  version: string               // "0.2"
  manifestHash: string          // sha256: hash of manifest.json at save time
  lastPlayed?: string           // ISO 8601 datetime
  completionStatus?: "not_started" | "in_progress" | "completed"
  gridDimensions?: {            // required when puzzle has no pieces.json (procedural)
    cols: number
    rows: number
  }
  stages: Stage[]
  pieces: PieceState[]
}

interface PieceState {
  id: string        // piece ID. Required.
  pos?: { x: number; y: number }  // normalized [-2, 3]. freeform: image-relative. managed: tray hint or absent.
  rot?: number      // degrees [0, 360). Persisted across all stages. Managed stages MAY ignore for UI layout but MUST preserve for state integrity.
  z?: number        // integer layering order. Meaningful for freeform stages. Managed stages SHOULD respect if the tray allows overlapping pieces.
  c?: string        // cluster ID. Pieces sharing the same c move as a rigid body.
  stageId?: number  // defaults to 0 (workspace) if absent. Writers SHOULD omit for workspace pieces.
}
```

## Rules

**`puzzleId`** — MUST match the target `.jigg`'s `id`. Readers MUST reject mismatches.

**`manifestHash`** — SHA-256 of `manifest.json` at save time. On load:
- Hash matches → proceed normally
- Hash differs → re-verify `image.hash` and `pieces.hash` individually
- `pieces.hash` mismatch → ReadOnly or Reset (state is orphaned)
- `image.hash` mismatch → warn user, load anyway

**`stageId` default** — absent or `null` = stage 0. Writers SHOULD omit `stageId` for
workspace pieces to keep files lean.

**Cluster constraint** — all pieces sharing the same `c` value MUST have the same
`stageId`. Moving a piece to a tray moves the whole cluster. Writers enforce this;
readers MAY warn if violated.

**Coordinate meaning by stage** — freeform stages: `pos` is normalized `[0,1]`
image-relative, clamped `[-2, 3]`. Managed stages: `pos` is a tray-relative layout hint,
or absent if the UI manages ordering from the array position alone. `rot` and `z` are
persisted across all stages — managed stages MAY ignore them for UI layout but MUST
preserve them so values survive a move back to the workspace.

**Unplaced pieces** — a piece ID absent from the `pieces` array is treated as not yet
placed. Behavior (off-canvas, at canonical position, scatter) is implementation-defined.

**`gridDimensions`** — required for procedural (no `pieces.json`) puzzles. If it doesn't
match the app-derived grid from `pieceCount` and aspect ratio, app MUST start a new
session. Guards against loading a 100-piece save against a 500-piece puzzle.

**No checksum** — `.jiggstate` is mutable by design.

## Example

```json
{
  "puzzleId": "550e8400-e29b-41d4-a716-446655440000",
  "version": "0.2",
  "manifestHash": "sha256:d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5",
  "lastPlayed": "2026-04-06T14:23:00Z",
  "completionStatus": "in_progress",
  "stages": [
    { "id": 0, "name": "Workspace", "type": "freeform" },
    { "id": 1, "name": "The Tray",  "type": "managed"  }
  ],
  "pieces": [
    { "id": "p-01", "pos": { "x": 0.5,   "y": 0.5   }, "rot": 0,  "c": "cluster-A" },
    { "id": "p-02", "pos": { "x": 0.42,  "y": 0.31  }, "rot": 0,  "c": "cluster-A" },
    { "id": "p-03", "pos": { "x": 1.24,  "y": -0.18 }, "rot": 90, "z": 3 },
    { "id": "p-04", "stageId": 1, "c": "cluster-B" },
    { "id": "p-05", "stageId": 1, "c": "cluster-B" },
    { "id": "p-06", "stageId": 1 }
  ]
}
```

Reading this example:
- `p-01`, `p-02` — workspace (stageId omitted = 0), cluster-A, move as rigid body
- `p-03` — workspace, solo piece with z-order
- `p-04`, `p-05` — tray (stageId: 1), cluster-B, no pos needed
- `p-06` — tray, solo, no pos

## TODO

- [ ] State versioning strategy — how readers handle unknown versions
- [ ] Partial state validity — what happens when a piece ID references a piece not in the puzzle
- [ ] Conflict resolution — two devices saving state for the same puzzle
