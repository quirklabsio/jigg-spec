# Accessibility — Keyboard Navigation Model

**Status:** Spec complete. Implementation begins Story 40.
**Spike:** See engine implementation at `docs/spike-keyboard-focus.md` (Story 38).

---

## 1. ARIA Landmark Structure

```html
<div role="application"
     aria-label="Piece bench — 5 Palette Groups"
     id="landmark-bench">
  <!-- hidden buttons for bench pieces -->
</div>
<div role="application"
     aria-label="Puzzle table — N pieces on table"
     id="landmark-table">
  <!-- hidden buttons for on-table pieces -->
</div>
```

`role="application"` suppresses AT shortcut keys — correct for canvas-driven widgets
where the app owns all key events. `role="region"` does not suppress AT shortcuts
and is wrong here. `role="grid"` carries implicit ARIA semantics (`gridcell`, `row`)
that would need to be mirrored in DOM structure — unnecessary complexity.

`#landmark-bench` DOM order before `#landmark-table` — natural tab flow from bench
into table. Tabbing from the last bench button goes directly to the first table
button (or piece/cluster). No intermediary "switch region" button needed.

`aria-label` on the table landmark updates reactively with on-table piece count.
When the bench is closed, bench buttons get `tabIndex="-1"` — the landmark is
skipped in tab order.

Screen reader landmark navigation:
- NVDA: `D` key jumps to next landmark — "Piece bench, application" then
  "Puzzle table, application".
- VoiceOver macOS: `VO+U` rotor shows both regions as named landmarks.
- VoiceOver iOS: swipe to next landmark.

---

## 2. ARIA Label Format — Single Pieces

```
"Piece {index} — Palette {paletteIndex + 1}, row {gridRow + 1}, column {gridCol + 1}, {stageLabel}"
```

Where `stageLabel`:
- `stageId === STAGE_BENCH` → `"In bench"`
- `stageId === STAGE_TABLE && !placed` → `"On table"`
- `placed === true` → `"Placed"`

Example: `"Piece 42 — Palette 3, row 5, column 6, In bench"`

Field order rationale:
- `index` first — matches the visual piece label (Story 37b) the user sees on
  screen. Consistency between visual and auditory identity.
- `Palette N` second — bridges greyscale mode (`P3` visual label) with screen
  reader announcement. Works without colour perception.
- Grid coords third — spatial reference for board context.
- State last — orientation, not identity.

---

## 3. ARIA Label Format — Clusters

```typescript
// ≤5 members — list piece numbers:
"Group of {n} — pieces {index1}, {index2}, {index3}, On table"

// >5 members — summarise spatially:
"Group of {n} — rows {minRow}–{maxRow}, columns {minCol}–{maxCol}, On table"
```

Cluster = single tab stop. Primary piece = lowest `PieceDefinition.index` in the
cluster. All other member piece buttons receive `tabIndex="-1"`. This is consistent
with the spec's cluster merge tie-breaker (lowest index survives as origin).

Focus ring wraps the full cluster AABB in screen space — not a single piece
bounding box.

---

## 4. Key Binding Map

| Key | Bench context | Table context | Notes |
|---|---|---|---|
| `Tab` | Next bench piece | Next table piece/cluster | Browser native — no handler needed |
| `Shift+Tab` | Previous bench piece | Previous table piece/cluster | Browser native |
| `Enter` | Spiral extract | Pick up / put down | Never zoom-to-place |
| `Space` | Spiral extract | Pick up / put down | `preventDefault()` required — blocks page scroll |
| `ArrowLeft/Right` | Scroll bench | Move held piece | Context-sensitive |
| `ArrowUp/Down` | Navigate bench rows | Move held piece | Context-sensitive |
| `Escape` | Deselect, return to landmark | Drop held piece, return to table button | No browser conflict |
| `T` | Toggle bench | Toggle bench | Safe in `role="application"` |
| `R` | — | Rotate focused piece 90° CW | No bench action |
| `Shift+B` | Background cycle | Background cycle | No AT conflict |

`Space` conflict resolution — add `keydown` handler on both landmark containers:

```typescript
landmark.addEventListener('keydown', (e) => {
  if (e.key === ' ') e.preventDefault()
})
```

Arrow key snap behaviour: no snap or cluster merge mid-movement. Snap evaluated
on put-down (Enter/Space) only. Matches the pointer drag model — snap fires on
drop, not mid-drag.

`Enter` and zoom-to-place: `zoomToPlacePiece()` is never called from keyboard
handlers. Zoom-to-place is a pointer-only preview action. Keyboard Enter always
triggers spiral extraction. A dedicated zoom preview key is deferred post-Story 42.

---

## 5. Stage Layer Order — Engine Requirement

```
app.stage children (in render order):
  1. viewport          (world space  — zIndex: 0)
  2. benchContainer    (screen space — zIndex: 500)
  3. focusRing         (screen space — zIndex: 1000, always topmost)
```

`focusRing` must be added to `app.stage` after both `viewport` and
`benchContainer`. The ring rendering above the bench during extraction animation
is intentional — the virtual cursor must remain visible regardless of UI occlusion.

---

## 6. Focus Ring Specification

```typescript
const FOCUS_RING_COLOR     = 0xff00ff  // neon magenta — matches SNAP_HIGHLIGHT_COLOR_HC
const FOCUS_RING_THICKNESS = 2         // screen-space pixels, non-scaling
const FOCUS_RING_PADDING   = 4         // pixels outside piece bounding box
```

Implementation requirements:
- Single shared `Graphics` object on `app.stage` — not per-piece.
- Redrawn each frame at focused piece screen position.
- Non-scaling: lives in screen space, not inside `viewport`.
- Table pieces: position via `viewport.toGlobal(sprite.getGlobalPosition())`.
- Bench pieces: position via `sprite.getGlobalPosition()` directly (already screen
  space).
- For clusters: ring wraps full cluster AABB in screen space.
- No animation. `reducedMotion` has no effect — the ring is already static.
- HC mode: neon magenta is already the HC snap colour. No change needed.

---

## 7. Story 40 Target API

```typescript
// src/utils/aria.ts target API (to be implemented in Story 40)
initLandmarks(): void
initBenchButtons(pieces: Piece[]): void
initTableButtons(pieces: Piece[]): void
updateButtonLabel(piece: Piece): void
removeButton(pieceId: string): void
setButtonTabIndex(pieceId: string, n: 0 | -1): void
focusButton(pieceId: string): void
scrollBenchToId(pieceId: string): void
```

---

## 8. Deferred — Conscious Omissions

- **zoomToPlace preview key** (non-Enter) — TBD post-Story 42. Enter is always
  spiral extract; a separate "show me where this piece goes" key is deferred.
- **`aria-description` colour hint per palette group** — e.g. "Palette 1:
  predominantly blue pieces". Requires HSL conversion + colour naming heuristic.
  Post-launch enhancement.
- **Non-scaling piece labels below 0.3× zoom** — unreadable at extreme zoom out.
  Post-launch, P3.
- **Return-to-bench mechanic** — post-launch pending user feedback.
- **`@jigg/types` npm package** — publish when spec stabilises post-launch.
