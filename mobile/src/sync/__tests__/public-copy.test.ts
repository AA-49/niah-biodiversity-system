import {
  downloadMessage,
  downloadPublicCopy,
  recordsFromServer,
  speciesFromServer,
  type PublicCopyApi,
  type PublicCopyStore,
  type RecordsPublicRow,
  type SpeciesPublicRow,
} from '@/sync/public-copy';
import type { PublicRecord, PublicSpecies } from '@/types/public-copy';

// A fake server for the public plant info, and a fake phone to save it on. The rows look like what
// the species_public and records_public views send back. The text is made up, and nothing here
// has a location.

const DOWNLOADED = '2026-11-04T06:15:00.000Z';
const now = () => DOWNLOADED;

function speciesRow(changes: Partial<SpeciesPublicRow> = {}): SpeciesPublicRow {
  return {
    id: 'nepenthes-rafflesiana',
    scientific_name: 'Nepenthes rafflesiana',
    authority: 'Jack',
    family: 'Nepenthaceae',
    common_names: ['Raffles pitcher plant', 'Periuk kera'],
    iucn_code: 'LC',
    sarawak_protected: true,
    newer_name: null,
    summary: 'A pitcher plant that traps insects.',
    about: 'Its pitchers hold a liquid that breaks down whatever falls in.',
    description: null,
    habitat: 'Forest edges and open heath forest.',
    uses: 'None recorded here.',
    ...changes,
  };
}

function recordRow(changes: Partial<RecordsPublicRow> = {}): RecordsPublicRow {
  return {
    id: '3f9a1c2e-5b7d-4e6f-8a9b-0c1d2e3f4a50',
    tag_code: 'NNP-3F9A1C',
    species_slug: 'nepenthes-rafflesiana',
    species_name: 'Nepenthes rafflesiana',
    common_name: 'Raffles pitcher plant',
    height_m: 1.5,
    condition: 'healthy',
    recorded_at: '2026-10-20T02:30:00+00:00',
    ...changes,
  };
}

// What those two rows turn into on the phone.
const pitcher: PublicSpecies = {
  slug: 'nepenthes-rafflesiana',
  scientificName: 'Nepenthes rafflesiana',
  authority: 'Jack',
  family: 'Nepenthaceae',
  commonNames: ['Raffles pitcher plant', 'Periuk kera'],
  iucnCode: 'LC',
  sarawakProtected: true,
  summary: 'A pitcher plant that traps insects.',
  about: 'Its pitchers hold a liquid that breaks down whatever falls in.',
  habitat: 'Forest edges and open heath forest.',
  uses: 'None recorded here.',
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

function fakeServer(
  species: SpeciesPublicRow[] | null = [speciesRow()],
  records: RecordsPublicRow[] | null = [recordRow()],
) {
  return {
    online: jest.fn(async (): Promise<boolean> => true),
    fetchSpecies: jest.fn(async () => species),
    fetchRecords: jest.fn(async () => records),
  } satisfies PublicCopyApi;
}

function fakePhone() {
  return {
    replacePublicCopy: jest.fn(
      async (_species: PublicSpecies[], _records: PublicRecord[], _downloadedAt: string) => {},
    ),
  } satisfies PublicCopyStore;
}

describe('speciesFromServer', () => {
  it('keeps every field the plant page shows', () => {
    expect(speciesFromServer([speciesRow({ newer_name: 'Nepenthes new-name' })])).toEqual([
      { ...pitcher, newerName: 'Nepenthes new-name' },
    ]);
  });

  it('turns missing text into empty text, and missing common names into none', () => {
    expect(
      speciesFromServer([
        speciesRow({
          authority: null,
          family: null,
          common_names: null,
          summary: null,
          about: null,
          habitat: null,
          uses: null,
        }),
      ]),
    ).toEqual([
      {
        ...pitcher,
        authority: '',
        family: '',
        commonNames: [],
        summary: '',
        about: '',
        habitat: '',
        uses: '',
      },
    ]);
  });

  it('keeps only the common names that have some text in them', () => {
    const [species] = speciesFromServer([
      speciesRow({ common_names: ['Periuk kera', '', '   ', null, 3, 'Raffles pitcher plant'] }),
    ]);
    expect(species.commonNames).toEqual(['Periuk kera', 'Raffles pitcher plant']);
  });

  it('gives no common names when the server sends something that is not a list', () => {
    const [species] = speciesFromServer([speciesRow({ common_names: 'Periuk kera' })]);
    expect(species.commonNames).toEqual([]);
  });

  it('uses the description when a species has no about text, like the website does', () => {
    const [older, newer] = speciesFromServer([
      speciesRow({ id: 'older', about: null, description: 'An older description.' }),
      speciesRow({ id: 'newer', description: 'An older description.' }),
    ]);
    expect(older.about).toBe('An older description.');
    expect(newer.about).toBe(pitcher.about);
  });

  it("shows an IUCN code it doesn't know as Not Evaluated, like the website does", () => {
    const species = speciesFromServer([
      speciesRow({ id: 'unknown', iucn_code: 'XX' }),
      speciesRow({ id: 'missing', iucn_code: null }),
      speciesRow({ id: 'endangered', iucn_code: 'EN' }),
    ]);
    expect(species.map((each) => each.iucnCode)).toEqual(['NE', 'NE', 'EN']);
  });

  it('only marks a species as protected when the server says it is', () => {
    const species = speciesFromServer([
      speciesRow({ id: 'yes', sarawak_protected: true }),
      speciesRow({ id: 'no', sarawak_protected: false }),
      speciesRow({ id: 'unknown', sarawak_protected: null }),
    ]);
    expect(species.map((each) => each.sarawakProtected)).toEqual([true, false, false]);
  });

  it('leaves out a newer name that is empty', () => {
    const species = speciesFromServer([
      speciesRow({ id: 'empty', newer_name: '' }),
      speciesRow({ id: 'spaces', newer_name: '   ' }),
      speciesRow({ id: 'missing', newer_name: null }),
    ]);
    expect(species.map((each) => each.newerName)).toEqual([undefined, undefined, undefined]);
  });

  it('leaves out a species with no ID or no scientific name', () => {
    expect(
      speciesFromServer([
        speciesRow({ id: null }),
        speciesRow({ id: '' }),
        speciesRow({ id: '   ' }),
        speciesRow({ id: 'no-name', scientific_name: null }),
        speciesRow({ id: 'blank-name', scientific_name: '   ' }),
      ]),
    ).toEqual([]);
  });

  it('keeps the first of two species with the same ID', () => {
    expect(
      speciesFromServer([speciesRow(), speciesRow({ scientific_name: 'Nepenthes again' })]),
    ).toEqual([pitcher]);
  });
});

describe('recordsFromServer', () => {
  it('keeps every field the plant page shows', () => {
    expect(recordsFromServer([recordRow()])).toEqual([tagged]);
  });

  it('keeps only the fields the plant page shows, so a location could never be saved', () => {
    const row = { ...recordRow(), gps: 'never kept', status: 'published' };
    const [record] = recordsFromServer([row]);
    expect(Object.keys(record).sort()).toEqual([
      'commonName',
      'condition',
      'heightM',
      'id',
      'recordedAt',
      'speciesName',
      'speciesSlug',
      'tagCode',
    ]);
  });

  it('reads the times Postgres sends, with no digits up to six after the second', () => {
    const times = [
      '2026-10-20T02:30:00+00:00',
      '2026-10-20T02:30:00.5+00:00',
      '2026-10-20T02:30:00.123456+00:00',
      '2026-10-20T10:30:00.12+08:00',
    ];
    const records = recordsFromServer(
      times.map((time, index) => recordRow({ id: `record-${index}`, recorded_at: time })),
    );
    expect(records.map((record) => record.recordedAt)).toEqual([
      '2026-10-20T02:30:00.000Z',
      '2026-10-20T02:30:00.500Z',
      '2026-10-20T02:30:00.123Z',
      '2026-10-20T02:30:00.120Z',
    ]);
  });

  it('leaves out a record with no ID, no name, or a time it cannot read', () => {
    expect(
      recordsFromServer([
        recordRow({ id: null }),
        recordRow({ id: '   ' }),
        recordRow({ id: 'no-name', species_name: null }),
        recordRow({ id: 'blank-name', species_name: '  ' }),
        recordRow({ id: 'no-time', recorded_at: null }),
        recordRow({ id: 'bad-time', recorded_at: 'last Tuesday' }),
      ]),
    ).toEqual([]);
  });

  it('keeps the first of two records with the same ID', () => {
    expect(recordsFromServer([recordRow(), recordRow({ species_name: 'Ficus sp.' })])).toEqual([
      tagged,
    ]);
  });

  it('makes the tag code from the ID when a record has none, like the website does', () => {
    const records = recordsFromServer([
      recordRow({ tag_code: null }),
      recordRow({ id: '8d2e4f6a-1c3b-4d5e-9f7a-2b4c6d8e0f10', tag_code: '  ' }),
    ]);
    expect(records.map((record) => record.tagCode)).toEqual(['NNP-3F9A1C', 'NNP-8D2E4F']);
  });

  it('reads a height sent as text, and leaves out one that is not above zero', () => {
    const heights = ['2.75', 0, -1, 'tall', null];
    const records = recordsFromServer(
      heights.map((height, index) => recordRow({ id: `record-${index}`, height_m: height })),
    );
    expect(records.map((record) => record.heightM)).toEqual([
      2.75,
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("leaves out a condition the app doesn't know", () => {
    const records = recordsFromServer([
      recordRow({ id: 'gone', condition: 'gone' }),
      recordRow({ id: 'missing', condition: null }),
      recordRow({ id: 'damaged', condition: 'damaged' }),
    ]);
    expect(records.map((record) => record.condition)).toEqual([undefined, undefined, 'damaged']);
  });

  it('leaves out a species link or common name that is empty', () => {
    const [record] = recordsFromServer([recordRow({ species_slug: '', common_name: '   ' })]);
    expect(record.speciesSlug).toBeUndefined();
    expect(record.commonName).toBeUndefined();
  });
});

describe('downloadPublicCopy', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('swaps in the new copy, with the time it came down', async () => {
    const phone = fakePhone();
    expect(await downloadPublicCopy(fakeServer(), phone, now)).toBe('done');
    expect(phone.replacePublicCopy).toHaveBeenCalledTimes(1);
    expect(phone.replacePublicCopy).toHaveBeenCalledWith([pitcher], [tagged], DOWNLOADED);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('uses the time right now when it is not given one', async () => {
    jest.useFakeTimers({ now: new Date(DOWNLOADED) });
    try {
      const phone = fakePhone();
      await downloadPublicCopy(fakeServer(), phone);
      expect(phone.replacePublicCopy).toHaveBeenCalledWith([pitcher], [tagged], DOWNLOADED);
    } finally {
      jest.useRealTimers();
    }
  });

  it('asks the server nothing when the phone knows it has no signal', async () => {
    const server = fakeServer();
    server.online.mockResolvedValue(false);
    const phone = fakePhone();
    expect(await downloadPublicCopy(server, phone, now)).toBe('offline');
    expect(server.fetchSpecies).not.toHaveBeenCalled();
    expect(server.fetchRecords).not.toHaveBeenCalled();
    expect(phone.replacePublicCopy).not.toHaveBeenCalled();
  });

  it("doesn't ask for the records when the species couldn't be read", async () => {
    const server = fakeServer(null);
    const phone = fakePhone();
    expect(await downloadPublicCopy(server, phone, now)).toBe('failed');
    expect(server.fetchRecords).not.toHaveBeenCalled();
    expect(phone.replacePublicCopy).not.toHaveBeenCalled();
  });

  it("keeps the old copy when the records couldn't be read", async () => {
    const phone = fakePhone();
    expect(await downloadPublicCopy(fakeServer(undefined, null), phone, now)).toBe('failed');
    expect(phone.replacePublicCopy).not.toHaveBeenCalled();
  });

  it('keeps the old copy when the server sends no species the phone can use', async () => {
    const phone = fakePhone();
    expect(await downloadPublicCopy(fakeServer([]), phone, now)).toBe('failed');
    const unnamed = [speciesRow({ scientific_name: null })];
    expect(await downloadPublicCopy(fakeServer(unnamed), phone, now)).toBe('failed');
    expect(phone.replacePublicCopy).not.toHaveBeenCalled();
  });

  // The park might not have published any records yet.
  it('takes a download with species and no records', async () => {
    const phone = fakePhone();
    expect(await downloadPublicCopy(fakeServer(undefined, []), phone, now)).toBe('done');
    expect(phone.replacePublicCopy).toHaveBeenCalledWith([pitcher], [], DOWNLOADED);
  });

  it('says it failed, and warns, when the phone cannot save the copy', async () => {
    const phone = fakePhone();
    const full = new Error('database or disk is full');
    phone.replacePublicCopy.mockRejectedValue(full);
    expect(await downloadPublicCopy(fakeServer(), phone, now)).toBe('failed');
    expect(console.warn).toHaveBeenCalledWith(
      "Couldn't update the plant info for offline use.",
      full,
    );
  });

  it('says it failed instead of throwing when checking for signal throws', async () => {
    const server = fakeServer();
    const broken = new Error('The network module is missing');
    server.online.mockRejectedValue(broken);
    expect(await downloadPublicCopy(server, fakePhone(), now)).toBe('failed');
    expect(server.fetchSpecies).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      "Couldn't update the plant info for offline use.",
      broken,
    );
  });
});

describe('downloadMessage', () => {
  it('says the plant info updated', () => {
    expect(downloadMessage('done', true)).toBe('Plant info updated.');
    expect(downloadMessage('done', false)).toBe('Plant info updated.');
  });

  it('says the copy on the phone still works when there is one', () => {
    expect(downloadMessage('offline', true)).toBe(
      'No signal right now. The plant info saved on this phone still works.',
    );
    expect(downloadMessage('failed', true)).toBe(
      "Couldn't update the plant info, but the copy saved on this phone still works.",
    );
  });

  it('says what happens next when the phone has no copy yet', () => {
    expect(downloadMessage('offline', false)).toBe(
      'No signal right now. The plant info will download once this phone is online.',
    );
    expect(downloadMessage('failed', false)).toBe(
      "Couldn't download the plant info. Try again in a little while.",
    );
  });
});
