// ---------------------------------------------------------------------------
// SafeClaw — Recommendation engine (pure functions)
// ---------------------------------------------------------------------------

import type { UseCase, UserProfile, ScoredUseCase } from './types.js';

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'is', 'am', 'are', 'was', 'were',
  'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'to', 'of',
  'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
  'during', 'before', 'after', 'above', 'below', 'between', 'out', 'off',
  'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there',
  'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'not', 'only', 'own',
  'same', 'so', 'than', 'too', 'very', 'just', 'because', 'about', 'up',
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'you', 'your', 'he',
  'him', 'his', 'she', 'her', 'it', 'its', 'they', 'them', 'their', 'this',
  'that', 'these', 'those', 'what', 'which', 'who', 'whom',
]);

const TAG_MATCH_WEIGHT = 3;
const DESC_MATCH_WEIGHT = 1;

const SOCIAL_PLATFORMS = ['linkedin', 'instagram', 'github', 'twitter', 'reddit'] as const;

/**
 * Extract searchable keywords from a user profile.
 */
export function extractKeywords(profile: UserProfile): string[] {
  const words = new Set<string>();

  // Tokenize resume text
  if (profile.resumeText) {
    const tokens = profile.resumeText
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
    for (const t of tokens) words.add(t);
  }

  // Add platform names for non-empty social links
  for (const platform of SOCIAL_PLATFORMS) {
    if (profile.socialLinks[platform]) {
      words.add(platform);
    }
  }

  return [...words];
}

/**
 * Score a single use case against a set of keywords.
 */
export function scoreUseCase(useCase: UseCase, keywords: string[]): number {
  if (keywords.length === 0) return 0;

  let score = 0;
  const descWords = useCase.description.toLowerCase().split(/[^a-z0-9]+/);
  const tagSet = new Set(useCase.tags.map((t) => t.toLowerCase()));

  for (const kw of keywords) {
    // Tag matches are weighted higher
    if (tagSet.has(kw)) {
      score += TAG_MATCH_WEIGHT;
    }
    // Check if keyword appears in any tag (partial match)
    for (const tag of tagSet) {
      if (tag !== kw && tag.includes(kw)) {
        score += TAG_MATCH_WEIGHT;
        break;
      }
    }
    // Description word matches
    if (descWords.includes(kw)) {
      score += DESC_MATCH_WEIGHT;
    }
  }

  return score;
}

/**
 * Rank use cases by relevance to a user profile.
 */
export function getRecommendations(
  useCases: UseCase[],
  profile: UserProfile | null,
  limit?: number,
): ScoredUseCase[] {
  const keywords = profile ? extractKeywords(profile) : [];

  const scored: ScoredUseCase[] = useCases.map((uc) => ({
    ...uc,
    score: scoreUseCase(uc, keywords),
  }));

  scored.sort((a, b) => b.score - a.score);

  return limit ? scored.slice(0, limit) : scored;
}
