import { extractKeywords, scoreUseCase, getRecommendations } from '../src/recommendations';
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

const devProfile: UserProfile = {
  resumeText: 'Senior Python developer with experience in machine learning',
  cvFileName: '',
  socialLinks: {
    linkedin: '',
    instagram: '',
    github: 'https://github.com/janedev',
    twitter: '',
    reddit: '',
  },
};

const contentProfile: UserProfile = {
  resumeText: 'Marketing manager specializing in social media campaigns',
  cvFileName: '',
  socialLinks: {
    linkedin: 'https://linkedin.com/in/marketer',
    instagram: 'https://instagram.com/marketer',
    github: '',
    twitter: '',
    reddit: '',
  },
};

const emptyProfile: UserProfile = {
  resumeText: '',
  cvFileName: '',
  socialLinks: { linkedin: '', instagram: '', github: '', twitter: '', reddit: '' },
};

describe('recommendation engine', () => {
  describe('extractKeywords', () => {
    it('extracts words from resume text, lowercased', () => {
      const kw = extractKeywords(devProfile);
      expect(kw).toContain('python');
      expect(kw).toContain('developer');
      expect(kw).toContain('machine');
      expect(kw).toContain('learning');
    });

    it('extracts platform names from non-empty social links', () => {
      const kw = extractKeywords(devProfile);
      expect(kw).toContain('github');
    });

    it('does not include platforms with empty links', () => {
      const kw = extractKeywords(devProfile);
      expect(kw).not.toContain('instagram');
      expect(kw).not.toContain('twitter');
    });

    it('deduplicates keywords', () => {
      const profile: UserProfile = {
        resumeText: 'python Python PYTHON',
        cvFileName: '',
        socialLinks: { linkedin: '', instagram: '', github: '', twitter: '', reddit: '' },
      };
      const kw = extractKeywords(profile);
      const pythonCount = kw.filter((k) => k === 'python').length;
      expect(pythonCount).toBe(1);
    });

    it('filters out common stop words', () => {
      const profile: UserProfile = {
        resumeText: 'I am a developer with the best skills and good experience in code',
        cvFileName: '',
        socialLinks: { linkedin: '', instagram: '', github: '', twitter: '', reddit: '' },
      };
      const kw = extractKeywords(profile);
      expect(kw).not.toContain('the');
      expect(kw).not.toContain('and');
      expect(kw).not.toContain('with');
      expect(kw).not.toContain('a');
      expect(kw).not.toContain('in');
      expect(kw).not.toContain('am');
      expect(kw).toContain('developer');
    });

    it('returns empty array for empty profile', () => {
      expect(extractKeywords(emptyProfile)).toEqual([]);
    });
  });

  describe('scoreUseCase', () => {
    it('returns 0 when no keywords match tags or description', () => {
      const score = scoreUseCase(sampleUseCases[2], ['ruby', 'frontend']);
      expect(score).toBe(0);
    });

    it('returns higher score for tag matches than description matches', () => {
      // 'python' is in tags of dev-1 and also in description
      const tagScore = scoreUseCase(sampleUseCases[0], ['python']);
      // 'bugs' is only in description of dev-1
      const descScore = scoreUseCase(sampleUseCases[0], ['bugs']);
      expect(tagScore).toBeGreaterThan(descScore);
    });

    it('scores increase with more keyword matches', () => {
      const oneMatch = scoreUseCase(sampleUseCases[0], ['python']);
      const twoMatches = scoreUseCase(sampleUseCases[0], ['python', 'programming']);
      expect(twoMatches).toBeGreaterThan(oneMatch);
    });

    it('gives bonus for social platform relevance', () => {
      // github keyword should boost development use cases (which have github tag)
      const withGithub = scoreUseCase(sampleUseCases[0], ['github']);
      expect(withGithub).toBeGreaterThan(0);
    });
  });

  describe('getRecommendations', () => {
    it('returns all use cases sorted by score descending when profile has keywords', () => {
      const recs = getRecommendations(sampleUseCases, devProfile);
      expect(recs).toHaveLength(sampleUseCases.length);
      for (let i = 1; i < recs.length; i++) {
        expect(recs[i - 1].score).toBeGreaterThanOrEqual(recs[i].score);
      }
    });

    it('returns use cases with score 0 when profile is empty', () => {
      const recs = getRecommendations(sampleUseCases, emptyProfile);
      for (const r of recs) {
        expect(r.score).toBe(0);
      }
    });

    it('returns use cases with score 0 when profile is null', () => {
      const recs = getRecommendations(sampleUseCases, null);
      for (const r of recs) {
        expect(r.score).toBe(0);
      }
    });

    it('returns top N when limit is specified', () => {
      const recs = getRecommendations(sampleUseCases, devProfile, 2);
      expect(recs).toHaveLength(2);
    });

    it('prioritizes use cases matching resume skills', () => {
      const recs = getRecommendations(sampleUseCases, devProfile);
      // dev-1 has 'python' tag matching resume 'Python developer'
      expect(recs[0].id).toBe('dev-1');
    });

    it('boosts use cases related to linked social platforms', () => {
      const recs = getRecommendations(sampleUseCases, contentProfile);
      // content-1 has instagram/linkedin tags matching contentProfile's social links
      expect(recs[0].id).toBe('content-1');
    });

    it('includes matchedKeywords in results', () => {
      const recs = getRecommendations(sampleUseCases, devProfile);
      const devRec = recs.find((r) => r.id === 'dev-1')!;
      expect(devRec.matchedKeywords).toBeDefined();
      expect(devRec.matchedKeywords.length).toBeGreaterThan(0);
      expect(devRec.matchedKeywords).toContain('python');
    });
  });
});
