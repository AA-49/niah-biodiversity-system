# Item 16 test results: plant information display and search (basic)

Run on 15 October 2026 on Deangel's Victus (Windows 11, Node 24.21.0), on the `item-16-plant-search`
branch, against a test Supabase project with the item 14 schema (`001`) and seed data (`002`).

This branch is built on top of `item-14-plant-schema`, because it needs `src/lib/species-db.ts`.

## What this item adds

- The plant list (`/plants`) and each plant page (`/plants/[slug]`) now read from Supabase through
  `species-db.ts`, instead of the files in `src/data`. Without Supabase they still fall back to the
  mock data.
- Plant pages are built when someone asks for them, so a species added to the database gets a page
  without a new build. A slug that isn't in the database is a 404.
- The tagged-plant counts on the list come from `src/lib/records-db.ts`, which only returns counts
  and never coordinates.
- Search is unchanged: common name, Latin name and family, with the search kept in `?q=`.

## Automated checks

Run from `web/`.

| Check | Command | Result |
| --- | --- | --- |
| Website lint | `npm run lint` | Pass |
| Website build | `npm run build` | Pass. `/plants` and `/plants/[slug]` are built on each request |

There are no unit tests for the website yet, so the rest was checked against the running site below.

## Checked against the running site and the database

Pages were requested from the dev server with `curl`, and the HTML was searched. Nobody has looked at
them in a browser for this item yet (see "Not tested yet").

| # | What we did | What should happen | Result |
| --- | --- | --- | --- |
| 1 | Read `species` and `records` with the public key | 6 species and 6 published records from the seed data | Pass |
| 2 | Opened `/plants` | The 6 species from the database, with "Showing all 6 plants". Names from the seed (Kawang jantong, Slipper orchid, Keruing sarawak) show up, the old mock-only ones (Durian kuning) don't | Pass |
| 3 | Searched `?q=orchid` | "Showing 1 of 6 plants" | Pass |
| 4 | Searched `?q=dipterocarpaceae` (a family) | "Showing 2 of 6 plants" | Pass |
| 5 | Searched `?q=zzz` | "No plants match" | Pass |
| 6 | Opened the 6 plant pages | All return 200 | Pass |
| 7 | Opened `/plants/not-a-plant` | 404 | Pass |
| 8 | Searched the HTML of all 6 plant pages for the exact coordinates in `records` | None of them are there. The pages say the exact spot is hidden and show only the rough area | Pass |
| 9 | Opened the Slipper orchid page | Shows the tag NNP-2A1B0C and "1 plant public" | Pass |
| 10 | Timed a search request (`?q=orchid`) | Under 2 seconds (the proposal's target) | Pass, 0.59 s on a dev server on one laptop |

## Not tested yet

| What | Why | Next step |
| --- | --- | --- |
| Looking at the pages in a browser | Checks 2 to 9 read the HTML only | Click through the list and 2 plant pages at desktop width and at 375 px wide, and check nothing scrolls sideways |
| Supabase down or slow | Not simulated | Remove the key from `.env.local` and check the pages fall back to the mock data |
| Records waiting for review | The seed has none, so we haven't checked they stay hidden | Add a `waiting` record in Supabase and check it isn't counted or shown |
| Home page and tag pages | Not part of this item. They still use the mock data | Item 12 |

## Security check

- Pages snap exact coordinates to the grid on the server for threatened and protected species before
  the page is built. Test 8 shows no exact point reached the HTML.
- **The database itself still gives exact points to anyone.** The public key can read `records`, and
  we confirmed it returns the exact `gps` for published records, including for the protected Slipper
  orchid, Pitcher plant and Tapang. It can also read `species.coordinates_exact`. Hiding the point on
  the page doesn't help if someone calls the API directly. This needs a database fix (for example a
  public view without exact coordinates, and no public read of `records.gps`), which is item 4 and
  Andy's schema. Don't put real locations in the database until it's fixed.
- In the seed, every plant is hidden (all are VU, EN or protected), so the "exact point is shown"
  path on plant pages isn't exercised.

## Fixed while testing

Nothing yet.
