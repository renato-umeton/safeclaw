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
          {' '}The following open-source packages are also used here and much appreciated:{' '}
          <a href="https://playwright.dev/" className="link link-primary" target="_blank" rel="noopener noreferrer">Playwright</a>,{' '}
          <a href="https://vitest.dev/" className="link link-primary" target="_blank" rel="noopener noreferrer">Vitest</a>,{' '}
          <a href="https://react.dev/" className="link link-primary" target="_blank" rel="noopener noreferrer">React</a>,{' '}
          <a href="https://reactrouter.com/" className="link link-primary" target="_blank" rel="noopener noreferrer">React Router</a>,{' '}
          <a href="https://github.com/remarkjs/react-markdown" className="link link-primary" target="_blank" rel="noopener noreferrer">React Markdown</a>,{' '}
          <a href="https://vite.dev/" className="link link-primary" target="_blank" rel="noopener noreferrer">Vite</a>,{' '}
          <a href="https://www.typescriptlang.org/" className="link link-primary" target="_blank" rel="noopener noreferrer">TypeScript</a>,{' '}
          <a href="https://tailwindcss.com/" className="link link-primary" target="_blank" rel="noopener noreferrer">TailwindCSS</a>,{' '}
          <a href="https://daisyui.com/" className="link link-primary" target="_blank" rel="noopener noreferrer">DaisyUI</a>,{' '}
          <a href="https://github.com/pmndrs/zustand" className="link link-primary" target="_blank" rel="noopener noreferrer">Zustand</a>,{' '}
          <a href="https://lucide.dev/" className="link link-primary" target="_blank" rel="noopener noreferrer">Lucide</a>,{' '}
          <a href="https://testing-library.com/" className="link link-primary" target="_blank" rel="noopener noreferrer">Testing Library</a>,{' '}
          <a href="https://unifiedjs.com/" className="link link-primary" target="_blank" rel="noopener noreferrer">unified</a>{' '}
          (rehype & remark),{' '}
          <a href="https://github.com/nicedoc/happy-dom" className="link link-primary" target="_blank" rel="noopener noreferrer">happy-dom</a>,{' '}
          <a href="https://github.com/nicedoc/fake-indexeddb" className="link link-primary" target="_blank" rel="noopener noreferrer">fake-indexeddb</a>,{' '}
          <a href="https://mozilla.github.io/pdf.js/" className="link link-primary" target="_blank" rel="noopener noreferrer">PDF.js</a> (pdfjs-dist),{' '}
          and <a href="https://github.com/mwilliamson/mammoth.js" className="link link-primary" target="_blank" rel="noopener noreferrer">Mammoth</a>.
        </p>
      </div>
    </div>
  );
}
