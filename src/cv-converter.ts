// ---------------------------------------------------------------------------
// SafeClaw — CV file format converter (PDF/DOCX → plain text)
// ---------------------------------------------------------------------------

import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import { extractRawText } from 'mammoth';

// Use bundled worker for pdf.js
GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export const SUPPORTED_CV_EXTENSIONS = ['.txt', '.md', '.pdf', '.docx'] as const;

const TEXT_EXTENSIONS = new Set(['.txt', '.md']);

/**
 * Check if a filename has a supported CV format extension.
 */
export function isSupportedCvFormat(filename: string): boolean {
  if (!filename) return false;
  const ext = getExtension(filename);
  return SUPPORTED_CV_EXTENSIONS.includes(ext as typeof SUPPORTED_CV_EXTENSIONS[number]);
}

/**
 * Convert a CV file (PDF, DOCX, TXT, MD) to plain text.
 * Throws if the format is unsupported.
 */
export async function convertCvToText(file: File): Promise<string> {
  const ext = getExtension(file.name);

  if (TEXT_EXTENSIONS.has(ext)) {
    const text = await file.text();
    return text.trim();
  }

  if (ext === '.pdf') {
    return extractPdfText(file);
  }

  if (ext === '.docx') {
    return extractDocxText(file);
  }

  if (ext === '.doc') {
    throw new Error(
      'Unsupported format: .doc (legacy Word). Please save as .docx and try again.',
    );
  }

  throw new Error(`Unsupported CV file format: ${ext}`);
}

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot === -1) return '';
  return filename.slice(dot).toLowerCase();
}

async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ('str' in item ? (item as { str: string }).str : ''))
      .join('');
    pages.push(pageText);
  }

  return pages.join('\n').trim();
}

async function extractDocxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await extractRawText({ arrayBuffer });
  return result.value.trim();
}
