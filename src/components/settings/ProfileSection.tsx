// ---------------------------------------------------------------------------
// SafeClaw — Profile section for settings
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { User, Check } from 'lucide-react';
import { getUserProfile, saveUserProfile, clearUserProfile } from '../../db.js';
import type { UserProfile } from '../../types.js';

const EMPTY_LINKS = { linkedin: '', instagram: '', github: '', twitter: '', reddit: '' };

export function ProfileSection() {
  const [resumeText, setResumeText] = useState('');
  const [socialLinks, setSocialLinks] = useState({ ...EMPTY_LINKS });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getUserProfile().then((profile) => {
      if (profile) {
        setResumeText(profile.resumeText);
        setSocialLinks(profile.socialLinks);
      }
    });
  }, []);

  function updateLink(platform: keyof typeof EMPTY_LINKS, value: string) {
    setSocialLinks((prev) => ({ ...prev, [platform]: value }));
  }

  async function handleSave() {
    const profile: UserProfile = { resumeText, socialLinks };
    await saveUserProfile(profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleClear() {
    await clearUserProfile();
    setResumeText('');
    setSocialLinks({ ...EMPTY_LINKS });
  }

  return (
    <div className="card card-bordered bg-base-200">
      <div className="card-body p-4 sm:p-6 gap-3">
        <h3 className="card-title text-base gap-2"><User className="w-4 h-4" /> Your Profile</h3>
        <p className="text-xs opacity-50">
          Add your background to get personalized use-case recommendations.
        </p>

        <fieldset className="fieldset">
          <legend className="fieldset-legend">Resume / Skills</legend>
          <textarea
            className="textarea textarea-bordered w-full h-24 text-sm"
            placeholder="Paste your resume, skills, or describe your background..."
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
          />
        </fieldset>

        <fieldset className="fieldset">
          <legend className="fieldset-legend">Social Profiles</legend>
          <div className="space-y-2">
            <input
              type="url"
              className="input input-bordered input-sm w-full"
              placeholder="LinkedIn URL"
              value={socialLinks.linkedin}
              onChange={(e) => updateLink('linkedin', e.target.value)}
            />
            <input
              type="url"
              className="input input-bordered input-sm w-full"
              placeholder="Instagram URL"
              value={socialLinks.instagram}
              onChange={(e) => updateLink('instagram', e.target.value)}
            />
            <input
              type="url"
              className="input input-bordered input-sm w-full"
              placeholder="GitHub URL"
              value={socialLinks.github}
              onChange={(e) => updateLink('github', e.target.value)}
            />
            <input
              type="url"
              className="input input-bordered input-sm w-full"
              placeholder="Twitter / X URL"
              value={socialLinks.twitter}
              onChange={(e) => updateLink('twitter', e.target.value)}
            />
            <input
              type="url"
              className="input input-bordered input-sm w-full"
              placeholder="Reddit URL"
              value={socialLinks.reddit}
              onChange={(e) => updateLink('reddit', e.target.value)}
            />
          </div>
        </fieldset>

        <div className="flex items-center gap-2">
          <button className="btn btn-primary btn-sm" onClick={handleSave}>
            Save Profile
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handleClear}>
            Clear Profile
          </button>
          {saved && (
            <span className="text-success text-sm flex items-center gap-1">
              <Check className="w-4 h-4" /> Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
