import { detectBumpType, checkDocsUpdated, detectReleaseChannel, isDevVersion, REQUIRED_DOC_FILES } from '../src/version-check';

describe('version-check', () => {
  describe('detectBumpType', () => {
    it('returns "major" when major version increases', () => {
      expect(detectBumpType('1.0.0', '2.0.0')).toBe('major');
    });

    it('returns "major" when major increases with non-zero minor/patch', () => {
      expect(detectBumpType('1.2.3', '2.0.0')).toBe('major');
    });

    it('returns "major" when major jumps by more than one', () => {
      expect(detectBumpType('1.0.0', '3.0.0')).toBe('major');
    });

    it('returns "minor" when minor version increases', () => {
      expect(detectBumpType('1.0.0', '1.1.0')).toBe('minor');
    });

    it('returns "minor" when minor increases with non-zero patch', () => {
      expect(detectBumpType('1.2.3', '1.3.0')).toBe('minor');
    });

    it('returns "minor" when minor jumps by more than one', () => {
      expect(detectBumpType('1.0.0', '1.5.0')).toBe('minor');
    });

    it('returns "patch" when only patch version increases', () => {
      expect(detectBumpType('1.0.0', '1.0.1')).toBe('patch');
    });

    it('returns "patch" when patch jumps by more than one', () => {
      expect(detectBumpType('1.0.0', '1.0.5')).toBe('patch');
    });

    it('returns "none" when versions are identical', () => {
      expect(detectBumpType('1.0.0', '1.0.0')).toBe('none');
    });

    it('returns "none" when head version is lower (downgrade)', () => {
      expect(detectBumpType('2.0.0', '1.0.0')).toBe('none');
    });

    it('returns "none" when minor is lower even if patch is higher', () => {
      expect(detectBumpType('1.2.0', '1.1.5')).toBe('none');
    });

    it('throws on invalid base version', () => {
      expect(() => detectBumpType('invalid', '1.0.0')).toThrow();
    });

    it('throws on invalid head version', () => {
      expect(() => detectBumpType('1.0.0', 'bad')).toThrow();
    });

    it('throws on incomplete version string', () => {
      expect(() => detectBumpType('1.0', '1.0.0')).toThrow();
    });

    it('handles dev pre-release versions by comparing base semver', () => {
      expect(detectBumpType('1.0.0', '1.1.0-dev.1')).toBe('minor');
    });

    it('handles comparing two dev versions', () => {
      expect(detectBumpType('1.0.0-dev.1', '2.0.0-dev.1')).toBe('major');
    });

    it('returns "none" for same base version with different dev suffixes', () => {
      expect(detectBumpType('1.0.0-dev.1', '1.0.0-dev.2')).toBe('none');
    });

    it('returns "patch" for dev to dev patch bump', () => {
      expect(detectBumpType('1.0.0-dev.1', '1.0.1-dev.1')).toBe('patch');
    });
  });

  describe('detectReleaseChannel', () => {
    it('returns "stable" for standard semver versions', () => {
      expect(detectReleaseChannel('1.0.0')).toBe('stable');
      expect(detectReleaseChannel('2.1.3')).toBe('stable');
    });

    it('returns "dev" for versions with -dev suffix', () => {
      expect(detectReleaseChannel('1.0.0-dev.1')).toBe('dev');
      expect(detectReleaseChannel('2.1.0-dev.5')).toBe('dev');
    });

    it('returns "stable" for other pre-release suffixes', () => {
      expect(detectReleaseChannel('1.0.0-beta.1')).toBe('stable');
      expect(detectReleaseChannel('1.0.0-rc.1')).toBe('stable');
    });
  });

  describe('isDevVersion', () => {
    it('returns true for dev versions', () => {
      expect(isDevVersion('1.0.0-dev.1')).toBe(true);
    });

    it('returns false for stable versions', () => {
      expect(isDevVersion('1.0.0')).toBe(false);
    });
  });

  describe('REQUIRED_DOC_FILES', () => {
    it('contains the four required documentation files', () => {
      expect(REQUIRED_DOC_FILES).toEqual([
        'CLAUDE.md',
        'CONTRIBUTING.md',
        'README.md',
        'docs/website/index.html',
      ]);
    });
  });

  describe('checkDocsUpdated', () => {
    it('passes for minor bump when all doc files are changed', () => {
      const changed = [
        'CLAUDE.md',
        'CONTRIBUTING.md',
        'README.md',
        'docs/website/index.html',
        'src/foo.ts',
      ];
      const result = checkDocsUpdated('minor', changed);
      expect(result.passed).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('passes for major bump when all doc files are changed', () => {
      const changed = [
        'CLAUDE.md',
        'CONTRIBUTING.md',
        'README.md',
        'docs/website/index.html',
      ];
      const result = checkDocsUpdated('major', changed);
      expect(result.passed).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('fails for minor bump when some doc files are missing', () => {
      const changed = ['CLAUDE.md', 'README.md', 'src/foo.ts'];
      const result = checkDocsUpdated('minor', changed);
      expect(result.passed).toBe(false);
      expect(result.missing).toEqual(['CONTRIBUTING.md', 'docs/website/index.html']);
    });

    it('fails for major bump when no doc files are changed', () => {
      const changed = ['src/foo.ts', 'package.json'];
      const result = checkDocsUpdated('major', changed);
      expect(result.passed).toBe(false);
      expect(result.missing).toEqual(REQUIRED_DOC_FILES);
    });

    it('passes for patch bump even with no doc files changed', () => {
      const result = checkDocsUpdated('patch', ['src/foo.ts']);
      expect(result.passed).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('passes for no bump even with no doc files changed', () => {
      const result = checkDocsUpdated('none', []);
      expect(result.passed).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('passes for patch bump even with empty changed files', () => {
      const result = checkDocsUpdated('patch', []);
      expect(result.passed).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('fails for minor bump with only one doc file changed', () => {
      const result = checkDocsUpdated('minor', ['CLAUDE.md']);
      expect(result.passed).toBe(false);
      expect(result.missing).toEqual([
        'CONTRIBUTING.md',
        'README.md',
        'docs/website/index.html',
      ]);
    });

    it('passes for dev channel even with minor bump and no doc files', () => {
      const result = checkDocsUpdated('minor', ['src/foo.ts'], 'dev');
      expect(result.passed).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('passes for dev channel even with major bump and no doc files', () => {
      const result = checkDocsUpdated('major', [], 'dev');
      expect(result.passed).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('still enforces docs for stable channel on minor bump', () => {
      const result = checkDocsUpdated('minor', [], 'stable');
      expect(result.passed).toBe(false);
      expect(result.missing).toEqual(REQUIRED_DOC_FILES);
    });
  });
});
