# Manifest

`manifest.json` is the central entry point for all puzzle data.
Every file in the archive is referenced from here.

## Top-level keys

### `id`
UUID v4. Identifies the puzzle definition. Assigned at creation and stable forever —
downloading the same puzzle twice produces the same `id`.

Used by library applications to deduplicate puzzles and associate saved progress with the
correct puzzle definition. Not a content hash — the `id` doesn't change if metadata is
updated. Not a session or file identifier — it identifies *what the puzzle is*, not a
particular copy or playthrough.

### `version`
Spec version string. Currently `"0.1"`.
Used to detect breaking changes on open.

### `puzzle`
Immutable puzzle definition. Once a `.jigg` is created,
this section must not change. It defines what the puzzle is.

- `image` — source image reference
  - `type`: `"embedded"` (file inside zip) or `"external"` (URL)
  - `src`: filename or URL
  - `width`, `height`: pixel dimensions
  - `checksum`: SHA-256 checksum of the image file bytes. Required. See [Checksums](#checksums).
- `pieceCount`: integer hint. **Not authoritative.**
  The source of truth for piece count is `pieces.json`.
- `pieces`: reference to piece geometry file
  - `source`: filename
  - `checksum`: SHA-256 checksum of `pieces.json`. Required. See [Checksums](#checksums).
- `solved`: reference to canonical solved positions.
  Immutable. Part of the puzzle definition, not the state.
  - `source`: filename
  - `checksum`: SHA-256 checksum of `solved.json`. Required. See [Checksums](#checksums).

## Checksums

Each resource reference carries a `checksum` field describing the integrity of that
specific file. This keeps integrity data co-located with the resource it describes, and
scales uniformly to any future resource added to the format.

**Format:** `sha256:` followed by exactly 64 lowercase hexadecimal characters.
Example: `sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`

**What gets hashed:** raw file bytes prior to any container encoding or transformation
(i.e. before ZIP compression; no decoding or normalization is applied).

**Algorithm:** SHA-256 is the only supported algorithm in v0.1. Values with other prefixes
(e.g. `sha512:`) MUST be rejected as invalid. The `sha256:` prefix exists to allow
algorithm agility in future versions without a breaking field rename.

**Verification:** Readers MUST verify each resource checksum on load and MUST reject the
file if any checksum does not match.

The `image.checksum` additionally serves as the canonical identity for the source image —
used for library deduplication and marketplace verification.

### `state`
Optional. References the user progress file.
A `.jigg` without a `state` key is a valid, shareable puzzle definition.

### `metadata`
Informational only. No functional role.
- `title`: human-readable puzzle name

## Example

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "version": "0.1",
  "puzzle": {
    "image": {
      "type": "embedded",
      "src": "image.jpg",
      "width": 4000,
      "height": 3000,
      "checksum": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    "pieceCount": 500,
    "pieces": {
      "source": "pieces.json",
      "checksum": "sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
    },
    "solved": {
      "source": "solved.json",
      "checksum": "sha256:f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5"
    }
  },
  "state": {
    "source": "state.json"
  },
  "metadata": {
    "title": "Untitled Puzzle"
  }
}
```
