// The copy of the public plant info that lets a visitor scan a tag with no signal. Each download
// replaces the whole copy, and one that fails leaves the old copy alone. Like sync-engine.ts, this
// file doesn't know about Supabase or React, so it can be tested with a fake server
// (src/sync/supabase-public-api.ts is the real one, and src/state/public-copy-context.tsx decides
// when to download). It only reads what the public website shows, and never where a plant is.
import type { RecordsStore } from '@/db/records-store';
import { tagCodeFor } from '@/lib/id';
import { PLANT_CONDITIONS, type PlantCondition } from '@/types/plant-record';
import { isIucnCode, type PublicRecord, type PublicSpecies } from '@/types/public-copy';

/** One row of the species_public view, with the columns the plant page uses. */
export type SpeciesPublicRow = {
  id: string | null;
  scientific_name: string | null;
  authority: string | null;
  family: string | null;
  common_names: unknown;
  iucn_code: string | null;
  sarawak_protected: boolean | null;
  newer_name: string | null;
  summary: string | null;
  about: string | null;
  description: string | null;
  habitat: string | null;
  uses: string | null;
};

/** One row of the records_public view, without its location. */
export type RecordsPublicRow = {
  id: string | null;
  tag_code: string | null;
  species_slug: string | null;
  species_name: string | null;
  common_name: string | null;
  height_m: number | string | null;
  condition: string | null;
  recorded_at: string | null;
};

function text(value: unknown) {
  return typeof value === 'string' ? value : '';
}

/** The text as the server sent it, or undefined if it's empty or only spaces. */
function filled(value: unknown) {
  const written = text(value);
  return written.trim() ? written : undefined;
}

function isCondition(value: unknown): value is PlantCondition {
  return (PLANT_CONDITIONS as readonly unknown[]).includes(value);
}

/** The time as an ISO 8601 timestamp, or null if it isn't one. */
function isoDate(value: unknown) {
  // JavaScript only promises to read exactly three digits after the second, and Postgres sends
  // anywhere from one to six, so they're padded or cut to three first.
  const written = text(value).replace(
    /\.(\d+)/,
    (_, digits: string) => `.${digits.padEnd(3, '0').slice(0, 3)}`,
  );
  const date = new Date(written);
  return written && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

/** The species the plant page can show. A row with no ID or no scientific name is left out. */
export function speciesFromServer(rows: SpeciesPublicRow[]): PublicSpecies[] {
  const seen = new Set<string>();
  return rows.flatMap((row) => {
    // Records point to the ID exactly as it is, so it isn't trimmed.
    const slug = text(row.id);
    const scientificName = filled(row.scientific_name);
    if (!slug.trim() || seen.has(slug) || !scientificName) {
      return [];
    }
    seen.add(slug);
    return [
      {
        slug,
        scientificName,
        authority: text(row.authority),
        family: text(row.family),
        commonNames: Array.isArray(row.common_names)
          ? row.common_names.filter((name): name is string => filled(name) !== undefined)
          : [],
        // The website shows a code it doesn't know as Not Evaluated, so the phone does too.
        iucnCode: isIucnCode(row.iucn_code) ? row.iucn_code : 'NE',
        sarawakProtected: row.sarawak_protected === true,
        newerName: filled(row.newer_name),
        summary: text(row.summary),
        // Older species only have a description, and the website shows that instead.
        about: text(row.about) || text(row.description),
        habitat: text(row.habitat),
        uses: text(row.uses),
      },
    ];
  });
}

/** The records the plant page can show. A row with no ID, no name or no date is left out. */
export function recordsFromServer(rows: RecordsPublicRow[]): PublicRecord[] {
  const seen = new Set<string>();
  return rows.flatMap((row) => {
    const id = text(row.id);
    const speciesName = filled(row.species_name);
    const recordedAt = isoDate(row.recorded_at);
    if (!id.trim() || seen.has(id) || !speciesName || !recordedAt) {
      return [];
    }
    seen.add(id);
    const heightM = Number(row.height_m);
    return [
      {
        id,
        // The website makes the same code from the ID when a record has none.
        tagCode: filled(row.tag_code) ?? tagCodeFor(id),
        speciesSlug: filled(row.species_slug),
        speciesName,
        commonName: filled(row.common_name),
        heightM: Number.isFinite(heightM) && heightM > 0 ? heightM : undefined,
        condition: isCondition(row.condition) ? row.condition : undefined,
        recordedAt,
      },
    ];
  });
}

/** What the download needs from the server. src/sync/supabase-public-api.ts is the real one. */
export type PublicCopyApi = {
  /** False when the phone knows it has no signal, so there's no point asking the server. */
  online: () => Promise<boolean>;
  /** Every species the website shows, or null if the server couldn't be read. */
  fetchSpecies: () => Promise<SpeciesPublicRow[] | null>;
  /** Every published record, without its location, or null if the server couldn't be read. */
  fetchRecords: () => Promise<RecordsPublicRow[] | null>;
};

export type PublicCopyStore = Pick<RecordsStore, 'replacePublicCopy'>;

/** Done means the copy was replaced. Anything else means the old copy is still there. */
export type DownloadOutcome = 'done' | 'offline' | 'failed';

/** Downloads the public plant info and swaps it in for the copy on the phone. Never throws. */
export async function downloadPublicCopy(
  api: PublicCopyApi,
  store: PublicCopyStore,
  now = () => new Date().toISOString(),
): Promise<DownloadOutcome> {
  try {
    if (!(await api.online())) {
      return 'offline';
    }
    const speciesRows = await api.fetchSpecies();
    // Both lists or neither, so a plant page never shows a new record next to an old species.
    const recordRows = speciesRows && (await api.fetchRecords());
    if (!speciesRows || !recordRows) {
      return 'failed';
    }
    const species = speciesFromServer(speciesRows);
    if (species.length === 0) {
      // An empty species list means something went wrong on the server, so the old copy is better
      // than nothing. No records is fine, because the park might not have published any yet.
      return 'failed';
    }
    await store.replacePublicCopy(species, recordsFromServer(recordRows), now());
    return 'done';
  } catch (error) {
    console.warn("Couldn't update the plant info for offline use.", error);
    return 'failed';
  }
}

/** What to tell someone when a download finishes. hasCopy is whether the phone already had one. */
export function downloadMessage(outcome: DownloadOutcome, hasCopy: boolean) {
  switch (outcome) {
    case 'done':
      return 'Plant info updated.';
    case 'offline':
      return hasCopy
        ? 'No signal right now. The plant info saved on this phone still works.'
        : 'No signal right now. The plant info will download once this phone is online.';
    case 'failed':
      return hasCopy
        ? "Couldn't update the plant info, but the copy saved on this phone still works."
        : "Couldn't download the plant info. Try again in a little while.";
  }
}
