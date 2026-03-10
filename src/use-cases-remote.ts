// ---------------------------------------------------------------------------
// SafeClaw — Remote use-case fetcher
// Fetches community workflows from the awesome-openclaw-usecases GitHub repo,
// parses the README markdown table, and caches results in IndexedDB.
// ---------------------------------------------------------------------------

import { getConfig, setConfig } from './db.js';
import type { UseCase, Difficulty } from './types.js';

/** Raw README URL for the community use-cases repo */
export const REMOTE_README_URL =
  'https://raw.githubusercontent.com/hesamsheikh/awesome-openclaw-usecases/main/README.md';

/** IndexedDB config key for the cached remote use cases */
export const CACHE_KEY = 'remote_use_cases_cache';

/** Cache time-to-live: 24 hours */
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Fetch timeout in ms */
const FETCH_TIMEOUT_MS = 10_000;

interface CacheEntry {
  fetchedAt: number;
  useCases: UseCase[];
}

/**
 * Parse a markdown table from the awesome-openclaw-usecases README into UseCase objects.
 * Expected table format:
 *   | Category | Use Case | Description |
 *   |----------|----------|-------------|
 *   | Productivity | Daily Standup | Compile standups... |
 */
export function parseReadmeUseCases(markdown: string): UseCase[] {
  const lines = markdown.split('\n');
  const useCases: UseCase[] = [];

  let inTable = false;
  let headerSkipped = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect table rows (lines starting and ending with |)
    if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
      if (inTable) {
        // Table ended
        inTable = false;
        headerSkipped = false;
      }
      continue;
    }

    const cells = trimmed
      .split('|')
      .slice(1, -1) // drop empty first/last from split
      .map((c) => c.trim());

    if (cells.length < 3) continue;

    // First row is the header
    if (!inTable) {
      inTable = true;
      headerSkipped = false;
      continue; // skip header row
    }

    // Second row is the separator (---|---|---)
    if (!headerSkipped) {
      if (cells[0].match(/^-+$/)) {
        headerSkipped = true;
        continue;
      }
      headerSkipped = true;
    }

    const [category, title, description] = cells;
    if (!title || !description) continue;

    const id = 'remote-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    useCases.push({
      id,
      title,
      description,
      category: category || 'Community',
      tags: ['community'],
      difficulty: 'intermediate' as Difficulty,
    });
  }

  return useCases;
}

/**
 * Merge static and remote use cases, deduplicating by title (case-insensitive).
 * Static use cases take precedence.
 */
export function mergeUseCases(staticCases: UseCase[], remoteCases: UseCase[]): UseCase[] {
  const seenTitles = new Set(staticCases.map((uc) => uc.title.toLowerCase()));
  const unique = remoteCases.filter((uc) => !seenTitles.has(uc.title.toLowerCase()));
  return [...staticCases, ...unique];
}

/**
 * Fetch community use cases from the awesome-openclaw-usecases repo.
 * Returns cached data if fresh; otherwise fetches, parses, and caches.
 * Returns empty array on failure (never throws).
 */
export async function fetchRemoteUseCases(): Promise<UseCase[]> {
  let cached: CacheEntry | null = null;

  try {
    const raw = await getConfig(CACHE_KEY);
    if (raw) cached = JSON.parse(raw) as CacheEntry;
  } catch {
    // corrupt cache — ignore
  }

  // Return fresh cache
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.useCases;
  }

  // Fetch from GitHub
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const res = await fetch(REMOTE_README_URL, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) return cached?.useCases ?? [];

    const markdown = await res.text();
    const useCases = parseReadmeUseCases(markdown);

    // Cache result
    const entry: CacheEntry = { fetchedAt: Date.now(), useCases };
    await setConfig(CACHE_KEY, JSON.stringify(entry)).catch(() => {});

    return useCases;
  } catch {
    // Network error — fall back to stale cache if available
    return cached?.useCases ?? [];
  }
}
