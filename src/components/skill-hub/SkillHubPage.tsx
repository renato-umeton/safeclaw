// ---------------------------------------------------------------------------
// SafeClaw — Skill Hub page (ClawHub integration)
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { Search, Download, X, ExternalLink } from 'lucide-react';
import { useSkillHubStore } from '../../stores/skill-hub-store.js';
import type { HubSkill } from '../../types.js';

function SkillCard({
  skill,
  onSelect,
}: {
  skill: HubSkill;
  onSelect: (slug: string) => void;
}) {
  return (
    <div
      className="card card-bordered bg-base-200 cursor-pointer hover:bg-base-300 transition-colors"
      onClick={() => onSelect(skill.slug)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect(skill.slug);
      }}
    >
      <div className="card-body p-4 gap-2">
        <h4 className="card-title text-sm">{skill.name}</h4>
        <p className="text-xs opacity-70 line-clamp-2">{skill.description}</p>
        <div className="flex flex-wrap gap-1.5 mt-1 items-center">
          <span className="badge badge-sm badge-outline">{skill.author}</span>
          <span className="badge badge-sm badge-ghost">v{skill.version}</span>
          <span className="flex items-center gap-0.5 text-xs opacity-50">
            <Download className="w-3 h-3" />
            {skill.downloads.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

export function SkillHubPage() {
  const {
    skills,
    loading,
    error,
    nextCursor,
    selectedSkill,
    selectedSkillLoading,
    browse,
    search,
    loadMore,
    selectSkill,
    clearSelection,
  } = useSkillHubStore();

  const [searchInput, setSearchInput] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    browse();
  }, [browse]);

  function handleSearchChange(value: string) {
    setSearchInput(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      if (value.trim()) {
        search(value.trim());
      } else {
        browse();
      }
    }, 300);
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Skill Hub</h2>
        <span className="text-xs opacity-50">
          Powered by <a href="https://clawhub.ai" target="_blank" rel="noopener noreferrer" className="link link-primary">ClawHub</a>
        </span>
      </div>

      {/* Search bar */}
      <div className="form-control">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
          <input
            type="text"
            className="input input-bordered w-full pl-10"
            placeholder="Search skills..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading && skills.length === 0 && (
        <div className="flex justify-center py-12" data-testid="skill-hub-loading">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      )}

      {/* Skill grid */}
      {skills.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {skills.map((skill) => (
            <SkillCard key={skill.slug} skill={skill} onSelect={selectSkill} />
          ))}
        </div>
      ) : (
        !loading && (
          <div className="text-center py-12 opacity-50">
            <p>No skills found. Try a different search query.</p>
          </div>
        )
      )}

      {/* Load more */}
      {nextCursor && (
        <div className="text-center">
          <button
            className="btn btn-outline btn-sm"
            onClick={loadMore}
            disabled={loading}
          >
            {loading ? (
              <span className="loading loading-spinner loading-xs" />
            ) : null}
            Load More
          </button>
        </div>
      )}

      {/* Skill detail modal */}
      {(selectedSkill || selectedSkillLoading) && (
        <div
          className="modal modal-open"
          data-testid={selectedSkillLoading ? 'skill-detail-loading' : 'skill-detail-modal'}
        >
          <div className="modal-box max-w-2xl">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              onClick={clearSelection}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            {selectedSkillLoading ? (
              <div className="flex justify-center py-8">
                <span className="loading loading-spinner loading-lg text-primary" />
              </div>
            ) : selectedSkill ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold">{selectedSkill.name}</h3>
                  <p className="text-sm opacity-70">{selectedSkill.description}</p>
                </div>

                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="badge badge-outline">{selectedSkill.author}</span>
                  <span className="badge badge-ghost">v{selectedSkill.version}</span>
                  <span className="flex items-center gap-1 opacity-60">
                    <Download className="w-3.5 h-3.5" />
                    {selectedSkill.downloads.toLocaleString()} downloads
                  </span>
                </div>

                {/* Install command */}
                <div className="bg-base-200 rounded-lg p-3">
                  <p className="text-xs opacity-50 mb-1">Install with:</p>
                  <code className="text-sm select-all">
                    npx clawhub@latest install {selectedSkill.slug}
                  </code>
                </div>

                {/* SKILL.md content */}
                {selectedSkill.readme && (
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap text-xs bg-base-200 p-4 rounded-lg overflow-auto max-h-96">
                      {selectedSkill.readme}
                    </pre>
                  </div>
                )}

                <div className="modal-action">
                  <a
                    href={`https://clawhub.ai/skills/${selectedSkill.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm btn-primary gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    View on ClawHub
                  </a>
                  <button className="btn btn-sm" onClick={clearSelection}>
                    Close
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <div className="modal-backdrop" onClick={clearSelection} />
        </div>
      )}
    </div>
  );
}
