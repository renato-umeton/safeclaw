// ---------------------------------------------------------------------------
// SafeClaw — Use Cases page
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Search, X, ExternalLink, Play } from 'lucide-react';
import { USE_CASES, getAllCategories } from '../../use-cases.js';
import { getUserProfile } from '../../db.js';
import { getRecommendationsWithReasons } from '../../recommendations.js';
import { fetchRemoteUseCases, mergeUseCases, fetchUseCaseDetail } from '../../use-cases-remote.js';
import { useOrchestratorStore } from '../../stores/orchestrator-store.js';
import type { UseCase, ScoredUseCase, Difficulty, UserProfile } from '../../types.js';

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  beginner: 'badge-success',
  intermediate: 'badge-warning',
  advanced: 'badge-error',
};

const GITHUB_USECASES_URL =
  'https://github.com/hesamsheikh/awesome-openclaw-usecases/blob/main/usecases/';

function UseCaseCard({ useCase, onSelect }: { useCase: UseCase; onSelect: (uc: UseCase) => void }) {
  return (
    <div
      className="card card-bordered bg-base-200 cursor-pointer hover:bg-base-300 transition-colors"
      onClick={() => onSelect(useCase)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect(useCase);
      }}
    >
      <div className="card-body p-4 gap-2">
        <h4 className="card-title text-sm">{useCase.title}</h4>
        <p className="text-xs opacity-70">{useCase.description}</p>
        <div className="flex flex-wrap gap-1.5 mt-1">
          <span className="badge badge-sm badge-outline">{useCase.category}</span>
          <span className={`badge badge-sm ${DIFFICULTY_COLORS[useCase.difficulty]}`}>
            {useCase.difficulty}
          </span>
          {useCase.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="badge badge-sm badge-ghost">{tag}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function RecommendedCard({
  rec,
  maxScore,
  onSelect,
}: {
  rec: ScoredUseCase;
  maxScore: number;
  onSelect: (uc: UseCase) => void;
}) {
  const matchPercent = maxScore > 0 ? Math.round((rec.score / maxScore) * 100) : 0;

  return (
    <div
      className="card card-bordered bg-base-200 cursor-pointer hover:bg-base-300 transition-colors"
      onClick={() => onSelect(rec)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect(rec);
      }}
    >
      <div className="card-body p-4 gap-2">
        <h4 className="card-title text-sm">{rec.title}</h4>
        <p className="text-xs opacity-70">{rec.description}</p>

        {/* Match strength bar */}
        <div className="w-full" data-testid="match-bar">
          <div className="flex justify-between text-xs opacity-60 mb-0.5">
            <span>Match</span>
            <span>{matchPercent}%</span>
          </div>
          <div className="w-full bg-base-300 rounded-full h-1.5">
            <div
              className="bg-primary rounded-full h-1.5 transition-all"
              style={{ width: `${matchPercent}%` }}
            />
          </div>
        </div>

        {/* WHY explanation */}
        {rec.matchedKeywords.length > 0 && (
          <p className="text-xs opacity-60">
            <span className="font-semibold">Why:</span>{' '}
            Your profile mentions{' '}
            {rec.matchedKeywords.map((kw, i) => (
              <span key={kw}>
                {i > 0 && (i === rec.matchedKeywords.length - 1 ? ' and ' : ', ')}
                <span className="badge badge-xs badge-primary badge-outline">{kw}</span>
              </span>
            ))}
            {' '}which align with this workflow.
          </p>
        )}

        <div className="flex flex-wrap gap-1.5 mt-1">
          <span className="badge badge-sm badge-outline">{rec.category}</span>
          <span className={`badge badge-sm ${DIFFICULTY_COLORS[rec.difficulty]}`}>
            {rec.difficulty}
          </span>
          {rec.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="badge badge-sm badge-ghost">{tag}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function UseCasesPage() {
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [search, setSearch] = useState('');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [recommendations, setRecommendations] = useState<ScoredUseCase[]>([]);
  const [allUseCases, setAllUseCases] = useState<UseCase[]>(USE_CASES);

  // Detail modal state
  const [selectedUseCase, setSelectedUseCase] = useState<UseCase | null>(null);
  const [detailMarkdown, setDetailMarkdown] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    getUserProfile().then((p) => {
      setProfile(p);
      if (p) {
        const recs = getRecommendationsWithReasons(USE_CASES, p, 5);
        const scoredRecs = recs.filter((r) => r.score > 0);
        setRecommendations(scoredRecs);
      }
    });

    fetchRemoteUseCases().then((remote) => {
      if (remote.length > 0) {
        setAllUseCases((prev) => mergeUseCases(prev, remote));
      }
    });
  }, []);

  const categories = [...new Set(allUseCases.map((uc) => uc.category))];
  const maxScore = recommendations.length > 0 ? recommendations[0].score : 0;

  const filtered = allUseCases.filter((uc) => {
    if (category && uc.category !== category) return false;
    if (difficulty && uc.difficulty !== difficulty) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!uc.title.toLowerCase().includes(q) && !uc.description.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  function handleReset() {
    setCategory('');
    setDifficulty('');
    setSearch('');
  }

  function handleSelectUseCase(uc: UseCase) {
    setSelectedUseCase(uc);
    setDetailMarkdown(null);

    if (uc.sourceFile) {
      setDetailLoading(true);
      fetchUseCaseDetail(uc.sourceFile).then((md) => {
        setDetailMarkdown(md);
        setDetailLoading(false);
      });
    }
  }

  function handleCloseModal() {
    setSelectedUseCase(null);
    setDetailMarkdown(null);
    setDetailLoading(false);
  }

  function handleStartInChat() {
    if (!selectedUseCase) return;

    const prompt = detailMarkdown
      ? `Help me set up this workflow:\n\n# ${selectedUseCase.title}\n\n${detailMarkdown}`
      : `Help me set up this workflow: ${selectedUseCase.title}\n\n${selectedUseCase.description}`;

    const store = useOrchestratorStore.getState();
    store.newSession();
    store.sendMessage(prompt);
    navigate('/chat');
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      <h2 className="text-xl font-bold">Use Cases</h2>

      {/* Recommendations */}
      {profile && recommendations.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Recommended for You</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recommendations.map((rec) => (
              <div key={rec.id} data-testid="rec-card">
                <RecommendedCard rec={rec} maxScore={maxScore} onSelect={handleSelectUseCase} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="form-control">
          <label className="label py-0.5"><span className="label-text text-xs">Search</span></label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
            <input
              type="text"
              className="input input-bordered input-sm pl-8 w-52"
              placeholder="Search use cases..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="form-control">
          <label className="label py-0.5"><span className="label-text text-xs">Category</span></label>
          <select
            className="select select-bordered select-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Category"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="form-control">
          <label className="label py-0.5"><span className="label-text text-xs">Difficulty</span></label>
          <select
            className="select select-bordered select-sm"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            aria-label="Difficulty"
          >
            <option value="">All Levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>

        <button className="btn btn-ghost btn-sm" onClick={handleReset}>
          Reset
        </button>
      </div>

      {/* Use case grid */}
      {filtered.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((uc) => (
            <UseCaseCard key={uc.id} useCase={uc} onSelect={handleSelectUseCase} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 opacity-50">
          <p>No use cases match your filters.</p>
        </div>
      )}

      {/* Detail modal */}
      {selectedUseCase && (
        <div className="modal modal-open" data-testid="usecase-detail-modal">
          <div className="modal-box max-w-2xl">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              onClick={handleCloseModal}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold">{selectedUseCase.title}</h3>
                <p className="text-sm opacity-70 mt-1">{selectedUseCase.description}</p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <span className="badge badge-outline">{selectedUseCase.category}</span>
                <span className={`badge ${DIFFICULTY_COLORS[selectedUseCase.difficulty]}`}>
                  {selectedUseCase.difficulty}
                </span>
                {selectedUseCase.tags.map((tag) => (
                  <span key={tag} className="badge badge-ghost">{tag}</span>
                ))}
              </div>

              {/* Upstream content */}
              {detailLoading && (
                <div className="flex justify-center py-6" data-testid="detail-loading">
                  <span className="loading loading-spinner loading-md text-primary" />
                </div>
              )}
              {detailMarkdown && !detailLoading && (
                <div data-testid="detail-content">
                  <p className="text-xs font-semibold opacity-60 mb-1">Workflow Details</p>
                  <pre className="whitespace-pre-wrap text-xs bg-base-200 p-4 rounded-lg overflow-auto max-h-96">
                    {detailMarkdown}
                  </pre>
                </div>
              )}

              <div className="modal-action">
                {selectedUseCase.sourceFile && (
                  <a
                    href={GITHUB_USECASES_URL + selectedUseCase.sourceFile}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm btn-ghost gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    View on GitHub
                  </a>
                )}
                <button
                  className="btn btn-sm btn-primary gap-1"
                  onClick={handleStartInChat}
                  data-testid="start-in-chat"
                >
                  <Play className="w-3.5 h-3.5" />
                  Start in Chat
                </button>
                <button className="btn btn-sm" onClick={handleCloseModal}>
                  Close
                </button>
              </div>
            </div>
          </div>
          <div className="modal-backdrop" onClick={handleCloseModal} />
        </div>
      )}
    </div>
  );
}
