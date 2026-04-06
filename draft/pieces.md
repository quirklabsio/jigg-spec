# Pieces

`pieces.json` defines the geometry of all puzzle pieces for **explicit geometry puzzles
only** — those where `puzzle.pieces` is present in `manifest.json`. It is absent from
procedural grid archives.

`pieces.json` is the authoritative source for piece count. The length of the `pieces`
array is the piece count. `manifest.json` carries no `pieceCount` field.

## Purpose

Each piece entry contains:
- The **vector die-line** — an SVG path defining the cut shape
- The **canonical position** — where the piece lives in the solved image (normalized)
- Optional **metadata** — whimsy labels and other implementation-defined fields

This is the "sheet of glass" model: the source image is treated as a flat sheet, and the
SVG paths are die-lines cut through it. A reader clips the image with each path to render
individual pieces.

---

## Coordinate System

All transform positions use **normalized coordinates** relative to image dimensions:
- `(0.0, 0.0)` = top-left of the source image
- `(1.0, 1.0)` = bottom-right of the source image
- Values outside `[0.0, 1.0]` are valid (pieces scattered beyond the image boundary in play space)

**Pixel ↔ normalized conversion:**
```
normalizedX = pixelX / image.width
normalizedY = pixelY / image.height
```

**SVG path data** is expressed in **absolute image pixel coordinates** — paths are geometry
tied to the image, not to display space. Normalized coordinates apply to transforms only.

---

## Pivot Point

The rotation origin for every piece is its bounding box center, which is the piece's
canonical `(x, y)` position. No additional `originX`/`originY` fields are needed.

Rotation in the solved state is always `0`. Rotation in play space is recorded in
`.jiggstate`.

---

## Piece Definition

```ts
interface Piece {
  id: string          // stable identifier, unique within the puzzle
  path: string        // SVG path data in absolute image pixel coordinates
  canonical: {
    x: number         // normalized [0.0, 1.0] — bounding box center x
    y: number         // normalized [0.0, 1.0] — bounding box center y
    rotation: number  // degrees [0, 360) — always 0 in solved state
  }
  metadata?: {
    shapeName?: string           // whimsy label e.g. "Bird", "Star"
    [key: string]: unknown       // implementation-defined extensions
  }
}
```

**`actual`, `groupId`, and `scale` are not part of the piece definition.** Runtime state
(current position, rotation, z-order, cluster membership) lives in `.jiggstate`.
Scale is a display/rendering concern handled by the viewer, not a geometry property.

---

## SVG Path Requirements

The `path` field MUST:
- Be a valid SVG path data string
- Use only the commands: `M`, `L`, `C`, `Q`, `Z`
- Be closed (end with `Z`)
- Use absolute image pixel coordinates

Permitted curve types:
- `C` — cubic Bézier (preferred for smooth interlocking tab/blank curves)
- `Q` — quadratic Bézier
- `L` — straight line segment (valid for edge/corner pieces)

---

## Rotation Convention

- Degrees, normalised to `[0, 360)`
- Export to `.jigg`: multiply radians by `(180 / π)`
- Import from `.jigg`: multiply degrees by `(π / 180)`

---

## Formal Schema

`schema/pieces.schema.json` is the normative schema for this format.

## pieces.json Shape

```json
{
  "pieces": [ Piece[] ]
}
```

The `pieces` array is the authoritative source for piece count. `pieceCount` in
`manifest.json` is a non-authoritative hint.

---

## TODO

- [ ] Tolerance field for snap validation — spec-level or implementation-defined?
