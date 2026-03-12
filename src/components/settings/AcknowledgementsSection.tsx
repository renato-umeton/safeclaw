// ---------------------------------------------------------------------------
// SafeClaw — Acknowledgements section for settings
// ---------------------------------------------------------------------------

import { Heart } from 'lucide-react';

export function AcknowledgementsSection() {
  return (
    <div className="card card-bordered bg-base-200">
      <div className="card-body p-4 sm:p-6 gap-3">
        <h3 className="card-title text-base gap-2">
          <Heart className="w-4 h-4" /> Acknowledgements
        </h3>
        <p className="text-sm opacity-70 leading-relaxed">
          This project stands on the shoulders of giants:{' '}
          <a href="https://github.com/openclaw" className="link link-primary" target="_blank" rel="noopener noreferrer">OpenClaw</a>{' '}
          for the original open-source personal AI assistant,{' '}
          <a href="https://github.com/sachaa/openbrowserclaw" className="link link-primary" target="_blank" rel="noopener noreferrer">OpenBrowserClaw</a>{' '}
          by sachaa for the initial intuition and browser-native container architecture,{' '}
          <a href="https://github.com/hesamsheikh/awesome-openclaw-usecases" className="link link-primary" target="_blank" rel="noopener noreferrer">awesome-openclaw-usecases</a>{' '}
          by hesamsheikh for the curated community workflows,{' '}
          <a href="https://clawhub.ai" className="link link-primary" target="_blank" rel="noopener noreferrer">ClawHub</a>{' '}
          for the skill marketplace,{' '}
          <a href="https://webllm.mlc.ai/" className="link link-primary" target="_blank" rel="noopener noreferrer">WebLLM</a>{' '}
          for local in-browser model inference,{' '}
          <a href="https://www.chromium.org/" className="link link-primary" target="_blank" rel="noopener noreferrer">Chromium</a>{' '}
          and its built-in AI APIs, and the{' '}
          <a href="https://web.dev/progressive-web-apps/" className="link link-primary" target="_blank" rel="noopener noreferrer">PWA</a>{' '}
          standards that make installable browser apps possible.
        </p>
      </div>
    </div>
  );
}
