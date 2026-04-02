# Manifest

`manifest.json` is the central entry point for all puzzle data.
Every file in the archive is referenced from here.

## Top-level keys

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
- `pieceCount`: integer hint. **Not authoritative.**
  The source of truth for piece count is `pieces.json`.
- `pieces`: reference to piece geometry file
- `solved`: reference to canonical solved positions.
  Immutable. Part of the puzzle definition, not the state.

### `state`
Optional. References the user progress file.
A `.jigg` without a `state` key is a valid, shareable puzzle definition.

### `metadata`
Informational only. No functional role.
- `title`: human-readable puzzle name

## Example

```json
{
  "version": "0.1",
  "puzzle": {
    "image": {
      "type": "embedded",
      "src": "image.jpg",
      "width": 4000,
      "height": 3000
    },
    "pieceCount": 500,
    "pieces": { "source": "pieces.json" },
    "solved": { "source": "solved.json" }
  },
  "state": {
    "source": "state.json"
  },
  "metadata": {
    "title": "Untitled Puzzle"
  }
}
```
