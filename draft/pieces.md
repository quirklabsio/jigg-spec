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
