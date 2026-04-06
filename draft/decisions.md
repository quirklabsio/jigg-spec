# Design Decisions

A record of significant design choices, what was considered, and why alternatives were
rejected. Intended to prevent re-litigating settled questions and to provide context for
future contributors.

---

## Identity & Checksums

### Root `id` — UUID v4

The top-level `id` field identifies the puzzle definition. Assigned at puzzle creation,
stable forever. Downloading the same puzzle twice produces the same `id`. Libraries use
this to recognize duplicates and associate saved progress with the correct puzzle.

**Rejected:** `definitionId` as a separate named field — unnecessary complexity. A plain
`id` is sufficient unless a concrete case emerges where one puzzle needs to spawn multiple
grouped IDs.

**Not a content hash.** The `id` does not change if metadata is updated. It is an opaque
identifier for *what the puzzle is*, not a fingerprint of its bytes.

---

### `puzzle.image.checksum` — SHA-256, lives on the resource

The checksum lives inside the `image` block because it is a property of that resource, not
of the puzzle as a whole. This sets a consistent pattern: every resource reference
(`image`, `pieces`, `solved`) carries its own `checksum`, co-located with the file it
describes.

**Rejected:** `puzzle.imageChecksum` at the puzzle level — would have produced
`imageChecksum`, `piecesChecksum`, `solvedChecksum` as siblings, polluting the parent
object and breaking the pattern for future resources.

**Format:** `sha256:` followed by exactly 64 lowercase hex characters. The `sha256:`
prefix enables algorithm agility in future versions without a breaking field rename.
SHA-256 is the only supported algorithm in v0.1.

**Dual purpose:** `image.checksum` serves both integrity verification on load and image
deduplication in the library (grouping puzzles that share the same source photo).

**Not conflated with puzzle identity.** Image checksum answers "is this the same source
photo?" Puzzle `id` answers "is this the same puzzle?" These are different questions —
same image + different cut = different `id`, same `image.checksum`.

---

### Whimsy puzzles / cut identity

Same image + different cut = different published puzzle = different `id` by design.
No special handling or additional field needed. The `id` is assigned at creation; two
puzzles cut from the same image are simply two distinct puzzles with distinct IDs.

A `cutChecksum` field was discussed for enforcing cut integrity in marketplace contexts
(e.g. whimsy puzzles where the cut is part of the creative product). Deferred — the
pattern is established by `pieces.checksum`, and enforcement policy is a marketplace-level
concern, not a format-level one.

---

### State identity

Same puzzle at different points in time = same `id`, different `.jiggstate` file. The `id`
identifies the definition; state is layered on top via the sidecar. A `.jigg` without a
corresponding `.jiggstate` is a valid, shareable puzzle definition.

`.jiggstate` deliberately does not carry a checksum — state is mutable by design, and
verifying it against a fixed hash would invalidate on every save.

---

## Piece Geometry

### solved.json deprecated — pieces.json is the single blueprint

`solved.json` has been removed. `pieces.json` is the single authoritative source for both
piece geometry (die-lines) and canonical solved positions. Having two files encode the same
information (where each piece belongs) created redundancy and a potential consistency hazard.

**Rejected:** Keeping `solved.json` as a separate integrity check — the `pieces.json`
checksum in the manifest already covers this. Two files, one truth.

---

### SVG path data for piece shapes

Piece geometry is expressed as SVG path data (`M`, `L`, `C`, `Q`, `Z` commands only) in
absolute image pixel coordinates. This is the "sheet of glass" model — the source image is
a flat sheet and SVG paths are die-lines cut through it. A reader clips the image with each
path to render individual pieces.

**Rejected:** PNG mask per piece — large file sizes, lossy at non-native resolutions.
**Rejected:** Bounding box only — lossy, cannot represent tab/blank curves or whimsy shapes.
**Rejected:** Custom curve format — SVG path data is an established standard with broad
tooling support and matches what the reference implementation (Rust/WASM Bézier generator)
produces natively.

Whimsy pieces (custom shapes like animals, letters) are supported natively — the `path`
field carries any closed SVG shape, and `metadata.shapeName` labels it.

---

### Normalized coordinates for transforms

Canonical piece positions (and `.jiggstate` actual positions) use normalized coordinates
relative to image dimensions: `(0.0, 0.0)` = top-left, `(1.0, 1.0)` = bottom-right.
SVG path data stays in absolute image pixel coordinates — paths are geometry tied to the
image, not to display space.

**Why normalized:** Resolution independence — the same `.jiggstate` produces identical
snapping and layout on a phone or a 4K monitor. Avoids storing pixel positions that become
meaningless if the image is re-exported at a different resolution.

**Pivot point (resolved):** The rotation origin is the piece's bounding box center,
expressed as its canonical `(x, y)`. With center-based normalized positions, rotation
math is uniform across all pieces with no per-piece origin fields needed.

**Rejected:** Fully normalized paths — SVG path data with fractional coordinates is
non-standard and harder to derive from tooling. Keeping paths in pixel space and
normalizing only transforms is the clean boundary.

---

## State Architecture

### State extraction to .jiggstate sidecar

User progress (`actual` position, z-order, cluster groupings) lives in a standalone
`.jiggstate` JSON file, not inside the `.jigg` ZIP archive.

**Why:** The `.jigg` archive becomes a true immutable blueprint — safe to share, publish,
or archive. State changes on every move; embedding it in a ZIP would require re-archiving
the entire file on every save, which is expensive and error-prone.

**Association:** `.jiggstate` references its parent `.jigg` via `puzzleId` (UUID). The
application verifies this handshake on load and MUST reject mismatches. File-naming
convention (e.g. `puzzle.jigg` ↔ `puzzle.jiggstate`) provides the discovery mechanism.

**Rejected:** Keeping state inside the ZIP with a separate manifest key — forces the ZIP
to be mutable, complicates sharing (strip state before sharing?), and entangles two
lifecycles that should be independent.

**Removed from `.jigg`:** `actual` transform, `groupId`, and the `state` manifest key.
These are all instance-level concerns.

---

## Geometry Strategy — Implicit vs. Explicit

### Structure speaks. No `type` field.

Geometry mode is signalled by the presence or absence of `puzzle.pieces` in
`manifest.json`. No explicit `type` or `cutType` field is needed.

- `puzzle.pieces` present → **explicit geometry**. App loads `pieces.json`.
- `puzzle.pieces` absent or null → **procedural grid**. App generates at session start.

**Rejected:** `puzzle.type: "whimsy" | "raw"` enum — adds a field that can fall out of
sync with file structure. If `pieces.json` is missing but `type` says `"whimsy"`, which
wins? Letting structure be the signal eliminates the inconsistency class entirely.

**Rejected:** `cutType` or any named variant field — same problem, different name.

This is the "no worms" rule: one source of truth, no fields that could contradict each other.

---

## Manifest Minimalism

### Hashes on every file reference — `hash`, not `checksum`

Every file reference in `manifest.json` (`image`, `pieces`, `thumbnail`) carries a
`hash` field. Field name is `hash` — shorter and more idiomatic than `checksum`.

**Rationale (reversal of earlier "checksums removed" decision):** In a local-first,
sovereign system, the format cannot rely on a signing layer above it. If a user replaces
`image.jpg` with a different file of the same name, or if a whimsy cut is silently
modified, the `.jiggstate` is physically broken — pieces won't align. The format must be
able to detect this itself.

**Three-tier validation on load** (defined in manifest.md):
- `image.hash` mismatch → non-fatal warning. State loads, user alerted.
- `pieces.hash` mismatch → fatal for state. ReadOnly or Reset.
- `thumbnail.hash` mismatch → silent. UI concern only.

**`manifestHash` in `.jiggstate`** — the state file stores a hash of `manifest.json`
at save time. On load the engine compares this to detect any post-save changes, then
re-verifies individual file hashes as needed.

**Content-addressable deduplication** — `image.hash` enables the library to detect
when two `.jigg` files embed the same source image. One copy stored in IndexedDB,
referenced by hash. Avoids duplicating 50MB assets across a collection.

**Format:** `sha256:` followed by exactly 64 lowercase hex characters. SHA-256 is the
only supported algorithm in v0.1.2. The prefix enables algorithm agility in future
versions. Web implementation: `SubtleCrypto.digest("SHA-256", ...)`. .NET: `SHA256.HashData(...)`.

### `puzzle.image.source` — provenance protocol, not type classification

The image block carries a `source` field describing where the image data lives.
Renamed from the earlier `type` field; `source` is more precise — it describes provenance,
not classification. The value field is renamed `path` (from `src`) to match.

Defined values in v0.1.2:
- `"embedded"` — file is inside the ZIP, always on hand
- `"url"` — engine must fetch from HTTP/HTTPS; library must handle offline/absent case

`"local-fs"` is reserved for a future local-first mode (point at a Pictures folder without
duplicating files into the archive). Not defined in v0.1.2.

**Why `source` over `type`:** `type` classifies; `source` describes origin. A library
gallery genuinely needs to know whether it has the image on hand (`"embedded"`) or needs
to fetch it (`"url"`) to decide how to render a preview. That's a provenance question,
not a type question.

**Rejected:** Removing this field entirely (earlier draft) — the library's "on hand" check
requires it. A URL-sourced puzzle with no `source` field forces the app to guess.

### `pieceCount` removed from manifest

For explicit geometry puzzles, piece count is the length of the `pieces` array in
`pieces.json`. For procedural puzzles, piece count is a session decision stored in
`.jiggstate`'s `gridDimensions`. The manifest has no role in either case.

---

## Thumbnail

### `thumb.jpg` — embedded, recommended, not required

A low-resolution proxy image is embedded in the `.jigg` archive as `thumb.jpg` and
referenced from `metadata.thumbnail`. This resolves the long-standing thumbnail TODO.

Recommended maximum: 512×512px, JPEG quality 70–85. Produced by the authoring tool, not
the reader. Readers MUST NOT fail if absent.

**Rejected:** Generated on open — requires decoding the full source image, defeats the
purpose of a fast library scan.
**Rejected:** No thumbnail — forces library UIs to either decode the full image or show
placeholder UI, degrading the gallery experience.

The `metadata.thumbnail` field stores the internal path within the archive (e.g.
`"thumb.jpg"`) so the reader knows where to look without guessing.

---

## Coordinate System — Three Layers

The spec defines three coordinate spaces with distinct roles:

| Layer | Space | Where used |
|-------|-------|------------|
| **Normalized** | `[0.0, 1.0]` relative to image dimensions | Stored in `.jiggstate` and `pieces.json` canonical |
| **Image-Native** | Absolute pixels of the source image | SVG path data, hit-testing |
| **Screen/Viewport** | PixiJS stage pixels, scaled to display | Runtime rendering only, never persisted |

**Normalized is the persistence layer.** Both canonical positions (`pieces.json`) and
actual positions (`.jiggstate`) are normalized. The rendering engine (PixiJS) converts
at runtime:

```
pixelX = normalized.x * image.width
pixelY = normalized.y * image.height
```

This conversion happens once at load — not per frame. The state file remains portable
across any display size or resolution.

**SVG paths use image-native pixels** because die-line geometry is tied to the source
image, not to any display context. This is the only place pixel coordinates appear in
persisted data.

**Rejected:** Storing `.jiggstate` actual positions in pixel coordinates — non-portable
across display sizes, and requires re-saving state when the render resolution changes.

**Rejected:** Storing SVG paths in normalized coordinates — non-standard, harder to derive
from tooling, and offers no benefit since paths are always interpreted relative to a
specific image.

---

## Deterministic Piece IDs for Raw Puzzles

For `type: "raw"` puzzles (no `pieces.json`), piece IDs must be deterministic so
`.jiggstate` can reference them reliably. The convention is:

```
grid_{col}_{row}   →   grid_0_0, grid_1_0, grid_14_22, ...
```

Zero-indexed column/row coordinates encode both identity and position — no separate
lookup needed.

The `.jiggstate` for raw puzzles MUST include `gridDimensions: { cols, rows }`. If this
doesn't match what the app derives from the manifest, the app MUST start a new session.
This guards against loading a 100-piece save against a 500-piece puzzle.

**Rejected:** Row-major index strings (`piece-000`, `piece-001`) — encodes no spatial
information, harder to debug, and requires the full grid to be reconstructed to know
which piece is which.

---

## Metadata for Fast-Scan Library Indexing

### `aspectRatio` and `thumbnail` as pre-computed manifest fields

Library gallery views need to know image proportions and have a preview image before
loading any binary assets. Both are provided in the manifest as pre-computed fields:

- `metadata.aspectRatio` = `image.width / image.height`. Pre-computed so the UI can
  allocate stable layout space without any arithmetic. `image.width` and `image.height`
  remain authoritative; `aspectRatio` is a convenience cache.
- `metadata.thumbnail` = internal path to `thumb.jpg`. Present only when a thumbnail was
  produced by the authoring tool.

A library can index an entire collection by reading only `manifest.json` from each archive
— no image decoding, no geometry parsing.

---

## Stage Registry

### Flat piece array with `stageId` — over first-class cluster objects

The `.jiggstate` adds a `stages` array defining named environments (`freeform` / `managed`),
and extends each piece entry with an optional `stageId`. Clusters remain implicit via the
`c` field on individual pieces. No nesting, no separate cluster objects.

**Rejected:** First-class `ClusterEntity` objects in an `entities` array (earlier plan).
That model required moving all piece references into cluster objects, making piece lookup
indirect and requiring structural transformation whenever a piece joined or left a cluster.
The flat model just updates one field (`c`) and is O(1) by piece ID.

**Rejected:** `"inTray": boolean` flag — one tray, fixed metaphor, no extensibility.
Adding a second tray would require a breaking schema change.

### Integer stage IDs over string IDs

Stage IDs are integers (0, 1, 2, …). Stage 0 is always the freeform workspace.
The `name` field carries the human-readable label.

**Rejected:** String stage IDs (`"workspace"`, `"corner-tray"`) — an earlier plan used
these. Integer IDs are faster to compare at render time and make the default-when-absent
rule (`stageId` missing = 0) clean and unambiguous.

### `stageId` omission defaults to 0

Writers SHOULD omit `stageId` for workspace pieces. Readers treat absence as stage 0.
Rationale: the overwhelming majority of pieces are on the workspace most of the time.
Omitting the field reduces file size for the common case with no loss of information.

### Short field names: `rot`, `c`, `pos`

`rotation` → `rot`, `clusterId` → `c`, flat `x`/`y` → `pos: { x, y }`.
State files are written on every user interaction (every drag, snap, rotate). At scale
(500-piece puzzle serialized repeatedly), every byte counts. The `pos` object also makes
the entire spatial context absent as a single unit for managed-stage pieces, so the engine
tests `piece.pos !== undefined` rather than checking two separate fields.

### Cluster constraint is a writer rule, not a schema rule

All pieces sharing a `c` value MUST have the same `stageId`. Moving a piece to a tray
moves the whole cluster. JSON Schema draft-07 cannot express cross-item constraints
within an array, so this is a prose rule enforced by the writer. Readers MAY warn if
violated but are not required to reject the file.

### Version bump to 0.2

Adding `stages`, renaming `x`/`y` to `pos`, renaming `rotation` → `rot` and
`clusterId` → `c` is a breaking structural change. v0.1 readers MUST reject v0.2 files
cleanly. The `version` const in the schema is updated to `"0.2"`.
