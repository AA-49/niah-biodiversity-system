# Item 14 test results: plant schema and CRUD

Run on 15 October 2026 on the `item-14-16-integration` branch against the
shared Supabase project.

## Automated checks

| Check | Command | Result |
| --- | --- | --- |
| Website lint | `cd web; npm.cmd run lint` | Pass |
| Website build | `cd web; npm.cmd run build` | Pass. Only the existing Atkinson Hyperlegible font fallback warnings were printed |
| Diff whitespace | `git diff --check` | Pass |

## Database checks

- The item-14 schema and seed data contain 6 species and 6 records.
- The idempotent `supabase/004_security_hardening.sql` migration was applied
  in the hosted Supabase SQL editor.
- `species_public` and `records_public` are available to the public API.
- Direct anonymous REST reads of `species.coordinates_exact` return HTTP 401.
- Direct anonymous REST reads of `records.gps` return HTTP 401.
- Public `species_public` reads return catalog fields without
  `coordinates_exact`.
- Public `records_public` reads return snapped grid coordinates with
  `accuracyM: 440`, not the stored GPS point.
- Species writes are limited by RLS to conservation officers and admins.
- Record inserts are limited to botanists, conservation officers, and admins.
- Record updates are limited to conservation officers and admins.
- New profiles created by the signup trigger always receive the `visitor`
  role; agency and display name metadata remain supported.

## Notes

The public website now reads from the coordinate-free views. Staff-only views
are available for future server-authorized dashboard workflows. The browser
never receives the exact species or record coordinates.
