import { USE_CASES } from '../../src/use-cases';
import { getRecommendations } from '../../src/recommendations';
import type { UserProfile } from '../../src/types';

// Integration tests: real catalog + real recommendation engine (no mocks)

describe('use-cases personalization integration', () => {
  it('recommendation engine uses actual catalog data', () => {
    const profile: UserProfile = {
      resumeText: 'Developer',
      socialLinks: { linkedin: '', instagram: '', github: '', twitter: '', reddit: '' },
    };
    const recs = getRecommendations(USE_CASES, profile);
    expect(recs).toHaveLength(USE_CASES.length);
  });

  it('profile with "python developer" resume ranks development use cases higher', () => {
    const profile: UserProfile = {
      resumeText: 'Senior Python developer with experience in code review and debugging',
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
});
