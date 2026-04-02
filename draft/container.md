# Container

A `.jigg` file is a ZIP archive with the `.jigg` extension.

## Required files

- `mimetype` — must be the first file in the archive, stored
  uncompressed, contains exactly `application/jigg+zip` with no newline
- `manifest.json` — central manifest, references all other files

## Optional files

All other files are referenced from `manifest.json`.
Their presence depends on manifest content.

## mimetype placement

The `mimetype` file must be the first entry in the ZIP and must be
stored without compression. This follows the convention established
by ODF and EPUB for magic-byte identification without full extraction.

## TODO
- [ ] Checksum/integrity strategy undecided — candidates:
  manifest checksum field, sidecar .sig file, none
- [ ] Preview/thumbnail undecided — candidates:
  embedded thumbnail.jpg, generated on open, none
