# State

`state.json` records user progress. It is entirely optional.

## Purpose

State captures where the user is in solving the puzzle —
which pieces have been placed, where unplaced pieces are,
and how pieces have been grouped together.

## Known required fields (shapes undefined)

- Per-piece current position — TODO: schema undefined
- Per-piece rotation — TODO: schema undefined
- Piece grouping (connected pieces that move together) — TODO: schema undefined
- Per-piece z-order — TODO: schema undefined
- Completion status — TODO: schema undefined

## Design notes

- State is layered on top of the immutable puzzle definition
- A puzzle can be shared without state — recipient starts fresh
- State can be saved and resumed across sessions and devices

## TODO
- [ ] State versioning strategy undecided
- [ ] Partial state validity undecided (can state reference
  piece IDs not in pieces.json?)
- [ ] Conflict resolution undecided (two devices, same puzzle)
