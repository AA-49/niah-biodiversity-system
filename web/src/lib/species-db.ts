import { supabase, isSupabaseConfigured } from "./supabase";
import { species as mockSpecies, type Species } from "@/data/species";
import { records as mockRecords, type PlantRecord } from "@/data/records";
import type { IucnCode } from "@/lib/iucn";

/**
 * Normalizes a Supabase PostgreSQL row into the application Species format
 */
function mapRowToSpecies(row: Record<string, unknown>): Species {
  return {
    slug: String(row.slug || row.id || ""),
    scientificName: String(row.scientific_name || row.scientificName || ""),
    authority: String(row.authority || ""),
    family: String(row.family || ""),
    commonNames: Array.isArray(row.common_names)
      ? (row.common_names as string[])
      : Array.isArray(row.commonNames)
      ? (row.commonNames as string[])
      : [],
    iucn: ((row.iucn_code || row.iucn || "LC") as string) as IucnCode,
    sarawakProtected: Boolean(
      row.sarawak_protected ?? row.sarawakProtected ?? false
    ),
    newerName: (row.newer_name || row.newerName) ? String(row.newer_name || row.newerName) : undefined,
    summary: String(row.summary || ""),
    about: String(row.about || row.description || ""),
    habitat: String(row.habitat || ""),
    uses: String(row.uses || ""),
    updated: row.updated_at
      ? String(row.updated_at).split("T")[0]
      : String(row.updated || "2026-10-02"),
  };
}

/**
 * Normalizes a Supabase PostgreSQL record row into the PlantRecord format
 */
function mapRowToRecord(row: Record<string, unknown>): PlantRecord {
  return {
    id: String(row.id || ""),
    speciesSlug: String(row.species_slug || row.speciesSlug || ""),
    heightM: Number(row.height_m ?? row.heightM ?? 0),
    condition: (row.condition as PlantRecord["condition"]) || "healthy",
    photoCount: Number(row.photo_count ?? row.photoCount ?? 0),
    gps: (row.gps as PlantRecord["gps"]) || null,
    notes: row.notes ? String(row.notes) : undefined,
    recordedBy: String(row.recorded_by || row.recordedBy || "field_botanist"),
    recordedAt: String(row.recorded_at || row.recordedAt || new Date().toISOString()),
    status: (row.status as PlantRecord["status"]) || "waiting",
  };
}

/**
 * Retrieves the full list of plant species.
 * Fetches from Supabase if configured, otherwise falls back to local mock data.
 */
export async function getSpeciesList(): Promise<Species[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from("species_public")
        .select("*")
        .order("scientific_name", { ascending: true });

      if (!error && data) {
        return data.map(mapRowToSpecies);
      }
    } catch {
      // Graceful fallback to mock data on network/connection failure
    }
  }

  return mockSpecies;
}

/**
 * Retrieves a single species by its URL slug.
 */
export async function getSpeciesBySlug(slug: string): Promise<Species | null> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from("species_public")
        .select("*")
        .or(`slug.eq.${slug},id.eq.${slug}`)
        .maybeSingle();

      if (!error) {
        return data ? mapRowToSpecies(data) : null;
      }
    } catch {
      // Fallback to mock data
    }
  }

  const found = mockSpecies.find((s) => s.slug === slug);
  return found || null;
}

/**
 * Retrieves published field records for a specific species.
 */
export async function getPublishedRecordsForSpecies(
  slug: string
): Promise<PlantRecord[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from("records_public")
        .select("*")
        .eq("species_slug", slug)
        .eq("status", "published")
        .order("recorded_at", { ascending: false });

      if (!error && data) {
        return data.map(mapRowToRecord);
      }
    } catch {
      // Fallback to mock data
    }
  }

  return mockRecords.filter(
    (r) => r.speciesSlug === slug && r.status === "published"
  );
}

/**
 * Inserts or proposes a new plant species into Supabase.
 */
export async function insertSpecies(newSpecies: Partial<Species>): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      success: false,
      error: "Supabase is not configured. Add credentials in .env.local to persist changes.",
    };
  }

  const row = {
    id: newSpecies.slug,
    slug: newSpecies.slug,
    scientific_name: newSpecies.scientificName,
    authority: newSpecies.authority,
    family: newSpecies.family,
    common_names: newSpecies.commonNames || [],
    iucn_code: newSpecies.iucn || "LC",
    sarawak_protected: newSpecies.sarawakProtected || false,
    newer_name: newSpecies.newerName,
    summary: newSpecies.summary,
    about: newSpecies.about,
    habitat: newSpecies.habitat,
    uses: newSpecies.uses,
  };

  const { error } = await supabase.from("species").insert([row]);
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function updateSpecies(
  slug: string,
  changes: Partial<Species>,
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: "Supabase is not configured." };
  }

  const row = {
    scientific_name: changes.scientificName,
    authority: changes.authority,
    family: changes.family,
    common_names: changes.commonNames,
    iucn_code: changes.iucn,
    sarawak_protected: changes.sarawakProtected,
    newer_name: changes.newerName,
    summary: changes.summary,
    about: changes.about,
    habitat: changes.habitat,
    uses: changes.uses,
  };

  const { error } = await supabase
    .from("species")
    .update(row)
    .eq("id", slug);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteSpecies(
  slug: string,
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: "Supabase is not configured." };
  }

  const { error } = await supabase.from("species").delete().eq("id", slug);
  if (error) return { success: false, error: error.message };
  return { success: true };
}
