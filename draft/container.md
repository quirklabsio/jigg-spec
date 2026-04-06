# Container

A `.jigg` file is a ZIP archive with the `.jigg` extension.

## Required files

- `mimetype` — must be the first file in the archive, stored
  uncompressed, contains exactly `application/jigg+zip` with no newline
- `manifest.json` — central manifest, references all other files
- `image.jpg` (or similar) — the source image, referenced from `manifest.json`

## Optional files

- `pieces.json` — present only when `puzzle.pieces` is set in `manifest.json` (explicit geometry). Absent for procedural grid puzzles.
- `thumb.jpg` — low-resolution proxy image. Recommended. Used by library gallery views
  for fast rendering without extracting or decoding the full source image. Referenced
  from `metadata.thumbnail` in the manifest.

All optional files are referenced from `manifest.json`. Their presence depends on manifest content.

## mimetype placement

The `mimetype` file must be the first entry in the ZIP and must be
stored without compression. This follows the convention established
by ODF and EPUB for magic-byte identification without full extraction.

## Thumbnail guidelines

When present, `thumb.jpg` SHOULD be:
- JPEG format
- No larger than 512×512 pixels (maintaining aspect ratio)
- Sufficient quality for gallery display (JPEG quality 70–85 is typical)

Producing a thumbnail is the responsibility of the puzzle authoring tool, not the reader.
Readers MUST NOT fail to open a `.jigg` if `thumb.jpg` is absent.
