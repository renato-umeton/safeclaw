export type BumpType = 'major' | 'minor' | 'patch' | 'none';

export const REQUIRED_DOC_FILES = [
  'CLAUDE.md',
  'CONTRIBUTING.md',
  'README.md',
  'docs/website/index.html',
] as const;

function parseVersion(version: string): [number, number, number] {
  const parts = version.split('.');
  if (parts.length !== 3) {
    throw new Error(`Invalid semver version: "${version}"`);
  }
  const nums = parts.map(Number) as [number, number, number];
  if (nums.some(isNaN)) {
    throw new Error(`Invalid semver version: "${version}"`);
  }
  return nums;
}

export function detectBumpType(baseVersion: string, headVersion: string): BumpType {
  const [baseMajor, baseMinor, basePatch] = parseVersion(baseVersion);
  const [headMajor, headMinor, headPatch] = parseVersion(headVersion);

  if (headMajor > baseMajor) return 'major';
  if (headMajor === baseMajor && headMinor > baseMinor) return 'minor';
  if (headMajor === baseMajor && headMinor === baseMinor && headPatch > basePatch) return 'patch';
  return 'none';
}

export function checkDocsUpdated(
  bumpType: BumpType,
  changedFiles: string[],
): { passed: boolean; missing: string[] } {
  if (bumpType === 'patch' || bumpType === 'none') {
    return { passed: true, missing: [] };
  }

  const missing = REQUIRED_DOC_FILES.filter(
    (f) => !changedFiles.includes(f),
  );

  return { passed: missing.length === 0, missing: [...missing] };
}
