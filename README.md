# jigg-spec

Type definitions and file format specification for the `.jigg`, `.jiggsaw`,
and `.jiggstate` file formats.

## Files

- `types.ts` — TypeScript interfaces and types. Source of truth for all
  format contracts.
- `spec.md` — Human-readable specification. Documents structure, rationale,
  and architectural decisions.

## Formats

| Format | Role |
|---|---|
| `.jigg` | User-facing bundle — the only format users interact with |
| `.jiggsaw` | Artist product — immutable, marketplace distributed |
| `.jiggstate` | Playthrough instance — internal to `.jigg` |

## Key Concepts

- `.jigg` always contains a `.jiggsaw`. It is the anchor.
- `.jiggstate` is never distributed standalone.
- Filename is UX only — consumers always key on internal `uri`.
- Holy Trinity (`mimetype`, `header.json`, `thumb.webp`) uncompressed —
  shelf renders without decompression.
- `glue.json` in `.jiggstate` uncompressed — fast-fail identity check
  before decompression.
- `STAGE_TABLE` is the primary workspace. `STAGE_BENCH` is the system
  origin stage — pieces flow out, never back in.
- `placed: boolean` owns correctness — not stage identity.
- `meanColor` is immutable. Palette mapping is runtime.
- Clusters derived at runtime by grouping on `clusterId`. Reconstruction:
  lowest PieceDefinition.index member is group origin.
- `stageId` is always explicit — never absent.
- Status derived: lastSavedAt absent = not-started, present = in-progress,
  completed = true = completed.
- JiggUri type union is locked — artist, org, puzzle, state only.

See `spec.md` for full documentation.
