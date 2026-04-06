# Manifest

`manifest.json` is the central entry point for a `.jigg` archive.

## Design principle

The manifest is intentionally minimal. It contains only what the engine cannot derive
or infer: stable identity, spec version, the image asset, and optionally a pointer to
geometry. Everything else is either in `metadata` (UI hints) or in `.jiggstate`
(session data).

## Top-level keys

### `id`
UUID v4. Identifies the puzzle definition. Assigned at creation, stable forever.
Used by libraries to deduplicate puzzles and by `.jiggstate` to verify it belongs
to the correct puzzle.

### `version`
Spec version string. Used to detect breaking changes on open.

### `metadata`
UI hints only. The engine never relies on these fields to function. Safe to ignore.

| Field | Type | Purpose |
|-------|------|---------|
| `title` | string | Human-readable puzzle name |
| `aspectRatio` | number | Pre-computed `width / height`. Library UI uses this to allocate layout space before the image loads. `image.width` / `image.height` are authoritative. |
| `thumbnail.path` | string | Internal path to `thumb.jpg`. Absent if no thumbnail was produced. |
| `thumbnail.hash` | string | SHA-256 of `thumb.jpg`. Advisory — mismatch does not fail the load. |

### `puzzle`
The functional definition. Every file reference carries a `hash` field for
integrity verification. See [Hashes](#hashes).

- **`image`**
  - `source`: where the image data lives
    - `"embedded"` — file is inside the ZIP. Library has it on hand.
    - `"url"` — `path` is an HTTP/HTTPS URL. Engine must fetch; library handles absence.
    - *(reserved)* `"local-fs"` — local filesystem path. Not defined in v0.1.2.
  - `path`: filename within the archive (`embedded`) or full URL (`url`)
  - `hash`: SHA-256 of the image file bytes. See [Hashes](#hashes).
  - `width`, `height`: pixel dimensions

- **`pieces`** *(optional object)*
  - **Present** → explicit geometry. Engine loads SVG die-lines from `path`.
    Piece count is the length of the `pieces` array inside the file.
  - **Absent** → procedural grid. Engine generates a standard grid at session start.
    Grid dimensions and piece IDs are recorded in `.jiggstate`.
  - `path`: filename within the archive (e.g. `"pieces.json"`)
  - `hash`: SHA-256 of `pieces.json`. See [Hashes](#hashes).

No `type` field. The presence or absence of `pieces` is the signal.

## Hashes

Every embedded file reference carries a `hash` field for integrity verification
and content-addressable identity.

**Format:** `sha256:` followed by exactly 64 lowercase hexadecimal characters.
Example: `sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`

**What gets hashed:** raw file bytes prior to ZIP compression.

**Algorithm:** SHA-256 only in v0.1.2. Other prefixes MUST be rejected. The `sha256:`
prefix exists for algorithm agility in future versions.

### Validation behaviour on load

| Mismatch | Behaviour |
|----------|-----------|
| `image.hash` | Warn user: "Source image may have changed. Progress may not align." Non-fatal — puzzle loads. |
| `pieces.hash` | **Fatal for state.** Piece IDs and paths no longer match. App enters ReadOnly or prompts Reset. |
| `thumbnail.hash` | Silent. Reload or skip thumbnail. |

The `.jiggstate` also stores a `manifestHash` (hash of `manifest.json`). On load,
the engine compares this against the actual manifest to detect whether anything has
changed since the session was saved. See `jiggstate.md`.

### Content-addressable deduplication

`image.hash` enables the library to detect when two different `.jigg` files embed the
same source image. The app can store one copy in local cache (IndexedDB) and reference
it by hash, avoiding duplicate 50MB assets across a collection.

## Examples

### Explicit geometry (whimsy cut)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "version": "0.1.2",
  "metadata": {
    "title": "Starry Night",
    "aspectRatio": 1.33,
    "thumbnail": {
      "path": "thumb.jpg",
      "hash": "sha256:b94d27b9934d3e08a52e52d7da7dabfac484efe04294e576f6a82e77b2bf7e7a"
    }
  },
  "puzzle": {
    "image": {
      "source": "embedded",
      "path": "image.jpg",
      "hash": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "width": 4000,
      "height": 3000
    },
    "pieces": {
      "path": "pieces.json",
      "hash": "sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
    }
  }
}
```

### Procedural grid, URL-hosted image

```json
{
  "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "version": "0.1.2",
  "metadata": {
    "title": "Mountain Sunset",
    "aspectRatio": 1.33,
    "thumbnail": {
      "path": "thumb.jpg",
      "hash": "sha256:c0d1e2f3a4b5c0d1e2f3a4b5c0d1e2f3a4b5c0d1e2f3a4b5c0d1e2f3a4b5c0d1"
    }
  },
  "puzzle": {
    "image": {
      "source": "url",
      "path": "https://api.artic.edu/api/v1/artworks/images/abc123/full/max/0/default.jpg",
      "hash": "sha256:f5e4d3c2b1a0f5e4d3c2b1a0f5e4d3c2b1a0f5e4d3c2b1a0f5e4d3c2b1a0f5e4",
      "width": 8000,
      "height": 6000
    }
  }
}
```
