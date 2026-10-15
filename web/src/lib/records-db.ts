import { supabase, isSupabaseConfigured } from "./supabase";
import { publishedForSpecies } from "@/data/records";
import { species as mockSpecies } from "@/data/species";

/**
 * How many published (public) records each species has, keyed by slug.
 * Only counts come back, never coordinates. Falls back to the mock records
 * when Supabase isn't set up or can't be reached.
 */
export async function getPublishedCounts(): Promise<Record<string, number>> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from("records")
        .select("species_slug")
        .eq("status", "published");

      if (!error && data) {
        const counts: Record<string, number> = {};
        for (const row of data) {
          const slug = String(row.species_slug);
          counts[slug] = (counts[slug] ?? 0) + 1;
        }
        return counts;
      }
    } catch {
      // Fall back to the mock records below
    }
  }

  return Object.fromEntries(
    mockSpecies.map((s) => [s.slug, publishedForSpecies(s.slug).length]),
  );
}
