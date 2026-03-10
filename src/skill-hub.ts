// ---------------------------------------------------------------------------
// SafeClaw — ClawHub Skill Hub API client
// ---------------------------------------------------------------------------
//
// Wraps the ClawHub public REST API and normalizes the raw responses into
// clean, UI-friendly types (HubSkill / HubSkillDetail).

import type { HubSkill, HubSkillsResponse, HubSkillDetail } from './types.js';

/** ClawHub registry API base URL */
export const CLAWHUB_API_BASE = 'https://clawhub.ai/api/v1';

// ---------------------------------------------------------------------------
// Raw API response shapes (not exported — internal only)
// ---------------------------------------------------------------------------

interface RawListItem {
  slug: string;
  displayName: string;
  summary: string;
  tags: Record<string, string>;
  stats: { downloads: number; stars: number; installsAllTime: number; versions: number; comments: number; installsCurrent: number };
  createdAt: number;
  updatedAt: number;
  latestVersion: { version: string; createdAt: number; changelog: string | null; license: string | null } | null;
  metadata: unknown;
}

interface RawListResponse {
  items: RawListItem[];
  nextCursor: string | null;
}

interface RawSearchResult {
  score: number;
  slug: string;
  displayName: string;
  summary: string;
  version: string | null;
  updatedAt: number;
}

interface RawSearchResponse {
  results: RawSearchResult[];
}

interface RawDetailResponse {
  skill: {
    slug: string;
    displayName: string;
    summary: string;
    tags: Record<string, string>;
    stats: { downloads: number; stars: number; installsAllTime: number; versions: number; comments: number; installsCurrent: number };
    createdAt: number;
    updatedAt: number;
  };
  latestVersion: { version: string; createdAt: number; changelog: string | null; license: string | null } | null;
  metadata: unknown;
  owner: { handle: string; displayName: string; image: string } | null;
  moderation: unknown;
}

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

function normalizeListItem(raw: RawListItem): HubSkill {
  return {
    slug: raw.slug,
    name: raw.displayName || raw.slug,
    description: raw.summary || '',
    author: '',
    version: raw.latestVersion?.version || '',
    downloads: raw.stats?.downloads ?? 0,
    stars: raw.stats?.stars ?? 0,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function normalizeSearchResult(raw: RawSearchResult): HubSkill {
  return {
    slug: raw.slug,
    name: raw.displayName || raw.slug,
    description: raw.summary || '',
    author: '',
    version: raw.version || '',
    downloads: 0,
    stars: 0,
    createdAt: 0,
    updatedAt: raw.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Public API functions
// ---------------------------------------------------------------------------

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

  const raw: RawSearchResponse = await res.json();
  return {
    items: (raw.results || []).map(normalizeSearchResult),
    nextCursor: null, // search endpoint has no pagination
  };
}

/**
 * List skills from the registry with optional pagination.
 */
export async function listSkills(options?: {
  sortBy?: string;
  limit?: number;
  cursor?: string;
}): Promise<HubSkillsResponse> {
  const params = new URLSearchParams();
  if (options?.limit !== undefined) params.set('limit', String(options.limit));
  if (options?.cursor) params.set('cursor', options.cursor);

  const query = params.toString();
  const url = `${CLAWHUB_API_BASE}/skills${query ? `?${query}` : ''}`;

  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`ClawHub API error: ${res.status}`);

  const raw: RawListResponse = await res.json();
  return {
    items: (raw.items || []).map(normalizeListItem),
    nextCursor: raw.nextCursor || null,
  };
}

/**
 * Get detailed information about a specific skill by slug.
 */
export async function getSkillDetail(slug: string): Promise<HubSkillDetail> {
  const res = await fetch(`${CLAWHUB_API_BASE}/skills/${slug}`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`ClawHub API error: ${res.status}`);

  const raw: RawDetailResponse = await res.json();
  const s = raw.skill;

  return {
    slug: s.slug,
    name: s.displayName || s.slug,
    description: s.summary || '',
    author: raw.owner?.handle || '',
    version: raw.latestVersion?.version || '',
    downloads: s.stats?.downloads ?? 0,
    stars: s.stats?.stars ?? 0,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    changelog: raw.latestVersion?.changelog || '',
    avatarUrl: raw.owner?.image || '',
  };
}
