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

Same puzzle at different points in time = same `id`, different `state` block. The `id`
identifies the definition; state is layered on top. A `.jigg` without a `state` key is a
valid, shareable puzzle definition.

`state` deliberately does not carry a `checksum` — state is mutable by design, and
verifying it against a fixed hash would break on every save.
