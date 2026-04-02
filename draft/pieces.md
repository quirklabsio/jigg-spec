# Pieces

`pieces.json` defines the geometry of all puzzle pieces.
It is the authoritative source for piece count.

## Purpose

Piece geometry determines the shape of every cut edge —
tabs, blanks, and the curves between them. This data is
required to render the puzzle and validate piece placement.

## TODO

Piece geometry schema is the primary unresolved design question
in v0. This will be the likely source of a v0→v1 breaking change.

Considerations:
- [ ] Bounding box only (simple, lossy)
- [ ] Mask references (PNG masks per piece, large but simple)
- [ ] Edge curve definitions (tabs/blanks as Bezier control points —
      compact, precise, matches the reference implementation)
- [ ] Hybrid: bounding box + curve data

The reference implementation (Jigg) uses Bezier cut paths generated
in Rust/WASM. The schema should be able to represent this natively
without lossy conversion.

No schema is defined here until the reference implementation
stabilises post-v1.

---

## Transform model

Every piece has two transforms in two coordinate spaces:
- `canonical` — where it belongs (image/puzzle space, immutable)
- `actual` — where it is (play/world space, mutable)

Both use the same Transform shape.

### Coordinate conventions
- Origin: top-left of solved image
- Axes: +x right, +y down
- Units: pixels
- Rotation: degrees, normalised [0, 360)
- Scale: 1.0 = native size

### Transform shape
```ts
type Transform = {
  x: number
  y: number
  rotation: number  // degrees [0, 360)
  scale: number     // 1.0 = native
}
```

### Piece definition
```ts
interface Piece {
  id: string
  metadata?: Record<string, unknown>

  canonical: Readonly<Transform>   // image space, immutable
  actual: Transform & {
    z: number                      // layering in play space only
  }

  groupId: string | null           // topology, not geometry
}
```

### Rules
1. canonical is authoritative — never changes, defines the solved puzzle
2. actual is runtime state — freely mutable, compared against canonical
   for snapping and validation
3. Transforms are symmetric — same shape, reusable math, no drift
4. Geometry is pure — transforms contain position/rotation/scale only,
   grouping lives outside

### Coordinate boundary note
The spec uses degrees. Reference implementations may use radians
internally. The conversion boundary must be explicit and consistent:
- Export to .jigg: multiply radians by (180 / π)
- Import from .jigg: multiply degrees by (π / 180)

### TODO
- [ ] Transform origin (pivot point) undefined in v0 —
  candidates: always center (0.5, 0.5), explicit originX/originY fields
- [ ] Tolerance field for snap validation — spec-level or
  implementation-defined?
