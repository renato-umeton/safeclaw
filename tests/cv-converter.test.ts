// ---------------------------------------------------------------------------
// SafeClaw — CV converter tests (TDD)
// ---------------------------------------------------------------------------

import { convertCvToText, isSupportedCvFormat, SUPPORTED_CV_EXTENSIONS } from '../src/cv-converter';

// Mock pdfjs-dist
vi.mock('pdfjs-dist', () => {
  const mockGetPage = vi.fn();
  const mockGetDocument = vi.fn();

  return {
    getDocument: mockGetDocument,
    GlobalWorkerOptions: { workerSrc: '' },
    __mockGetDocument: mockGetDocument,
    __mockGetPage: mockGetPage,
  };
});

// Mock mammoth
vi.mock('mammoth', () => {
  const mockExtractRawText = vi.fn();
  return {
    extractRawText: mockExtractRawText,
    __mockExtractRawText: mockExtractRawText,
  };
});

// Helper to get mock references
async function getPdfMock() {
  const mod = await import('pdfjs-dist') as any;
  return mod.__mockGetDocument as ReturnType<typeof vi.fn>;
}

async function getMammothMock() {
  const mod = await import('mammoth') as any;
  return mod.__mockExtractRawText as ReturnType<typeof vi.fn>;
}

describe('cv-converter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SUPPORTED_CV_EXTENSIONS', () => {
    it('includes txt, md, pdf, and docx', () => {
      expect(SUPPORTED_CV_EXTENSIONS).toContain('.txt');
      expect(SUPPORTED_CV_EXTENSIONS).toContain('.md');
      expect(SUPPORTED_CV_EXTENSIONS).toContain('.pdf');
      expect(SUPPORTED_CV_EXTENSIONS).toContain('.docx');
    });
  });

  describe('isSupportedCvFormat', () => {
    it('returns true for .txt files', () => {
      expect(isSupportedCvFormat('resume.txt')).toBe(true);
    });

    it('returns true for .md files', () => {
      expect(isSupportedCvFormat('resume.md')).toBe(true);
    });

    it('returns true for .pdf files', () => {
      expect(isSupportedCvFormat('resume.pdf')).toBe(true);
    });

    it('returns true for .docx files', () => {
      expect(isSupportedCvFormat('resume.docx')).toBe(true);
    });

    it('returns false for .doc files (unsupported legacy format)', () => {
      expect(isSupportedCvFormat('resume.doc')).toBe(false);
    });

    it('returns false for unsupported formats', () => {
      expect(isSupportedCvFormat('image.png')).toBe(false);
      expect(isSupportedCvFormat('data.csv')).toBe(false);
      expect(isSupportedCvFormat('archive.zip')).toBe(false);
    });

    it('is case-insensitive', () => {
      expect(isSupportedCvFormat('Resume.PDF')).toBe(true);
      expect(isSupportedCvFormat('CV.DOCX')).toBe(true);
      expect(isSupportedCvFormat('notes.TXT')).toBe(true);
    });

    it('returns false for empty string', () => {
      expect(isSupportedCvFormat('')).toBe(false);
    });
  });

  describe('convertCvToText', () => {
    it('reads .txt files as plain text', async () => {
      const content = 'Senior developer with 10 years experience';
      const file = new File([content], 'resume.txt', { type: 'text/plain' });

      const result = await convertCvToText(file);
      expect(result).toBe(content);
    });

    it('reads .md files as plain text', async () => {
      const content = '# Resume\n\n- Python\n- JavaScript';
      const file = new File([content], 'resume.md', { type: 'text/markdown' });

      const result = await convertCvToText(file);
      expect(result).toBe(content);
    });

    it('extracts text from .pdf files using pdfjs-dist', async () => {
      const mockGetDocument = await getPdfMock();

      const mockTextContent = {
        items: [
          { str: 'John Doe' },
          { str: ' ' },
          { str: 'Software Engineer' },
        ],
      };

      const mockPage = {
        getTextContent: vi.fn().mockResolvedValue(mockTextContent),
      };

      mockGetDocument.mockReturnValue({
        promise: Promise.resolve({
          numPages: 1,
          getPage: vi.fn().mockResolvedValue(mockPage),
        }),
      });

      const file = new File([new ArrayBuffer(100)], 'resume.pdf', { type: 'application/pdf' });
      const result = await convertCvToText(file);

      expect(result).toContain('John Doe');
      expect(result).toContain('Software Engineer');
      expect(mockGetDocument).toHaveBeenCalled();
    });

    it('extracts text from multi-page PDFs', async () => {
      const mockGetDocument = await getPdfMock();

      const mockPage1 = {
        getTextContent: vi.fn().mockResolvedValue({
          items: [{ str: 'Page 1 content' }],
        }),
      };
      const mockPage2 = {
        getTextContent: vi.fn().mockResolvedValue({
          items: [{ str: 'Page 2 content' }],
        }),
      };

      const mockGetPage = vi.fn()
        .mockImplementation((pageNum: number) =>
          Promise.resolve(pageNum === 1 ? mockPage1 : mockPage2)
        );

      mockGetDocument.mockReturnValue({
        promise: Promise.resolve({
          numPages: 2,
          getPage: mockGetPage,
        }),
      });

      const file = new File([new ArrayBuffer(100)], 'resume.pdf', { type: 'application/pdf' });
      const result = await convertCvToText(file);

      expect(result).toContain('Page 1 content');
      expect(result).toContain('Page 2 content');
      expect(mockGetPage).toHaveBeenCalledWith(1);
      expect(mockGetPage).toHaveBeenCalledWith(2);
    });

    it('extracts text from .docx files using mammoth', async () => {
      const mockExtractRawText = await getMammothMock();
      mockExtractRawText.mockResolvedValue({
        value: 'Jane Smith\nProject Manager\nExperienced in agile methodologies',
      });

      const file = new File([new ArrayBuffer(100)], 'resume.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const result = await convertCvToText(file);

      expect(result).toContain('Jane Smith');
      expect(result).toContain('Project Manager');
      expect(mockExtractRawText).toHaveBeenCalled();
    });

    it('throws for unsupported file formats', async () => {
      const file = new File(['data'], 'image.png', { type: 'image/png' });
      await expect(convertCvToText(file)).rejects.toThrow(/unsupported/i);
    });

    it('throws for .doc files with helpful message', async () => {
      const file = new File([new ArrayBuffer(50)], 'old_resume.doc', {
        type: 'application/msword',
      });
      await expect(convertCvToText(file)).rejects.toThrow(/docx/i);
    });

    it('trims whitespace from extracted text', async () => {
      const content = '  Resume with whitespace  \n\n';
      const file = new File([content], 'resume.txt', { type: 'text/plain' });

      const result = await convertCvToText(file);
      expect(result).toBe('Resume with whitespace');
    });

    it('handles empty files gracefully', async () => {
      const file = new File([''], 'empty.txt', { type: 'text/plain' });
      const result = await convertCvToText(file);
      expect(result).toBe('');
    });

    it('handles PDF extraction errors', async () => {
      const mockGetDocument = await getPdfMock();
      mockGetDocument.mockReturnValue({
        promise: Promise.reject(new Error('Invalid PDF')),
      });

      const file = new File([new ArrayBuffer(10)], 'corrupt.pdf', { type: 'application/pdf' });
      await expect(convertCvToText(file)).rejects.toThrow();
    });

    it('handles DOCX extraction errors', async () => {
      const mockExtractRawText = await getMammothMock();
      mockExtractRawText.mockRejectedValue(new Error('Invalid DOCX'));

      const file = new File([new ArrayBuffer(10)], 'corrupt.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      await expect(convertCvToText(file)).rejects.toThrow();
    });
  });
});
