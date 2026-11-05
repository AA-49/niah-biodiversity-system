import { EMPTY_PUBLIC_COPY, type RecordsStore } from '@/db/records-store';
import { openRecordsStore } from '@/db/records-store.web';
import type { PlantCondition } from '@/types/plant-record';
import type { IucnCode, PublicRecord, PublicSpecies } from '@/types/public-copy';

// The web build keeps the public plant info and the scans in memory, but it's meant to follow the
// same rules as the tables on the phone. These go through the same rules as
// public-copy-store.test.ts. The text is made up, and nothing here has a location.

const BAD_SPECIES = 'A species in the plant info has no name, a repeated slug or a bad IUCN code.';
const BAD_RECORD =
  'A record in the plant info has no tag or name, a repeated ID, or a bad height or condition.';

const pitcher: PublicSpecies = {
  slug: 'nepenthes-rafflesiana',
  scientificName: 'Nepenthes rafflesiana',
  authority: 'Jack',
  family: 'Nepenthaceae',
  commonNames: ['Raffles pitcher plant', 'Periuk kera'],
  iucnCode: 'LC',
  sarawakProtected: true,
  newerName: 'Nepenthes new-name',
  summary: 'A pitcher plant that traps insects.',
  about: 'Its pitchers hold a liquid that breaks down whatever falls in.',
  habitat: 'Forest edges and open heath forest.',
  uses: 'None recorded here.',
};
const fig: PublicSpecies = {
  slug: 'ficus-benjamina',
  scientificName: 'Ficus benjamina',
  authority: '',
  family: '',
  commonNames: [],
  iucnCode: 'NE',
  sarawakProtected: false,
  summary: '',
  about: '',
  habitat: '',
  uses: '',
};

const tagged: PublicRecord = {
  id: '3f9a1c2e-5b7d-4e6f-8a9b-0c1d2e3f4a50',
  tagCode: 'NNP-3F9A1C',
  speciesSlug: 'nepenthes-rafflesiana',
  speciesName: 'Nepenthes rafflesiana',
  commonName: 'Raffles pitcher plant',
  heightM: 1.5,
  condition: 'healthy',
  recordedAt: '2026-10-20T02:30:00.000Z',
};
const unmatched: PublicRecord = {
  id: '8d2e4f6a-1c3b-4d5e-9f7a-2b4c6d8e0f10',
  tagCode: 'NNP-8D2E4F',
  speciesName: 'Ficus sp.',
  recordedAt: '2026-10-19T16:00:00.000Z',
};

const DOWNLOADED = '2026-11-04T06:15:00.000Z';
const LATER = '2026-11-04T06:25:00.000Z';

const oldCopy = { species: [pitcher], records: [tagged], downloadedAt: DOWNLOADED };

let store: RecordsStore;

beforeEach(async () => {
  store = await openRecordsStore();
});

describe('public plant info', () => {
  it('has nothing and no time until the first download', async () => {
    expect(await store.loadPublicCopy()).toEqual({ species: [], records: [], downloadedAt: null });
  });

  it('gives back every field the way it came down, in the same order', async () => {
    await store.replacePublicCopy([fig, pitcher], [unmatched, tagged], DOWNLOADED);
    expect(await store.loadPublicCopy()).toEqual({
      species: [fig, pitcher],
      records: [unmatched, tagged],
      downloadedAt: DOWNLOADED,
    });
  });

  it('swaps the whole copy and its time for the new one', async () => {
    await store.replacePublicCopy([fig, pitcher], [unmatched, tagged], DOWNLOADED);
    await store.replacePublicCopy([pitcher], [tagged], LATER);
    expect(await store.loadPublicCopy()).toEqual({
      species: [pitcher],
      records: [tagged],
      downloadedAt: LATER,
    });
  });

  it('takes a download with species and no records', async () => {
    await store.replacePublicCopy([fig, pitcher], [unmatched, tagged], DOWNLOADED);
    await store.replacePublicCopy([pitcher], [], LATER);
    expect(await store.loadPublicCopy()).toEqual({
      species: [pitcher],
      records: [],
      downloadedAt: LATER,
    });
  });

  it('keeps the old copy and its time when the new one has no species', async () => {
    await store.replacePublicCopy([pitcher], [tagged], DOWNLOADED);
    await expect(store.replacePublicCopy([], [unmatched], LATER)).rejects.toThrow(
      EMPTY_PUBLIC_COPY,
    );
    expect(await store.loadPublicCopy()).toEqual(oldCopy);
  });

  it.each<[string, PublicSpecies[], PublicRecord[], string]>([
    ['the same species twice', [pitcher, fig, pitcher], [], BAD_SPECIES],
    ['a species with no slug', [fig, { ...pitcher, slug: '' }], [], BAD_SPECIES],
    ['a species with no name', [fig, { ...pitcher, scientificName: '' }], [], BAD_SPECIES],
    [
      'an IUCN code the app does not know',
      [fig, { ...pitcher, iucnCode: 'XX' as IucnCode }],
      [],
      BAD_SPECIES,
    ],
    ['the same record twice', [fig], [tagged, unmatched, tagged], BAD_RECORD],
    ['a record with no tag', [fig], [unmatched, { ...tagged, tagCode: '' }], BAD_RECORD],
    ['a record with no name', [fig], [{ ...tagged, speciesName: '' }], BAD_RECORD],
    ['a height of 0', [fig], [{ ...tagged, heightM: 0 }], BAD_RECORD],
    [
      'a condition the app does not know',
      [fig],
      [{ ...tagged, condition: 'gone' as PlantCondition }],
      BAD_RECORD,
    ],
  ])('keeps the old copy when the new one has %s', async (_what, species, records, error) => {
    await store.replacePublicCopy([pitcher], [tagged], DOWNLOADED);
    await expect(store.replacePublicCopy(species, records, LATER)).rejects.toThrow(error);
    expect(await store.loadPublicCopy()).toEqual(oldCopy);
  });

  it("hands back copies, so changing one doesn't change what's saved", async () => {
    const species = { ...pitcher, commonNames: [...pitcher.commonNames] };
    const record = { ...tagged };
    await store.replacePublicCopy([species], [record], DOWNLOADED);
    species.commonNames.push('Changed after saving');
    record.tagCode = 'NNP-CHANGED';

    const copy = await store.loadPublicCopy();
    copy.species[0].commonNames.push('Changed after loading');
    copy.records[0].tagCode = 'NNP-CHANGED';
    expect(await store.loadPublicCopy()).toEqual(oldCopy);
  });

  it('keeps its time apart from when the phone last synced and who uses it', async () => {
    await store.replacePublicCopy([pitcher], [tagged], DOWNLOADED);
    expect(await store.loadLastSynced()).toBeNull();
    expect(await store.loadMode()).toBeNull();

    await store.saveLastSynced(LATER);
    expect((await store.loadPublicCopy()).downloadedAt).toBe(DOWNLOADED);
  });

  it('starts empty each time it opens, since nothing is kept', async () => {
    await store.replacePublicCopy([pitcher], [tagged], DOWNLOADED);
    const reloaded = await openRecordsStore();
    expect(await reloaded.loadPublicCopy()).toEqual({
      species: [],
      records: [],
      downloadedAt: null,
    });
  });
});

describe('scan history', () => {
  it('has no scans until a tag is scanned', async () => {
    expect(await store.loadScans()).toEqual([]);
  });

  it('lists the latest scan first, and moves a tag scanned again to the top', async () => {
    await store.saveScan('NNP-3F9A1C', '2026-11-04T01:00:00.000Z');
    await store.saveScan('NNP-8D2E4F', '2026-11-04T02:00:00.000Z');
    await store.saveScan('NNP-3F9A1C', '2026-11-04T03:00:00.000Z');
    expect(await store.loadScans()).toEqual([
      { tagCode: 'NNP-3F9A1C', scannedAt: '2026-11-04T03:00:00.000Z' },
      { tagCode: 'NNP-8D2E4F', scannedAt: '2026-11-04T02:00:00.000Z' },
    ]);
  });

  it('puts the tag first scanned later first when two scans have the same time', async () => {
    await store.saveScan('NNP-3F9A1C', DOWNLOADED);
    await store.saveScan('NNP-8D2E4F', DOWNLOADED);
    expect((await store.loadScans()).map((scan) => scan.tagCode)).toEqual([
      'NNP-8D2E4F',
      'NNP-3F9A1C',
    ]);
  });

  it("won't save a scan with no tag", async () => {
    await expect(store.saveScan('', DOWNLOADED)).rejects.toThrow('A scan needs a tag code.');
    expect(await store.loadScans()).toEqual([]);
  });

  it('forgets every scan when cleared, and keeps the plant info', async () => {
    await store.replacePublicCopy([pitcher], [tagged], DOWNLOADED);
    await store.saveScan('NNP-3F9A1C', DOWNLOADED);
    await store.saveScan('NNP-8D2E4F', LATER);

    await store.clearScans();
    expect(await store.loadScans()).toEqual([]);
    expect(await store.loadPublicCopy()).toEqual(oldCopy);
  });

  it("hands back copies, so changing one doesn't change what's saved", async () => {
    await store.saveScan('NNP-3F9A1C', DOWNLOADED);
    const [scan] = await store.loadScans();
    scan.scannedAt = LATER;
    expect(await store.loadScans()).toEqual([{ tagCode: 'NNP-3F9A1C', scannedAt: DOWNLOADED }]);
  });
});
