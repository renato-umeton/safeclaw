import { USE_CASES } from '../../src/use-cases';
import { getRecommendations } from '../../src/recommendations';
import type { UserProfile } from '../../src/types';

// Integration tests: real catalog + real recommendation engine (no mocks)

describe('use-cases personalization integration', () => {
  it('recommendation engine uses actual catalog data', () => {
    const profile: UserProfile = {
      resumeText: 'Developer',
      cvFileName: '',
      socialLinks: { linkedin: '', instagram: '', github: '', twitter: '', reddit: '' },
    };
    const recs = getRecommendations(USE_CASES, profile);
    expect(recs).toHaveLength(USE_CASES.length);
  });

  it('profile with "python developer" resume ranks development use cases higher', () => {
    const profile: UserProfile = {
      resumeText: 'Senior Python developer with experience in code review and debugging',
      cvFileName: '',
      socialLinks: { linkedin: '', instagram: '', github: '', twitter: '', reddit: '' },
    };
    const recs = getRecommendations(USE_CASES, profile, 3);
    // Top results should include development-related use cases
    const topCategories = recs.map((r) => r.category);
    expect(topCategories).toContain('Development');
  });

  it('profile with instagram link boosts content creation use cases', () => {
    const profile: UserProfile = {
      resumeText: 'Marketing professional',
      cvFileName: '',
      socialLinks: {
        linkedin: '',
        instagram: 'https://instagram.com/marketer',
        github: '',
        twitter: '',
        reddit: '',
      },
    };
    const recs = getRecommendations(USE_CASES, profile, 3);
    const topCategories = recs.map((r) => r.category);
    expect(topCategories).toContain('Content Creation');
  });

  it('profile with github link boosts development use cases', () => {
    const profile: UserProfile = {
      resumeText: 'Software engineer',
      cvFileName: '',
      socialLinks: {
        linkedin: '',
        instagram: '',
        github: 'https://github.com/dev',
        twitter: '',
        reddit: '',
      },
    };
    const recs = getRecommendations(USE_CASES, profile, 3);
    const topCategories = recs.map((r) => r.category);
    expect(topCategories).toContain('Development');
  });

  it('empty profile returns all use cases with score 0', () => {
    const recs = getRecommendations(USE_CASES, null);
    expect(recs).toHaveLength(USE_CASES.length);
    for (const r of recs) {
      expect(r.score).toBe(0);
    }
  });

  it('CV-based profile provides matchedKeywords in recommendations', () => {
    const profile: UserProfile = {
      resumeText: 'Data scientist with Python and machine learning expertise in statistical analysis',
      cvFileName: 'resume.txt',
      socialLinks: { linkedin: '', instagram: '', github: '', twitter: '', reddit: '' },
    };
    const recs = getRecommendations(USE_CASES, profile, 5);
    const scoredRecs = recs.filter((r) => r.score > 0);
    expect(scoredRecs.length).toBeGreaterThan(0);
    for (const r of scoredRecs) {
      expect(r.matchedKeywords.length).toBeGreaterThan(0);
    }
  });
});
