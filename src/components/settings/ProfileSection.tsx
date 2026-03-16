// ---------------------------------------------------------------------------
// SafeClaw — Profile section for settings
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { User, Check, Upload, FileText, AlertCircle } from 'lucide-react';
import { getUserProfile, saveUserProfile, clearUserProfile } from '../../db.js';
import { convertCvToText, SUPPORTED_CV_EXTENSIONS } from '../../cv-converter.js';
import type { UserProfile } from '../../types.js';

const EMPTY_LINKS = { linkedin: '', instagram: '', github: '', twitter: '', reddit: '' };

export function ProfileSection() {
  const [resumeText, setResumeText] = useState('');
  const [cvFileName, setCvFileName] = useState('');
  const [socialLinks, setSocialLinks] = useState({ ...EMPTY_LINKS });
  const [saved, setSaved] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [converting, setConverting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getUserProfile().then((profile) => {
      if (profile) {
        setResumeText(profile.resumeText);
        setCvFileName(profile.cvFileName || '');
        setSocialLinks(profile.socialLinks);
      }
    });
  }, []);

  function updateLink(platform: keyof typeof EMPTY_LINKS, value: string) {
    setSocialLinks((prev) => ({ ...prev, [platform]: value }));
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError('');
    setConverting(true);
    try {
      const text = await convertCvToText(file);
      setResumeText(text);
      setCvFileName(file.name);
    } catch (err) {
      setUploadError((err as Error).message || 'Failed to convert file');
    } finally {
      setConverting(false);
    }
  }

  async function handleSave() {
    const profile: UserProfile = { resumeText, cvFileName, socialLinks };
    await saveUserProfile(profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleClear() {
    await clearUserProfile();
    setResumeText('');
    setCvFileName('');
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
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              className="btn btn-outline btn-sm gap-1"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-3.5 h-3.5" />
              Upload CV
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={SUPPORTED_CV_EXTENSIONS.join(',')}
              className="hidden"
              onChange={handleFileUpload}
            />
            {converting && (
              <span className="text-xs opacity-70 flex items-center gap-1">
                <span className="loading loading-spinner loading-xs" />
                Converting...
              </span>
            )}
            {cvFileName && !converting && (
              <span className="text-xs opacity-70 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                {cvFileName}
              </span>
            )}
            {uploadError && (
              <span className="text-xs text-error flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {uploadError}
              </span>
            )}
          </div>
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
