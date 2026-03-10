// ---------------------------------------------------------------------------
// SafeClaw — ClawHub Skill Hub API client
// ---------------------------------------------------------------------------

import type { HubSkillsResponse, HubSkillDetail, HubSortBy } from './types.js';

/** ClawHub registry API base URL */
export const CLAWHUB_API_BASE = 'https://clawhub.ai/api/v1';

/**
 * Search skills by query using ClawHub's vector search.
 */
export async function searchSkills(
  query: string,
  limit?: number,
): Promise<HubSkillsResponse> {
  const params = new URLSearchParams({ q: query });
  if (limit !== undefined) params.set('limit', String(limit));

  const res = await fetch(`${CLAWHUB_API_BASE}/search?${params}`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`ClawHub API error: ${res.status}`);
  return res.json();
}

/**
 * List skills from the registry with optional sorting and pagination.
 */
export async function listSkills(options?: {
  sortBy?: HubSortBy;
  limit?: number;
  cursor?: string;
}): Promise<HubSkillsResponse> {
  const params = new URLSearchParams();
  if (options?.sortBy) params.set('sortBy', options.sortBy);
  if (options?.limit !== undefined) params.set('limit', String(options.limit));
  if (options?.cursor) params.set('cursor', options.cursor);

  const query = params.toString();
  const url = `${CLAWHUB_API_BASE}/skills${query ? `?${query}` : ''}`;

  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`ClawHub API error: ${res.status}`);
  return res.json();
}

/**
 * Get detailed information about a specific skill by slug.
 */
export async function getSkillDetail(slug: string): Promise<HubSkillDetail> {
  const res = await fetch(`${CLAWHUB_API_BASE}/skills/${slug}`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`ClawHub API error: ${res.status}`);
  return res.json();
}
