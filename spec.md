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
- Locked types: `artist`, `org`, `puzzle`, `state` — no open string fallback
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

Three classes of stages:

**`STAGE_TABLE = "table"`** — the primary workspace
- Infinite, pannable
- Where pieces are freely moved, clustered, organised
- Where pieces lock when `placed === true`
- Bidirectional with user trays
- Named for interaction behavior, not correctness role
- Correctness is owned by `placed: boolean` — not the stage

**`STAGE_BENCH = "bench"`** — the system origin stage
- All pieces start here at game creation
- Remove-only once exited — pieces flow out, never back in
- Engine must reject any move where `targetStageId === STAGE_BENCH`
  unless `sourceStageId === STAGE_BENCH` (rearranging within bench allowed)
- Not user-owned, not user-created

**User trays** — `string` (NanoID 8 chars e.g. `"V1StGXab"`)
- Named, user-defined, organisational
- Bidirectional with table and other user trays
- Engine must never generate a user tray ID of `"table"` or `"bench"`

Ghost tray safety net: if `PieceState.stageId` references a stage that no
longer exists in `stages[]`, engine moves those pieces back to `STAGE_TABLE`.

Movement rules:
- `STAGE_BENCH → STAGE_TABLE`: allowed
- `STAGE_BENCH → user tray`: allowed
- `STAGE_TABLE ↔ user tray`: allowed
- `Anywhere → STAGE_BENCH`: rejected

Narrative: `bench → table → placed`

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

`RotationConfig` discriminated union:
- `cardinal` — snaps to 0/90/180/270, stored as index 0|1|2|3
- `free` — stored as degrees [0, 360)
- Mode set at game creation, never changes for this playthrough

Palette logic:
- Absent = engine uses meanColor directly for filtering
- Present = engine maps meanColor to nearest centroid (Euclidean, sRGB)
- Regeneration updates palette array only — no piece records touched

`playTimeSeconds`:
- Active play time in seconds. Source of truth on assembly.
- Engine increments during active interaction only.
- Pauses on idle / tab hidden / app backgrounded.
- Cannot be reconstructed after the fact — must be tracked explicitly.
- Each player's .jiggstate tracks their own time independently.

`PieceState`:
- `stageId` is always explicit — never absent
- All pieces initialised to STAGE_BENCH at game creation
- `placed === true` implies `stageId === STAGE_TABLE` and `clusterId` absent

Cluster model:

clusterId is authoritative state, generated at snap time using NanoID(8).
On save: write each piece's current group ID as clusterId.
On load: group pieces by clusterId to reconstruct runtime groups.
Derive group origin from the lowest PieceDefinition.index member's world pos.
All other members' local offsets are computed from that origin.

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

Progress metrics:
- `placedCount` — pieces correctly solved at canonical position.
  Exact canonical match. Never loosened.
- `assemblyProgress` — `1 - (clusterCount - 1) / (pieceCount - 1)`.
  0.0 = all pieces separate. 1.0 = single cluster.
  Guard required: undefined when pieceCount === 1.
- `playTimeSeconds` — cached on header from assembly on every save.

Status derivation (engine and UI must follow):
- `lastSavedAt` absent → "not-started"
- `lastSavedAt` present + `completed === false` → "in-progress"
- `completed === true` → "completed"

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

`JiggHeader`:
- `uri` — references JiggManifest.uri
- `specVersion` — for parsing
- `title`, `displayCredit`, `aspectRatio` — cached from manifest at import
- `pieceCount` — cached from dissection, never changes after game creation
- `placedCount`, `assemblyProgress`, `playTimeSeconds` — cached on every save
- `completed` — true when placedCount === pieceCount
- `lastSavedAt` — absent until first save. Presence = started.

Authoritative sources:
- puzzle.jiggsaw → uri, title, displayCredit, aspectRatio, pieceCount
- state.jiggstate → placedCount, assemblyProgress, playTimeSeconds,
  completed, lastSavedAt

---

## 9. Filename Convention

Pattern: `{slug}_{shortId}.{ext}` e.g. `autumn-forest_550e8400.jigg`
Filename is UX only — consumers MUST key on internal `uri`.
Applies to all three formats.

---

## 10. Engine Conventions

Rules not enforceable by the type system — engine must implement:

- All pieces initialised to STAGE_BENCH at game creation
- Engine must never assign `"table"` or `"bench"` as a user tray ID
- Movement to STAGE_BENCH rejected unless source is also STAGE_BENCH
- Ghost tray: pieces referencing missing stageId move to STAGE_TABLE
- placed === true implies stageId === STAGE_TABLE and clusterId absent
- assemblyProgress guard: return undefined or 1.0 when pieceCount === 1
- Rotation mode set once at game creation — never mutated on assembly
- Only cardinal rotation exists. RotationConfig = { mode: "cardinal" }.
  Free rotation is not part of the model.
- Engines MUST write only normalized values to PieceState.rot.
  Normalization on load is a safety net for invalid or legacy data only.
  Normalization steps, applied in order:
  1. Wrap input to [0, 360) — handles negative values and values ≥ 360
  2. Snap to nearest of {0, 90, 180, 270} using angular distance modulo 360
  3. Ties round to the next clockwise cardinal
- playTimeSeconds increments only during active interaction
- clusterId is NanoID(8) — generated fresh at every snap event
- displayCredit derived from credit if present, else attributions[0].name
- Reserved stage strings: "table" and "bench" must not be used as user tray IDs

---

## 11. Key Architectural Decisions

| Decision | Rationale |
|---|---|
| `.jigg` is the only user format | Users never handle .jiggsaw or .jiggstate directly |
| Holy Trinity uncompressed | Zero-decompression shelf rendering |
| `glue.json` uncompressed in .jiggstate | Fast-fail identity check before decompression |
| `JiggManifest` not `JiggSawManifest` | Concept-only naming throughout. Manifest belongs to the puzzle, not the format container. |
| `JiggGlue` named after puzzle glue | Physical metaphor — permanently seals playthrough to puzzle. Written once, never mutated. |
| `glue.json` named after puzzle glue | Physical metaphor — seals playthrough to puzzle permanently |
| No header on .jiggstate | Progress lives in .jigg header |
| `SpecVersion` not SemVer | Patch versions meaningless for a file format |
| `JiggUri` locked type union | No open string fallback — new types require spec change |
| `JiggUri` over UUID | Self-describing, portable, offline-first, no remapping on publish |
| `artist` vs `org` URI types | Distinct marketplace browsing — by person vs by institution |
| `STAGE_TABLE` named for interaction | Stage names reflect behavior, not correctness semantics |
| `placed: boolean` owns correctness | Decoupled from stage identity — table is just a workspace |
| `STAGE_BENCH` remove-only | One-way valve — pieces never return once extracted |
| `stageId` always explicit | Eliminates undefined/bench ambiguity in serialization |
| `meanColor` immutable on PieceDefinition | Palette mapping is runtime — regenerating palette touches one array not 500+ records |
| sRGB + Euclidean distance | Deterministic palette mapping across clients |
| `palette` on JiggAssembly only | Playthrough concern — product is not affected |
| Integrity severity tiers | Metadata changes don't corrupt a 90%-complete save |
| Runtime dissection is sovereign | User chose their cut — artist default changes are informational only |
| `RotationConfig` discriminated union | Forces mode decision at game creation — avoids floating-point bugs |
| Clusters derived at runtime | clusterId shared value sufficient — explicit cluster records redundant |
| Cluster reconstruction convention | Lowest PieceDefinition.index is group origin — deterministic |
| Cluster merge tie-breaker on equal size | Lower origin index survives. Fully deterministic across devices with no coordination. |
| Bench-entry `clusterId` rule removed | Dead code — bench is one-way, re-entry is impossible. Invariant alone is sufficient. |
| NanoID(8) for clusterId | Collision-free across devices without central authority |
| Engines MUST write only normalized `rot` | Prevents lazy-write implementations. Normalization on load is legacy safety net only. |
| `assemblyProgress` cached on header | Structural completion visible on shelf without decompression |
| `playTimeSeconds` on assembly | Cannot be reconstructed — must be tracked explicitly |
| Per-player playTimeSeconds | Each .jiggstate tracks independently — multiplayer safe |
| Status derived from lastSavedAt + completed | No separate status field needed |
| `dissectedAt` absent | Not consistently meaningful across both dissection contexts |
| `whimsies` in dissection only | Manifest signals cutStyle; dissection owns the shapes |
| `credit` + `attributions[]` both present | Structured (machine) vs verbatim (legal) attribution |
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
  Deferred pending multiplayer.
- **Floating point precision for free rotation** — define rounding convention
  to prevent snap comparison drift. Engine convention, not type.
- **Formal invariants** — machine-checkable rules. Future validation layer.
- **Version migration strategy** — specVersion exists as the signal.
  Forward/backward compatibility contract deferred until first breaking change.
- **Multiple playthroughs UI** — JiggGlue.uri is the identity anchor when needed.
