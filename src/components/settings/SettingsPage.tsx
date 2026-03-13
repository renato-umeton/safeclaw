// ---------------------------------------------------------------------------
// SafeClaw — Settings page (unified AI provider card with semantic grouping)
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import {
  Palette, KeyRound, Eye, EyeOff, Bot, MessageSquare,
  Smartphone, HardDrive, Lock, Check, Cpu, Wifi, WifiOff, Download, Trash2,
} from 'lucide-react';
import { getConfig } from '../../db.js';
import { CONFIG_KEYS } from '../../config.js';
import {
  getStorageEstimate,
  requestPersistentStorage,
  getModelCacheEstimate,
  deleteModelCaches,
} from '../../storage.js';
import { decryptValue } from '../../crypto.js';
import { getOrchestrator, useOrchestratorStore } from '../../stores/orchestrator-store.js';
import { useThemeStore, type ThemeChoice } from '../../stores/theme-store.js';
import type { ProviderId, LocalPreference } from '../../providers/types.js';
import { ProfileSection } from './ProfileSection.js';
import { VersionSection } from './VersionSection.js';
import { AcknowledgementsSection } from './AcknowledgementsSection.js';

// ---------------------------------------------------------------------------
// Provider / model definitions
// ---------------------------------------------------------------------------

type ProviderInfo = {
  id: ProviderId;
  label: string;
  isLocal: boolean;
  models: { value: string; label: string }[];
};

const PROVIDERS: ProviderInfo[] = [
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    isLocal: false,
    models: [
      { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
      { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
      { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
    ],
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    isLocal: false,
    models: [
      { value: 'gemini-2.5-pro-preview-06-05', label: 'Gemini 2.5 Pro' },
      { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
      { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
    ],
  },
  {
    id: 'webllm',
    label: 'WebLLM (Local)',
    isLocal: true,
    models: [
      { value: 'qwen3-0.6b', label: 'Qwen3 0.6B (400 MB)' },
      { value: 'qwen3-1.7b', label: 'Qwen3 1.7B (1 GB)' },
      { value: 'qwen3-4b', label: 'Qwen3 4B (2.5 GB)' },
      { value: 'qwen3-30b', label: 'Qwen3 30B-A3B (16 GB)' },
    ],
  },
  {
    id: 'chrome-ai',
    label: 'Chrome AI (Gemini Nano)',
    isLocal: true,
    models: [
      { value: 'gemini-nano', label: 'Gemini Nano (built-in)' },
    ],
  },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}

export function SettingsPage() {
  const orch = getOrchestrator();

  // Provider
  const [providerId, setProviderId] = useState<ProviderId>(orch.getProviderId());

  // API Keys
  const [anthropicKey, setAnthropicKey] = useState('');
  const [anthropicKeyMasked, setAnthropicKeyMasked] = useState(true);
  const [anthropicKeySaved, setAnthropicKeySaved] = useState(false);
  const [geminiKey, setGeminiKey] = useState('');
  const [geminiKeyMasked, setGeminiKeyMasked] = useState(true);
  const [geminiKeySaved, setGeminiKeySaved] = useState(false);

  // Model
  const [model, setModel] = useState(orch.getModel());

  // Local preference
  const [localPref, setLocalPref] = useState<LocalPreference>(orch.getLocalPreference());

  // Hardware info
  const [hasWebGPU, setHasWebGPU] = useState(false);
  const [deviceMemory, setDeviceMemory] = useState<number | null>(null);
  const [hasChromeAI, setHasChromeAI] = useState(false);

  // Assistant name
  const [assistantName, setAssistantName] = useState(orch.getAssistantName());

  // Telegram
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatIds, setTelegramChatIds] = useState('');
  const [telegramSaved, setTelegramSaved] = useState(false);

  // Storage
  const [storageUsage, setStorageUsage] = useState(0);
  const [storageQuota, setStorageQuota] = useState(0);
  const [isPersistent, setIsPersistent] = useState(false);
  const [modelCacheSize, setModelCacheSize] = useState(0);
  const [deletingCache, setDeletingCache] = useState(false);

  // Theme
  const { theme, setTheme } = useThemeStore();

  // WebLLM download progress
  const webllmProgress = useOrchestratorStore((s) => s.webllmProgress);

  // Load current values
  useEffect(() => {
    async function load() {
      // Anthropic API key
      const encAnthropicKey = await getConfig(CONFIG_KEYS.ANTHROPIC_API_KEY);
      if (encAnthropicKey) {
        try { setAnthropicKey(await decryptValue(encAnthropicKey)); } catch { /* empty */ }
      }

      // Gemini API key
      const encGeminiKey = await getConfig(CONFIG_KEYS.GEMINI_API_KEY);
      if (encGeminiKey) {
        try { setGeminiKey(await decryptValue(encGeminiKey)); } catch { /* empty */ }
      }

      // Telegram
      const token = await getConfig(CONFIG_KEYS.TELEGRAM_BOT_TOKEN);
      if (token) setTelegramToken(token);
      const chatIds = await getConfig(CONFIG_KEYS.TELEGRAM_CHAT_IDS);
      if (chatIds) {
        try { setTelegramChatIds(JSON.parse(chatIds).join(', ')); } catch { setTelegramChatIds(chatIds); }
      }

      // Storage
      const est = await getStorageEstimate();
      setStorageUsage(est.usage);
      setStorageQuota(est.quota);
      if (navigator.storage?.persisted) {
        setIsPersistent(await navigator.storage.persisted());
      }

      // Model cache size
      const cacheSize = await getModelCacheEstimate();
      setModelCacheSize(cacheSize);

      // Hardware checks
      setHasWebGPU('gpu' in navigator);
      setDeviceMemory((navigator as any).deviceMemory ?? null);

      // Chrome AI check
      try {
        const ai = (window as any).ai;
        if (ai?.languageModel) {
          const caps = await ai.languageModel.capabilities();
          setHasChromeAI(caps.available === 'readily');
        }
      } catch { /* empty */ }
    }
    load();
  }, []);

  // Derived: models for current provider
  const currentProvider = PROVIDERS.find((p) => p.id === providerId)!;
  const availableModels = currentProvider?.models || [];

  // Handlers
  async function handleProviderChange(id: ProviderId) {
    setProviderId(id);
    await orch.setProviderId(id);
    // Orchestrator restores the last-used model for this provider.
    // Sync UI state with whatever the orchestrator chose.
    setModel(orch.getModel());
  }

  async function handleSaveAnthropicKey() {
    await orch.setApiKey('anthropic', anthropicKey.trim());
    setAnthropicKeySaved(true);
    setTimeout(() => setAnthropicKeySaved(false), 2000);
  }

  async function handleSaveGeminiKey() {
    await orch.setApiKey('gemini', geminiKey.trim());
    setGeminiKeySaved(true);
    setTimeout(() => setGeminiKeySaved(false), 2000);
  }

  async function handleModelChange(value: string) {
    setModel(value);
    await orch.setModel(value);
  }

  async function handleLocalPrefChange(value: LocalPreference) {
    setLocalPref(value);
    await orch.setLocalPreference(value);
  }

  async function handleNameSave() {
    await orch.setAssistantName(assistantName.trim());
  }

  async function handleTelegramSave() {
    const ids = telegramChatIds
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    await orch.configureTelegram(telegramToken.trim(), ids);
    setTelegramSaved(true);
    setTimeout(() => setTelegramSaved(false), 2000);
  }

  async function handleRequestPersistent() {
    const granted = await requestPersistentStorage();
    setIsPersistent(granted);
  }

  async function handleDeleteModelCache() {
    setDeletingCache(true);
    await deleteModelCaches();
    setModelCacheSize(0);
    // Refresh total storage estimate
    const est = await getStorageEstimate();
    setStorageUsage(est.usage);
    setStorageQuota(est.quota);
    setDeletingCache(false);
  }

  const storagePercent = storageQuota > 0 ? (storageUsage / storageQuota) * 100 : 0;
  const otherStorage = Math.max(0, storageUsage - modelCacheSize);

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <h2 className="text-xl font-bold mb-4">Settings</h2>

      {/* ================================================================ */}
      {/* AI & Models                                                      */}
      {/* ================================================================ */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider opacity-50 mb-2">AI & Models</h3>
        <div className="space-y-4">

          {/* ---- Unified AI Provider card ---- */}
          <div className="card card-bordered bg-base-200">
            <div className="card-body p-4 sm:p-6 gap-3">
              <h3 className="card-title text-base gap-2"><Bot className="w-4 h-4" /> AI Provider</h3>

              {/* Provider & Model Selection */}
              <fieldset className="fieldset">
                <legend className="fieldset-legend">Active Provider</legend>
                <select
                  className="select select-bordered select-sm w-full"
                  value={providerId}
                  onChange={(e) => handleProviderChange(e.target.value as ProviderId)}
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}{p.isLocal ? ' (Local)' : ''}
                    </option>
                  ))}
                </select>
              </fieldset>

              <fieldset className="fieldset">
                <legend className="fieldset-legend">Model</legend>
                <select
                  className="select select-bordered select-sm w-full"
                  value={model}
                  onChange={(e) => handleModelChange(e.target.value)}
                >
                  {availableModels.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </fieldset>

              <p className="text-xs opacity-50">
                Quality-first routing: cloud models by default, local fallback when offline or rate-limited.
              </p>

              {/* ---- API Keys sub-section ---- */}
              <div className="divider my-1" />
              <h4 className="font-semibold text-sm flex items-center gap-2"><KeyRound className="w-4 h-4" /> API Keys</h4>

              {/* Anthropic */}
              <fieldset className="fieldset">
                <legend className="fieldset-legend">Anthropic API Key</legend>
                <div className="flex gap-2">
                  <input
                    type={anthropicKeyMasked ? 'password' : 'text'}
                    className="input input-bordered input-sm w-full flex-1 font-mono"
                    placeholder="sk-ant-..."
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                  />
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setAnthropicKeyMasked(!anthropicKeyMasked)}
                  >
                    {anthropicKeyMasked ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleSaveAnthropicKey}
                    disabled={!anthropicKey.trim()}
                  >
                    Save
                  </button>
                  {anthropicKeySaved && (
                    <span className="text-success text-sm flex items-center gap-1"><Check className="w-4 h-4" /> Saved</span>
                  )}
                </div>
              </fieldset>

              {/* Gemini */}
              <fieldset className="fieldset">
                <legend className="fieldset-legend">Google Gemini API Key</legend>
                <div className="flex gap-2">
                  <input
                    type={geminiKeyMasked ? 'password' : 'text'}
                    className="input input-bordered input-sm w-full flex-1 font-mono"
                    placeholder="AIza..."
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                  />
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setGeminiKeyMasked(!geminiKeyMasked)}
                  >
                    {geminiKeyMasked ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleSaveGeminiKey}
                    disabled={!geminiKey.trim()}
                  >
                    Save
                  </button>
                  {geminiKeySaved && (
                    <span className="text-success text-sm flex items-center gap-1"><Check className="w-4 h-4" /> Saved</span>
                  )}
                </div>
              </fieldset>

              <p className="text-xs opacity-50">
                API keys are encrypted and stored locally. They never leave your browser except to call the respective APIs.
              </p>

              {/* ---- Local Models sub-section ---- */}
              <div className="divider my-1" />
              <h4 className="font-semibold text-sm flex items-center gap-2"><Cpu className="w-4 h-4" /> Local Models</h4>

              {/* Hardware compatibility */}
              <div className="flex flex-wrap gap-2">
                <div className={`badge badge-sm gap-1.5 ${hasWebGPU ? 'badge-success' : 'badge-error'}`}>
                  {hasWebGPU ? 'WebGPU available' : 'WebGPU not available'}
                </div>
                {deviceMemory !== null && (
                  <div className={`badge badge-sm gap-1.5 ${deviceMemory >= 4 ? 'badge-success' : 'badge-warning'}`}>
                    {deviceMemory} GB device memory
                  </div>
                )}
                <div className={`badge badge-sm gap-1.5 ${hasChromeAI ? 'badge-success' : 'badge-ghost'}`}>
                  {hasChromeAI ? 'Chrome AI ready' : 'Chrome AI not available'}
                </div>
              </div>

              {/* Local preference */}
              <fieldset className="fieldset">
                <legend className="fieldset-legend">Local Model Preference</legend>
                <select
                  className="select select-bordered select-sm w-full"
                  value={localPref}
                  onChange={(e) => handleLocalPrefChange(e.target.value as LocalPreference)}
                >
                  <option value="off">Off — cloud only</option>
                  <option value="offline-only">Offline fallback — use local when no internet</option>
                  <option value="always">Always local — prefer local models</option>
                </select>
              </fieldset>

              {/* Download / preload button for local providers */}
              {currentProvider.isLocal && currentProvider.id === 'webllm' && !webllmProgress && (
                <button
                  className="btn btn-outline btn-sm gap-2"
                  onClick={() => orch.preloadModel()}
                >
                  <Download className="w-4 h-4" /> Download Model
                </button>
              )}

              {/* Download progress bar */}
              {webllmProgress && (
                <div>
                  <div className="flex items-center gap-2 text-sm">
                    <Download className="w-4 h-4 animate-pulse" />
                    <span className="flex-1 truncate">{webllmProgress.status}</span>
                    <span className="text-xs opacity-60">{Math.round(webllmProgress.progress * 100)}%</span>
                  </div>
                  <progress
                    role="progressbar"
                    className="progress progress-primary w-full h-2 mt-1"
                    value={webllmProgress.progress * 100}
                    max={100}
                  />
                </div>
              )}

              <div className="flex items-center gap-2 text-xs opacity-60">
                {navigator.onLine
                  ? <><Wifi className="w-3 h-3" /> Online</>
                  : <><WifiOff className="w-3 h-3" /> Offline — local models will be used</>
                }
              </div>

              {!hasWebGPU && (
                <p className="text-xs text-warning">
                  WebGPU is required for WebLLM local models. Use Chrome 113+ with WebGPU enabled.
                </p>
              )}
              {deviceMemory !== null && deviceMemory < 4 && (
                <p className="text-xs text-warning">
                  Less than 4 GB device memory detected. Local models may not run reliably.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* Personalization                                                   */}
      {/* ================================================================ */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider opacity-50 mb-2">Personalization</h3>
        <div className="space-y-4">

          {/* ---- Theme ---- */}
          <div className="card card-bordered bg-base-200">
            <div className="card-body p-4 sm:p-6 gap-3">
              <h3 className="card-title text-base gap-2"><Palette className="w-4 h-4" /> Appearance</h3>
              <fieldset className="fieldset">
                <legend className="fieldset-legend">Theme</legend>
                <select
                  className="select select-bordered select-sm w-full"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as ThemeChoice)}
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </fieldset>
            </div>
          </div>

          {/* ---- Assistant Name ---- */}
          <div className="card card-bordered bg-base-200">
            <div className="card-body p-4 sm:p-6 gap-3">
              <h3 className="card-title text-base gap-2"><MessageSquare className="w-4 h-4" /> Assistant Name</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input input-bordered input-sm flex-1"
                  placeholder="Andy"
                  value={assistantName}
                  onChange={(e) => setAssistantName(e.target.value)}
                  onBlur={handleNameSave}
                />
              </div>
              <p className="text-xs opacity-50">
                The name used for the assistant. Mention @{assistantName} to trigger a response.
              </p>
            </div>
          </div>

          {/* ---- Profile ---- */}
          <ProfileSection />
        </div>
      </section>

      {/* ================================================================ */}
      {/* Integrations                                                      */}
      {/* ================================================================ */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider opacity-50 mb-2">Integrations</h3>
        <div className="space-y-4">

          {/* ---- Telegram ---- */}
          <div className="card card-bordered bg-base-200">
            <div className="card-body p-4 sm:p-6 gap-3">
              <h3 className="card-title text-base gap-2"><Smartphone className="w-4 h-4" /> Telegram Bot</h3>
              <fieldset className="fieldset">
                <legend className="fieldset-legend">Bot Token</legend>
                <input
                  type="password"
                  className="input input-bordered input-sm w-full font-mono"
                  placeholder="123456:ABC-DEF..."
                  value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value)}
                />
              </fieldset>
              <fieldset className="fieldset">
                <legend className="fieldset-legend">Allowed Chat IDs</legend>
                <input
                  type="text"
                  className="input input-bordered input-sm w-full font-mono"
                  placeholder="-100123456, 789012"
                  value={telegramChatIds}
                  onChange={(e) => setTelegramChatIds(e.target.value)}
                />
                <p className="fieldset-label opacity-60">Comma-separated chat IDs</p>
              </fieldset>
              <div className="flex items-center gap-2">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleTelegramSave}
                  disabled={!telegramToken.trim()}
                >
                  Save Telegram Config
                </button>
                {telegramSaved && (
                  <span className="text-success text-sm flex items-center gap-1"><Check className="w-4 h-4" /> Saved</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* Storage & System                                                  */}
      {/* ================================================================ */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider opacity-50 mb-2">Storage & System</h3>
        <div className="space-y-4">

          {/* ---- Storage ---- */}
          <div className="card card-bordered bg-base-200">
            <div className="card-body p-4 sm:p-6 gap-3">
              <h3 className="card-title text-base gap-2"><HardDrive className="w-4 h-4" /> Storage</h3>

              {/* Overall usage */}
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span>{formatBytes(storageUsage)} used</span>
                  <span className="opacity-60">
                    of {formatBytes(storageQuota)}
                  </span>
                </div>
                <progress
                  className="progress progress-primary w-full h-2"
                  value={storagePercent}
                  max={100}
                />
              </div>

              {/* Storage breakdown */}
              <div className="text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="opacity-70">Model weights</span>
                  <span className="font-mono">{formatBytes(modelCacheSize)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="opacity-70">Other data</span>
                  <span className="font-mono">{formatBytes(otherStorage)}</span>
                </div>
              </div>

              {/* Delete model weights */}
              {modelCacheSize > 0 && (
                <button
                  className="btn btn-outline btn-error btn-sm gap-2"
                  onClick={handleDeleteModelCache}
                  disabled={deletingCache}
                >
                  <Trash2 className="w-4 h-4" />
                  {deletingCache ? 'Deleting...' : 'Delete Model Weights'}
                </button>
              )}
              {modelCacheSize > 0 && (
                <p className="text-xs opacity-50">
                  Models will be re-downloaded automatically on next use.
                </p>
              )}

              {!isPersistent && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={handleRequestPersistent}
                >
                  <Lock className="w-4 h-4" /> Request Persistent Storage
                </button>
              )}
              {isPersistent && (
                <div className="badge badge-success badge-sm gap-1.5">
                  <Lock className="w-3 h-3" /> Persistent storage active
                </div>
              )}
            </div>
          </div>

          {/* ---- Version ---- */}
          <VersionSection />

          {/* ---- Acknowledgements ---- */}
          <AcknowledgementsSection />
        </div>
      </section>
    </div>
  );
}
