# jigg file format specification

## 1. Overview

Three file formats:
- `.jigg` — user-facing bundle. The only format users ever interact with.
- `.jiggsaw` — immutable artist product. Distributed via marketplace.
- `.jiggstate` — one playthrough instance. Never distributed standalone.

`.jigg` always contains a `.jiggsaw`. The puzzle is the anchor.

Key principles:
- Product (immutable) vs playthrough (mutable) vs bundle (distribution) are
  cleanly separated
- Every field has a documented source of truth
- Offline-first identity — URIs locally generated, globally valid
- Stage naming reflects interaction model, not correctness semantics
- Correctness is owned entirely by `placed: boolean`, not stage identity

---

## 2. File Format Table

| Format | Role | Mutability |
|---|---|---|
| `.jigg` | User bundle — downloaded, stored, played | Mutable — header updated on save |
| `.jiggsaw` | Artist product — marketplace distributed | Immutable after creation |
| `.jiggstate` | Playthrough instance — internal to .jigg | Mutable — assembly updated on save |

---

## 3. Identity Model

`JiggUri`:
- URN semantics — identity not location
- Format: `jigg:{type}:{token}` where token is Base62 NanoID (22 chars)
- Core types (reserved): `artist`, `org`, `puzzle`, `state`
- Extension types: namespaced with at least one dot e.g. `jigg:cut.template:abc123`
- Unknown types MUST NOT cause load failure — treated as opaque identifiers
- `artist` — individual creators
- `org` — institutions, brands, publishers e.g. The Met, BearPark
- `puzzle` — puzzle product identity
- `state` — playthrough identity
- Parsing: `const [_, type, token] = uri.split(':')`
- Offline: app generates `jigg:puzzle:{nanoid}` locally. Promoted on publish.
  No remapping needed — identity already established.

Identity hierarchy:
| Scope | Format | Lifetime |
|---|---|---|
| Global | `jigg:{type}:{nanoid22}` | Forever |
| User resource | `nanoid(8)` | Life of playthrough — user tray IDs, cluster IDs |
| Local atom | `p-001`, `t-001` | Life of puzzle version |

Deferred: Attribution Registry — maps JiggUri to full entity records.

---

## 4. Stage System

STAGE_TABLE and STAGE_BENCH are required spec-defined stages.
All pieces MUST be initialised in STAGE_BENCH at game creation.

The lifecycle is: bench → table. Placement is a state transition, not a stage.
"placed" is not a stage — it is a boolean flag indicating correctness.

STAGE_BENCH is a one-way origin. Pieces MUST NOT transition into STAGE_BENCH
after leaving it.

User tray IDs are typed as UserStageId (string).
Engine MUST NOT generate a UserStageId of "table" or "bench".

The global coordinate space is a 2D Cartesian plane with arbitrary origin
and scale, defined by the engine. All persisted PieceState.pos values exist
in this coordinate space.

Pieces in STAGE_BENCH do not have a position and do not participate in the
coordinate space until extracted.

Stage membership is logical only — it does not define a coordinate system.
For transitions between non-bench stages, pos MUST NOT be transformed.
On transition from STAGE_BENCH to any other stage, engine MUST assign a valid
pos in global coordinate space before the piece is written to state.

Exception: cluster merge operations may recompute pos of absorbed pieces
to maintain rigid group structure.

Ghost tray safety net: if `PieceState.stageId` references a stage that no
longer exists in `stages[]`, engine moves those pieces back to `STAGE_TABLE`.

Movement rules:
- `STAGE_BENCH → STAGE_TABLE`: allowed
- `STAGE_BENCH → user tray`: allowed
- `STAGE_TABLE ↔ user tray`: allowed
- `Anywhere → STAGE_BENCH`: rejected

Stages are organisational containers. Rendering, layout, and UX treatment
of each stage is an engine concern.

---

## 5. .jiggsaw Structure

Zip entry table:
| # | Entry | Compression | Purpose |
|---|---|---|---|
| 0 | `mimetype` | Stored | `application/jiggsaw+zip` |
| 1 | `manifest.json` | Deflate | Puzzle identity, image, attribution, integrity |
| 2 | `dissection.json` | Deflate | Default cut |
| 3 | `assets/image.jpg` | Deflate | Full-resolution source image |
| 4 | `assets/thumb.webp` | Deflate | Thumbnail — copied to .jigg root at import |

No `header.json` — .jiggsaw is not shelf-scanned.

`JiggManifest`:
- `uri` — canonical identity, locally generated, stable forever
- `specVersion` — for parsing
- `title`, `aspectRatio`
- `attributions[]` — ordered array, primary is `[0]`
  Roles: artist, illustrator, photographer, publisher, brand, extensible string
- `credit` — verbatim required attribution for institutions e.g.
  "Courtesy of The Metropolitan Museum of Art"
  Source of truth for `JiggHeader.displayCredit`:
    - credit present → derive displayCredit from credit (truncate if needed)
    - credit absent → derive displayCredit from attributions[0].name
  Engine writes displayCredit at import time. Never independently edited.
- `license` — e.g. "CC0", "Public Domain", "All Rights Reserved"
- `cutStyle` — absent = grid product. `"whimsy"` = cut is part of product,
  dissection required. Whimsy shape definitions live in dissection, not manifest.
- `image` — source, path, width, height
- `integrity` severity tiers:
  - `dissection` — informational. Artist updated default cut. Runtime
    dissection in .jiggstate is sovereign and unaffected. User may have
    chosen a custom cut at game creation. Surface as "puzzle updated."
  - `image` — cosmetic. Texture updated. Playthrough fully valid.
  - `thumbnail` — ignore. Cosmetic only.

---

## 6. JiggDissection (shared type)

Present in both `.jiggsaw` (default cut) and `.jiggstate` (runtime cut).
In `.jiggstate`: user's choice at game creation. May differ from default.
Written once. Immutable for the life of the playthrough.

Whimsy shape definitions live here — not in the manifest.
The manifest signals `cutStyle`; the dissection owns the shapes.

`PieceDefinition`:
- `id` — sequential, scoped to dissection e.g. "p-001"
- `templateId` — key into templates Record
- `edgeType` — `"corner" | "edge" | "interior"`. Filter dimension.
- `canonical` — normalized [0.0, 1.0], origin top-left, bounding box center.
  `rot` is always literal `0`.
- `index` — 1-based, left-to-right top-to-bottom. Stable across cut styles.
- `meanColor` — arithmetic mean of pixels sampled across piece boundary.
  sRGB color space. Euclidean distance for nearest centroid mapping.
  Computed once at cut-time. Immutable. Engine maps to nearest centroid in
  JiggAssembly.palette at runtime. If palette changes, only palette updated —
  no piece records touched.
- `whimsyId` — absent for standard pieces

`PieceTemplate` — id, path (SVG), width, height, anchorPoint
Templates Record keyed by templateId for O(1) lookup — hydrated once on load.

`WhimsyDefinition` — may span one or more pieces.
Membership derived at runtime by filtering PieceDefinition on whimsyId.

Deferred: `.jiggcut` template packs — cutId and cutVersion fields added when
introduced. Templates remain snapshotted inline for game integrity.

---

## 7. .jiggstate Structure

Zip entry table:
| # | Entry | Compression | Written |
|---|---|---|---|
| 0 | `mimetype` | Stored | Once |
| 1 | `glue.json` | Stored | Once at game creation |
| 2 | `dissection.json` | Deflate | Once at game creation |
| 3 | `assembly.json` | Deflate | Every save |

`glue.json` — named after puzzle glue, the physical product used to seal and
preserve a completed jigsaw. Here it permanently binds the playthrough to the
puzzle. Written once at game creation, never mutated. Stored uncompressed for
zero-decompression fast-fail identity checks.
Engine reads glue.json before decompressing anything else. If puzzleUri
mismatches the current .jigg bundle, load is aborted immediately.

`JiggGlue`:
- `uri` — playthrough identity, generated at game creation, stable forever.
  Enables device sync, conflict resolution, future multiplayer.
- `puzzleUri` — references JiggManifest.uri. Identity anchor.
- `manifestHash` — SHA-256 of manifest.json at game creation time.
  puzzleUri confirms identity — manifestHash confirms version.
  On load: if hash differs, check manifest.integrity fields to understand
  what changed. State remains valid in all cases.
- `createdAt` — ISO 8601. When this playthrough was started.

`JiggAssembly`:

Rotation is cardinal only. Engines MUST support exactly four orientations:
0, 90, 180, 270 degrees. No configuration exists — this is fixed for all
playthroughs and all engines.

PieceState.rot stores degrees as a number. Valid values are {0, 90, 180, 270}.

Engines MUST write only normalized values to PieceState.rot.
Normalization on load is a safety net for invalid or legacy data only.

Normalization steps, applied in order:
1. Wrap input to [0, 360) — handles negative values and values ≥ 360
2. Snap to nearest of {0, 90, 180, 270} using angular distance modulo 360
3. Ties round to the next clockwise cardinal

At game creation, engine assigns a random cardinal rotation to every piece.
This value is written to PieceState.rot immediately and persists across sessions.
Rotation is persisted playthrough state.

User interaction MUST NOT allow rotation while a piece remains in STAGE_BENCH.
On transition from STAGE_BENCH to any other stage, the existing rot value
carries over unchanged and becomes user-manipulable.

Initial rotation is a playthrough concern — not defined by the dissection.

Palette:
Default palette computed at game creation via k-means on piece meanColor values.
User may regenerate palette — new centroids overwrite JiggAssembly.palette.
Palette persists across sessions as a playthrough preference.
Engine maps each piece's meanColor to nearest centroid (Euclidean, sRGB) at runtime.
If palette absent, engine uses meanColor directly.

`playTimeSeconds`:
- Active play time in seconds. Source of truth on assembly.
- Engine increments during active interaction only.
- Pauses on idle / tab hidden / app backgrounded.
- Cannot be reconstructed after the fact — must be tracked explicitly.
- Each player's .jiggstate tracks their own time independently.

`PieceState`:
- `stageId` is always explicit — never absent
- `pos` MUST be present iff `stageId !== STAGE_BENCH`

Game creation invariants — ALL of the following MUST hold for every piece:
- stageId === STAGE_BENCH
- pos is absent
- rot is a valid cardinal value (0 | 90 | 180 | 270)
- placed === false
- clusterId is absent

No clusters exist at game creation. The starting graph is fully disconnected.

`placed`:
placed: boolean is the sole correctness authority. Non-optional.
Engine sets placed: true when a piece locks to its canonical position.
placed is a state flag — it is not a stage and does not imply a stage transition.
Engines SHOULD ensure placed pieces reside in STAGE_TABLE.
placed === true implies clusterId is absent.
Engine MUST enforce this invariant immediately on transition.

If an engine allows a placed piece to become unplaced, it MUST be treated
as a new unconnected piece with clusterId absent and placed: false.

Cluster model:

clusterId is authoritative state, generated at snap time using NanoID(8).
On save: write each piece's current group ID as clusterId.
On load: group pieces by clusterId to reconstruct runtime groups.
Derive group origin from the lowest PieceDefinition.index member's world pos.
All other members' local offsets are computed from that origin.

Cluster merge is only valid when all participating pieces satisfy snap
conditions, including rotation compatibility. Engines MUST NOT merge
clusters with incompatible rotations.

Cluster merging: larger group survives. If equal size, the cluster whose
origin piece has the lower PieceDefinition.index survives. Absorbed group
ID is deleted. Absorbed pieces take the survivor ID. The surviving cluster's
origin piece (lowest PieceDefinition.index) MUST remain fixed in world space.
All absorbed piece positions MUST be recomputed relative to that origin.

No cluster breakup exists.
placed === true implies clusterId is absent.
Engine MUST enforce this invariant immediately on transition.
clusterId MUST be absent for STAGE_BENCH pieces.
clusterId MUST be absent for all pieces at game creation.

`JiggGlue`:
JiggGlue is named after puzzle glue — the physical product used to seal
and preserve a completed jigsaw. It permanently binds a playthrough to its
puzzle. Written once at game creation, never mutated.

Fields:
- uri: playthrough identity, generated at game creation, stable forever
- puzzleUri: references JiggManifest.uri — identity anchor
- manifestHash: SHA-256 of manifest.json at game creation time
- createdAt: ISO 8601 — when this playthrough was started

On load, engines MUST treat JiggGlue as immutable. Any mismatch between
glue.puzzleUri and the loaded puzzle's uri MUST be treated as invalid
state — load MUST be aborted.

A .jigg contains at most one JiggState. Starting a new game overwrites
the existing .jiggstate entirely. The previous playthrough is not preserved.
JiggGlue.uri is stable for the life of a single playthrough only — a new
game generates a new uri.

Progress metrics:
- `placedCount` — pieces correctly solved at canonical position.
  Exact canonical match. Never loosened.
- `assemblyProgress` — `1 - (clusterCount - 1) / (pieceCount - 1)`.
  0.0 = all pieces separate. 1.0 = single cluster.
  Guard required: return 1.0 when pieceCount === 1. Clamp to [0, 1].
- `playTimeSeconds` — cached on header from assembly on every save.

Status derivation (engine and UI must follow):
- `lastSavedAt` absent → not-started
- `lastSavedAt` present + `placedCount < pieceCount` → in-progress
- `placedCount === pieceCount` → completed

---

## 8. .jigg Structure

Zip entry table — Holy Trinity (entries 0-2) uncompressed:
| # | Entry | Compression | Purpose |
|---|---|---|---|
| 0 | `mimetype` | Stored | `application/jigg+zip` |
| 1 | `header.json` | Stored | Shelf identity and progress |
| 2 | `thumb.webp` | Stored | Box art |
| 3 | `puzzle.jiggsaw` | Deflate | Puzzle definition |
| 4 | `state.jiggstate` | Deflate | Absent if never played |

Holy Trinity contract: shelf renders a puzzle card from entries 0-2 only.
Zero decompression required.

thumb.webp is binary — no base64 overhead, streamable, readable by any
ZIP-aware tool without knowing the spec.

header.json designed to remain under 1KB. All fields are scalars.

JiggHeader is a write-through cache. MUST be recomputed from authoritative
sources on every save.

Fields:
- `uri` — references JiggManifest.uri
- `specVersion` — for parsing
- `title`, `displayCredit`, `aspectRatio` — cached from manifest at import
- `pieceCount` — cached from dissection, never changes after game creation
- `placedCount`, `assemblyProgress`, `playTimeSeconds` — updated on every save
- `assemblyHash` — SHA-256 of assembly.json, computed over its exact byte
  contents as stored in the archive (no reformatting, normalization, or
  parsing). Absent if never saved. On load: if present, hash the current
  assembly.json byte contents and compare. If mismatch, recompute header
  from authoritative sources before use. Header is self-healing —
  mismatches are corrected, not fatal.
- `lastSavedAt` — absent until first save. Presence = started.
- `completed` is derived: placedCount === pieceCount. Not stored.

assemblyProgress = 1 - (clusterCount - 1) / (pieceCount - 1)
Guard: return 1.0 when pieceCount === 1. Clamp to [0, 1].

Status derivation:
- lastSavedAt absent → not-started
- lastSavedAt present + placedCount < pieceCount → in-progress
- placedCount === pieceCount → completed

Authoritative sources:
- puzzle.jiggsaw → uri, title, displayCredit, aspectRatio, pieceCount
- state.jiggstate → placedCount, assemblyProgress, playTimeSeconds, lastSavedAt

---

## 9. Filename Convention

Pattern: `{slug}_{shortId}.{ext}` e.g. `autumn-forest_550e8400.jigg`
Filename is UX only — consumers MUST key on internal `uri`.
Applies to all three formats.

---

## 10. Engine Conventions

Rules not enforceable by the type system — engine must implement:

- All pieces initialised to STAGE_BENCH at game creation
- Engine MUST NOT assign `"table"` or `"bench"` as a UserStageId
- Movement to STAGE_BENCH rejected unless source is also STAGE_BENCH
- Ghost tray: pieces referencing missing stageId move to STAGE_TABLE
- On bench extraction: engine MUST assign a valid pos before writing state
- placed === true implies clusterId absent; engine enforces immediately
- Engines SHOULD ensure placed pieces reside in STAGE_TABLE
- assemblyProgress guard: return 1.0 when pieceCount === 1; clamp to [0, 1]
- Cardinal rotation only — engines MUST write only normalized rot values
- rot normalization: wrap to [0, 360), snap to nearest cardinal, ties clockwise
- Random cardinal rot assigned to every piece at game creation
- No rotation interaction while piece is in STAGE_BENCH
- playTimeSeconds increments only during active interaction
- clusterId is NanoID(8) — generated fresh at every snap event
- Engines MUST NOT merge clusters with incompatible rotations
- displayCredit derived from credit if present, else attributions[0].name
- JiggGlue.puzzleUri mismatch on load is fatal — abort immediately
- assemblyHash on header computed over exact archive bytes, no reformatting

---

## 11. Key Architectural Decisions

| Decision | Rationale |
|---|---|
| `.jigg` is the only user format | Users never handle .jiggsaw or .jiggstate directly |
| Holy Trinity uncompressed | Zero-decompression shelf rendering |
| `glue.json` uncompressed in .jiggstate | Fast-fail identity check before decompression |
| `JiggGlue` named after puzzle glue | Physical metaphor — seals playthrough to puzzle permanently |
| No header on .jiggstate | Progress lives in .jigg header |
| `SpecVersion` not SemVer | Patch versions meaningless for a file format |
| `JiggUri` locked core type union | No open string fallback — new core types require spec change |
| Extension URI types namespaced | Third-party types are distinguishable and safe to ignore |
| `JiggManifest` not `JiggSawManifest` | Concept-only naming. Manifest belongs to the puzzle, not the format container. |
| `artist` vs `org` URI types | Distinct marketplace browsing — by person vs by institution |
| `STAGE_TABLE` named for interaction | Stage names reflect behavior, not correctness semantics |
| `STAGE_BENCH` required and one-way | Deterministic lifecycle: bench → table. Eliminates dual initialisation paths. |
| `placed` is a state flag, not a stage | Prevents implementors treating placement as a stage transition |
| `placed` sole correctness authority | Decoupled from stage — stage is a consequence of placement, not a co-constraint |
| Engines SHOULD move placed pieces to `STAGE_TABLE` | Preserves expected UX without hard-coupling placed to stage |
| `placed === true` implies `clusterId` absent | A placed piece is solved and individual — group membership ends at placement |
| Unplaced piece rule | Keeps invariant total if UX evolves to allow unplacing |
| `stageId` always explicit | Eliminates undefined/bench ambiguity in serialization |
| `UserStageId` type | Makes user tray ID intent explicit in the type system |
| No clustering on bench | Bench is a clean start — no pre-grouping, no merge edge cases |
| No clusters at game creation | Guarantees fully disconnected starting graph |
| `clusterId` authoritative | Deriving from spatial graph introduces edge cases and cross-device divergence |
| Cluster merge tie-breaker on equal size | Lower origin index survives — fully deterministic with no coordination |
| Cluster merge origin fixed in world space | Absorbed pieces recompute — deterministic across devices |
| Rotation compatibility required for cluster merge | Prevents half-rotated cluster bugs — snap conditions must be satisfied |
| `RotationConfig` removed entirely | Cardinal rotation is not configurable — a type with only one valid value is not configuration |
| Cardinal rotation only | Free rotation undermines crisp `placed` semantics and deterministic snapping |
| Rotation normalization: wrap then snap | Handles all real number inputs including negatives. Deterministic across engines. |
| Engines MUST write only normalized `rot` | Prevents lazy-write implementations. Normalization on load is legacy safety net only. |
| Random cardinal rotation at game creation | Physical scattered appearance. Engine concern — not defined by dissection. |
| No rotation interaction on bench | Bench is a staging area. Rotation becomes active on extraction. |
| `rot` persists for bench pieces | Rotation is playthrough state even before extraction |
| `pos` absent iff `STAGE_BENCH` | Bench layout is ephemeral and engine-owned |
| Single global coordinate space | No transforms on stage transition. Clusters trivial. No drift. |
| `pos` stability scoped to non-bench transitions | Bench → table creates pos for the first time — no-transform rule applies between non-bench stages only |
| Global coordinate space engine-defined | No implicit normalization assumed. Origin and scale are engine concerns. |
| `meanColor` immutable on `PieceDefinition` | Palette mapping is runtime — regenerating palette touches one array not 500+ records |
| sRGB + Euclidean distance | Deterministic palette mapping across clients |
| `palette` on `JiggAssembly` only | Playthrough concern — product is not affected |
| `palette` persists on assembly | Playthrough preference — user's centroid choices survive reload |
| Integrity severity tiers | Metadata changes don't corrupt a 90%-complete save |
| Runtime dissection is sovereign | User chose their cut — artist default changes are informational only |
| `assemblyHash` over exact bytes, no normalization | Removes ambiguity across serializers — any reformatting produces a different hash |
| `assemblyHash` on header | Self-healing cache — detects stale header without full assembly parse |
| `completed` derived not stored | Eliminates sync risk — always computable from placedCount and pieceCount |
| Single JiggState per .jigg | v1 simplicity. New game overwrites. Multiple playthroughs deferred. |
| `JiggGlue` mismatch is fatal | Prevents rehydrating state onto a different puzzle |
| Filename is UX only | Consumers always key on internal uri |

---

## 12. Deferred

- **Tags** — controlled vocabulary tag registry. TagId type and TAG_REGISTRY
  planned in future tags.ts.
- **`.jiggcut` template packs** — JiggDissection will add cutId and cutVersion.
  Templates remain snapshotted inline for game integrity.
- **Attribution Registry** — maps JiggUri to full entity records.
- **Multiplayer / conflict resolution** — JiggGlue.uri enables sync.
  Merge precedence deferred pending multiplayer requirements.
- **Deterministic clusterId** — hash(sorted(pieceIds)) for deterministic merge.
  Deferred pending multiplayer requirements.
- **Free rotation** — not part of the model. Revisit only if creative or
  aesthetic modes are introduced post-launch.
- **Multiple playthroughs per puzzle** — a .jigg currently holds at most one
  JiggState. JiggGlue.uri is the extension point if replay history is
  required post-launch.
- **Formal invariants** — machine-checkable rules. Future validation layer.
- **Version migration strategy** — specVersion exists as the signal.
  Forward/backward compatibility contract deferred until first breaking change.
