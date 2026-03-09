import type { UserProfile } from '../src/types';

// Module-reset pattern (same as db.test.ts)
let openDatabase: typeof import('../src/db').openDatabase;
let saveUserProfile: typeof import('../src/db').saveUserProfile;
let getUserProfile: typeof import('../src/db').getUserProfile;
let clearUserProfile: typeof import('../src/db').clearUserProfile;

let dbConnection: IDBDatabase | null = null;

async function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

const fullProfile: UserProfile = {
  resumeText: 'Senior Python developer with 10 years experience in machine learning and data science.',
  cvFileName: 'jane_doe_cv.txt',
  socialLinks: {
    linkedin: 'https://linkedin.com/in/janedev',
    instagram: 'https://instagram.com/janedev',
    github: 'https://github.com/janedev',
    twitter: 'https://twitter.com/janedev',
    reddit: 'https://reddit.com/u/janedev',
  },
};

describe('user profile persistence', () => {
  beforeEach(async () => {
    if (dbConnection) {
      dbConnection.close();
      dbConnection = null;
    }
    vi.resetModules();
    await deleteDatabase('safeclaw');
    await deleteDatabase('openbrowserclaw');

    const mod = await import('../src/db');
    openDatabase = mod.openDatabase;
    saveUserProfile = mod.saveUserProfile;
    getUserProfile = mod.getUserProfile;
    clearUserProfile = mod.clearUserProfile;

    dbConnection = await openDatabase();
  });

  afterAll(() => {
    if (dbConnection) {
      dbConnection.close();
      dbConnection = null;
    }
  });

  it('getUserProfile returns null when no profile exists', async () => {
    const profile = await getUserProfile();
    expect(profile).toBeNull();
  });

  it('saveUserProfile stores and getUserProfile retrieves profile', async () => {
    await saveUserProfile(fullProfile);
    const profile = await getUserProfile();
    expect(profile).toEqual(fullProfile);
  });

  it('saveUserProfile overwrites existing profile', async () => {
    await saveUserProfile(fullProfile);
    const updated: UserProfile = {
      resumeText: 'Updated resume',
      cvFileName: '',
      socialLinks: {
        linkedin: '',
        instagram: '',
        github: 'https://github.com/updated',
        twitter: '',
        reddit: '',
      },
    };
    await saveUserProfile(updated);
    const profile = await getUserProfile();
    expect(profile).toEqual(updated);
  });

  it('round-trips all fields including socialLinks', async () => {
    await saveUserProfile(fullProfile);
    const profile = await getUserProfile();
    expect(profile!.resumeText).toBe(fullProfile.resumeText);
    expect(profile!.socialLinks.linkedin).toBe(fullProfile.socialLinks.linkedin);
    expect(profile!.socialLinks.instagram).toBe(fullProfile.socialLinks.instagram);
    expect(profile!.socialLinks.github).toBe(fullProfile.socialLinks.github);
    expect(profile!.socialLinks.twitter).toBe(fullProfile.socialLinks.twitter);
    expect(profile!.socialLinks.reddit).toBe(fullProfile.socialLinks.reddit);
  });

  it('handles empty/partial profiles', async () => {
    const emptyProfile: UserProfile = {
      resumeText: '',
      cvFileName: '',
      socialLinks: {
        linkedin: '',
        instagram: '',
        github: '',
        twitter: '',
        reddit: '',
      },
    };
    await saveUserProfile(emptyProfile);
    const profile = await getUserProfile();
    expect(profile).toEqual(emptyProfile);
  });

  it('clearUserProfile removes the profile', async () => {
    await saveUserProfile(fullProfile);
    await clearUserProfile();
    const profile = await getUserProfile();
    expect(profile).toBeNull();
  });
});
