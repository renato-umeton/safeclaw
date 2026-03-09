// ---------------------------------------------------------------------------
// SafeClaw — CV upload + WHY-based recommendations tests (TDD)
// ---------------------------------------------------------------------------

import { extractKeywords, scoreUseCaseDetailed, getRecommendationsWithReasons } from '../src/recommendations';
import type { UseCase, UserProfile } from '../src/types';

const sampleUseCases: UseCase[] = [
  {
    id: 'dev-1',
    title: 'Code Review',
    description: 'Review Python code for bugs and best practices using automated analysis.',
    category: 'Development',
    tags: ['code-review', 'programming', 'python', 'github'],
    difficulty: 'beginner',
  },
  {
    id: 'content-1',
    title: 'Social Media Posts',
    description: 'Create engaging social media content for Instagram and LinkedIn marketing campaigns.',
    category: 'Content Creation',
    tags: ['social-media', 'instagram', 'linkedin', 'marketing'],
    difficulty: 'beginner',
  },
  {
    id: 'data-1',
    title: 'CSV Analysis',
    description: 'Analyze data files and generate statistical summaries with visualization.',
    category: 'Data Analysis',
    tags: ['csv', 'data', 'analysis', 'statistics'],
    difficulty: 'intermediate',
  },
];

const cvProfile: UserProfile = {
  resumeText: 'Senior Python developer with experience in machine learning and data analysis',
  cvFileName: 'john_doe_cv.txt',
  socialLinks: {
    linkedin: '',
    instagram: '',
    github: 'https://github.com/janedev',
    twitter: '',
    reddit: '',
  },
};

const profileWithoutCv: UserProfile = {
  resumeText: 'Marketing professional with social media expertise',
  cvFileName: '',
  socialLinks: {
    linkedin: 'https://linkedin.com/in/marketer',
    instagram: 'https://instagram.com/marketer',
    github: '',
    twitter: '',
    reddit: '',
  },
};

describe('CV upload and WHY-based recommendations', () => {
  describe('extractKeywords with CV data', () => {
    it('extracts keywords from resume text including CV content', () => {
      const kw = extractKeywords(cvProfile);
      expect(kw).toContain('python');
      expect(kw).toContain('developer');
      expect(kw).toContain('machine');
      expect(kw).toContain('learning');
      expect(kw).toContain('data');
      expect(kw).toContain('analysis');
    });

    it('works with cvFileName field present but empty', () => {
      const profile: UserProfile = {
        resumeText: 'Designer',
        cvFileName: '',
        socialLinks: { linkedin: '', instagram: '', github: '', twitter: '', reddit: '' },
      };
      const kw = extractKeywords(profile);
      expect(kw).toContain('designer');
    });
  });

  describe('scoreUseCaseDetailed', () => {
    it('returns score and matched keywords', () => {
      const result = scoreUseCaseDetailed(sampleUseCases[0], ['python', 'programming']);
      expect(result.score).toBeGreaterThan(0);
      expect(result.matchedKeywords).toContain('python');
      expect(result.matchedKeywords).toContain('programming');
    });

    it('returns empty matchedKeywords when nothing matches', () => {
      const result = scoreUseCaseDetailed(sampleUseCases[2], ['ruby', 'frontend']);
      expect(result.score).toBe(0);
      expect(result.matchedKeywords).toEqual([]);
    });

    it('includes keywords matching via tag partial match', () => {
      // 'code' should partially match 'code-review' tag
      const result = scoreUseCaseDetailed(sampleUseCases[0], ['code']);
      expect(result.score).toBeGreaterThan(0);
      expect(result.matchedKeywords).toContain('code');
    });

    it('includes keywords matching from description', () => {
      const result = scoreUseCaseDetailed(sampleUseCases[0], ['bugs']);
      expect(result.score).toBeGreaterThan(0);
      expect(result.matchedKeywords).toContain('bugs');
    });

    it('returns 0 score for empty keywords', () => {
      const result = scoreUseCaseDetailed(sampleUseCases[0], []);
      expect(result.score).toBe(0);
      expect(result.matchedKeywords).toEqual([]);
    });
  });

  describe('getRecommendationsWithReasons', () => {
    it('returns scored use cases with matchedKeywords', () => {
      const recs = getRecommendationsWithReasons(sampleUseCases, cvProfile, 5);
      expect(recs.length).toBeGreaterThan(0);
      // Top result should have matched keywords
      expect(recs[0].matchedKeywords.length).toBeGreaterThan(0);
    });

    it('returns sorted by score descending', () => {
      const recs = getRecommendationsWithReasons(sampleUseCases, cvProfile);
      for (let i = 1; i < recs.length; i++) {
        expect(recs[i - 1].score).toBeGreaterThanOrEqual(recs[i].score);
      }
    });

    it('returns matchedKeywords as empty array when profile is null', () => {
      const recs = getRecommendationsWithReasons(sampleUseCases, null);
      for (const r of recs) {
        expect(r.score).toBe(0);
        expect(r.matchedKeywords).toEqual([]);
      }
    });

    it('returns matchedKeywords as empty array for empty profile', () => {
      const emptyProfile: UserProfile = {
        resumeText: '',
        cvFileName: '',
        socialLinks: { linkedin: '', instagram: '', github: '', twitter: '', reddit: '' },
      };
      const recs = getRecommendationsWithReasons(sampleUseCases, emptyProfile);
      for (const r of recs) {
        expect(r.matchedKeywords).toEqual([]);
      }
    });

    it('respects limit parameter', () => {
      const recs = getRecommendationsWithReasons(sampleUseCases, cvProfile, 2);
      expect(recs).toHaveLength(2);
    });

    it('dev profile matches development use cases with relevant keywords', () => {
      const recs = getRecommendationsWithReasons(sampleUseCases, cvProfile, 3);
      const devRec = recs.find((r) => r.id === 'dev-1');
      expect(devRec).toBeDefined();
      expect(devRec!.matchedKeywords).toContain('python');
    });

    it('data analysis keywords match data use cases', () => {
      const recs = getRecommendationsWithReasons(sampleUseCases, cvProfile);
      const dataRec = recs.find((r) => r.id === 'data-1');
      expect(dataRec).toBeDefined();
      expect(dataRec!.score).toBeGreaterThan(0);
      expect(dataRec!.matchedKeywords.length).toBeGreaterThan(0);
    });
  });
});

describe('UserProfile with cvFileName', () => {
  it('supports cvFileName property', () => {
    const profile: UserProfile = {
      resumeText: 'test resume',
      cvFileName: 'my_cv.txt',
      socialLinks: { linkedin: '', instagram: '', github: '', twitter: '', reddit: '' },
    };
    expect(profile.cvFileName).toBe('my_cv.txt');
  });

  it('cvFileName defaults to empty string for no upload', () => {
    const profile: UserProfile = {
      resumeText: 'test',
      cvFileName: '',
      socialLinks: { linkedin: '', instagram: '', github: '', twitter: '', reddit: '' },
    };
    expect(profile.cvFileName).toBe('');
  });
});
