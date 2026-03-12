// ---------------------------------------------------------------------------
// SafeClaw — Model selector for the chat input area
// ---------------------------------------------------------------------------

import { useOrchestratorStore } from '../../stores/orchestrator-store.js';
import { PROVIDERS } from '../../providers/models.js';
import type { ProviderId } from '../../providers/types.js';

export function ModelSelector() {
  const providerId = useOrchestratorStore((s) => s.providerId);
  const model = useOrchestratorStore((s) => s.model);
  const orchState = useOrchestratorStore((s) => s.state);
  const setProviderId = useOrchestratorStore((s) => s.setProviderId);
  const setModel = useOrchestratorStore((s) => s.setModel);

  const currentValue = `${providerId}:${model}`;

  function handleChange(combinedValue: string) {
    const [newProviderId, ...modelParts] = combinedValue.split(':');
    const newModel = modelParts.join(':');

    if (newProviderId !== providerId) {
      setProviderId(newProviderId as ProviderId);
    }
    setModel(newModel);
  }

  return (
    <select
      className="select select-ghost select-xs text-xs opacity-70 hover:opacity-100 focus:opacity-100 min-h-0 h-6 pl-1 pr-6"
      value={currentValue}
      onChange={(e) => handleChange(e.target.value)}
      disabled={orchState !== 'idle'}
      aria-label="Select AI model"
    >
      {PROVIDERS.map((provider) => (
        <optgroup key={provider.id} label={provider.label}>
          {provider.models.map((m) => (
            <option key={m.value} value={`${provider.id}:${m.value}`}>
              {m.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
