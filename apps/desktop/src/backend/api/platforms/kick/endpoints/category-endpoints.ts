import type { UnifiedCategory } from "../../../unified/platform-types";
import type { KickRequestor } from "../kick-requestor";
import { transformKickCategory } from "../kick-transformers";
import type {
  KickApiCategory,
  KickApiLivestream,
  KickApiResponse,
  PaginatedResult,
  PaginationOptions,
} from "../kick-types";

import { getPublicTopStreams } from "./stream-endpoints";

/**
 * Get categories from public/legacy API (No Auth Required)
 * Extracts unique categories from public top streams
 */
export async function getPublicTopCategories(): Promise<PaginatedResult<UnifiedCategory>> {
  try {
    // Fetch public streams (uses legacy API, no auth needed)
    const streamsResult = await getPublicTopStreams({ limit: 100 });
    const streams = streamsResult.data;

    // Extract unique categories with aggregated viewer counts
    const categoryMap = new Map<string, UnifiedCategory>();

    for (const stream of streams) {
      if (stream.categoryId && stream.categoryName) {
        const existing = categoryMap.get(stream.categoryId);
        if (existing) {
          // Aggregate viewer counts
          existing.viewerCount = (existing.viewerCount || 0) + (stream.viewerCount || 0);
        } else {
          categoryMap.set(stream.categoryId, {
            id: stream.categoryId,
            platform: "kick",
            name: stream.categoryName,
            boxArtUrl: "", // Not available from streams endpoint
            viewerCount: stream.viewerCount || 0,
          });
        }
      }
    }

    const categories = Array.from(categoryMap.values()).sort(
      (a, b) => (b.viewerCount || 0) - (a.viewerCount || 0)
    );

    return { data: categories };
  } catch (error) {
    console.error("Failed to fetch public Kick categories:", error);
    return { data: [] };
  }
}

/**
 * Get top/popular categories (derived from top streams)
 * Note: Kick official API doesn't have a "browse all" endpoint, so we aggregate from streams
 * Uses App Token if available, falls back to public API if not authenticated
 */
export async function getTopCategories(
  client: KickRequestor,
  _options: PaginationOptions = {}
): Promise<PaginatedResult<UnifiedCategory>> {
  try {
    // Try official API first (will use App Token if available via KickClient.request fallback)
    const params = new URLSearchParams();
    params.set("limit", "100");
    params.set("sort", "viewer_count");

    const response = await client.request<KickApiResponse<KickApiLivestream[]>>(
      `/livestreams?${params.toString()}`
    );
    const rawStreams = response.data || [];

    const distinctCategories = new Map<number, UnifiedCategory>();

    for (const s of rawStreams) {
      if (s.category && !distinctCategories.has(s.category.id)) {
        distinctCategories.set(s.category.id, {
          id: s.category.id.toString(),
          platform: "kick",
          name: s.category.name,
          boxArtUrl: s.category.thumbnail || "",
          viewerCount: 0,
        });
      }

      // Aggregate viewer counts from these top streams
      if (s.category && distinctCategories.has(s.category.id)) {
        const cat = distinctCategories.get(s.category.id)!;
        cat.viewerCount = (cat.viewerCount || 0) + s.viewer_count;
      }
    }

    const categories = Array.from(distinctCategories.values()).sort(
      (a, b) => (b.viewerCount || 0) - (a.viewerCount || 0)
    );

    return { data: categories };
  } catch (error) {
    console.warn(
      "Failed to fetch Kick top categories via official API, falling back to public:",
      error
    );
    // Fallback to public API (no auth required)
    return getPublicTopCategories();
  }
}

/**
 * Search for categories
 * https://docs.kick.com/apis/categories - GET /public/v1/categories?q=:query
 */
export async function searchCategories(
  client: KickRequestor,
  query: string,
  options: PaginationOptions = {}
): Promise<PaginatedResult<UnifiedCategory>> {
  try {
    const params = new URLSearchParams({
      q: query,
    });
    if (options.page) {
      params.set("page", options.page.toString());
    }

    const response = await client.request<KickApiResponse<KickApiCategory[]>>(
      `/categories?${params.toString()}`
    );

    const categories = (response.data || []).map(transformKickCategory);

    return {
      data: categories,
      nextPage: categories.length >= 100 ? (options.page || 1) + 1 : undefined,
    };
  } catch (error) {
    console.error("Failed to search Kick categories:", error);
    return { data: [] };
  }
}

/**
 * Get category by ID
 * https://docs.kick.com/apis/categories - GET /public/v1/categories/:category_id
 */
export async function getCategoryById(
  client: KickRequestor,
  id: string
): Promise<UnifiedCategory | null> {
  try {
    const response = await client.request<KickApiResponse<KickApiCategory>>(`/categories/${id}`);

    if (response.data) {
      return transformKickCategory(response.data);
    }
    return null;
  } catch (error) {
    console.error("Failed to fetch Kick category:", error);
    return null;
  }
}

/**
 * Helper to add delay between requests to respect rate limits
 */
async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get ALL categories from Kick that have live streams.
 * Extracts categories from multiple pages of top streams (sequential with rate limiting).
 * This is a workaround since Kick lacks a "browse all" endpoint.
 * Falls back to public API if official API fails.
 *
 * NOTE: Only returns categories with active live streams. Categories with no streams
 * are intentionally excluded from the Categories page display.
 *
 * RATE LIMIT AWARE: Uses sequential requests with delays to prevent 429 errors
 */
export async function getAllCategories(client: KickRequestor): Promise<UnifiedCategory[]> {
  const categoryMap = new Map<number, UnifiedCategory>();

  try {
    // Fetch pages of streams sequentially to avoid 429 rate limits
    const offsets = [0, 100, 200];

    for (const offset of offsets) {
      try {
        const response = await client.request<KickApiResponse<KickApiLivestream[]>>(
          `/livestreams?limit=100&offset=${offset}&sort=viewer_count`
        );

        const streams = response.data || [];
        for (const s of streams) {
          if (s.category && !categoryMap.has(s.category.id)) {
            categoryMap.set(s.category.id, {
              id: s.category.id.toString(),
              platform: "kick",
              name: s.category.name,
              boxArtUrl: s.category.thumbnail || "",
              viewerCount: 0,
            });
          }
          // Aggregate viewer counts
          if (s.category && categoryMap.has(s.category.id)) {
            const cat = categoryMap.get(s.category.id)!;
            cat.viewerCount = (cat.viewerCount || 0) + s.viewer_count;
          }
        }

        // Add delay between requests to respect rate limits
        if (offset < offsets[offsets.length - 1]) {
          await delay(300);
        }
      } catch (err) {
        console.warn(`Failed to fetch Kick streams at offset ${offset}:`, err);
        // Continue with next offset
      }
    }
  } catch (error) {
    console.warn(
      "Failed to fetch all Kick categories via official API, falling back to public:",
      error
    );
    // Fallback to public API
    const publicResult = await getPublicTopCategories();
    return publicResult.data;
  }

  // If official API returned nothing, try fallback
  if (categoryMap.size === 0) {
    console.warn("Official API returned no categories, using public fallback");
    const publicResult = await getPublicTopCategories();
    return publicResult.data;
  }

  return Array.from(categoryMap.values()).sort(
    (a, b) => (b.viewerCount || 0) - (a.viewerCount || 0)
  );
}
