import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { FilesPage } from '../../../src/components/files/FilesPage';

// Mock stores and storage
vi.mock('../../../src/stores/file-viewer-store', () => ({
  useFileViewerStore: vi.fn((selector) => {
    const state = { file: null, openFile: vi.fn(), closeFile: vi.fn() };
    return selector ? selector(state) : state;
  }),
}));

const mockListGroupFiles = vi.fn().mockResolvedValue(['file1.txt', 'file2.txt', 'subdir/']);
const mockReadGroupFile = vi.fn().mockResolvedValue('file content here');
const mockDeleteGroupFile = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../src/storage', () => ({
  listGroupFiles: (...args: any[]) => mockListGroupFiles(...args),
  readGroupFile: (...args: any[]) => mockReadGroupFile(...args),
  deleteGroupFile: (...args: any[]) => mockDeleteGroupFile(...args),
}));

vi.mock('../../../src/components/files/FileViewerModal', () => ({
  FileViewerModal: ({ name, onClose }: { name: string; content: string; onClose: () => void }) => (
    <div data-testid="file-viewer-modal">
      <span>{name}</span>
      <button onClick={onClose}>Close Viewer</button>
    </div>
  ),
}));

describe('FilesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListGroupFiles.mockResolvedValue(['file1.txt', 'file2.txt', 'subdir/']);
    mockReadGroupFile.mockResolvedValue('file content here');
    mockDeleteGroupFile.mockResolvedValue(undefined);
  });

  it('renders the files page', async () => {
    const { container } = render(<FilesPage />);
    await waitFor(() => {
      expect(container).toBeTruthy();
    });
  });

  it('shows loading spinner initially', () => {
    const { container } = render(<FilesPage />);
    expect(container.querySelector('.loading-spinner')).toBeTruthy();
  });

  it('shows breadcrumb with workspace root', async () => {
    render(<FilesPage />);
    await waitFor(() => {
      expect(screen.getByText('workspace')).toBeInTheDocument();
    });
  });

  // ---- File listing ----

  it('displays file entries after loading', async () => {
    render(<FilesPage />);
    await waitFor(() => {
      expect(screen.getByText('file1.txt')).toBeInTheDocument();
      expect(screen.getByText('file2.txt')).toBeInTheDocument();
      expect(screen.getByText('subdir')).toBeInTheDocument();
    });
  });

  it('shows directory entries with trailing slash indicator', async () => {
    render(<FilesPage />);
    await waitFor(() => {
      expect(screen.getByText('subdir')).toBeInTheDocument();
      expect(screen.getByText('/')).toBeInTheDocument();
    });
  });

  // ---- Empty state ----

  it('shows empty state when no files', async () => {
    mockListGroupFiles.mockResolvedValue([]);
    render(<FilesPage />);
    await waitFor(() => {
      expect(screen.getByText('No files yet')).toBeInTheDocument();
    });
  });

  // ---- Error state ----

  it('shows error alert when loading fails', async () => {
    mockListGroupFiles.mockRejectedValue(new Error('Network error'));
    render(<FilesPage />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Failed to load files')).toBeInTheDocument();
    });
  });

  it('shows empty entries for NotFoundError', async () => {
    const err = new Error('not found');
    err.name = 'NotFoundError';
    mockListGroupFiles.mockRejectedValue(err);
    render(<FilesPage />);
    await waitFor(() => {
      expect(screen.getByText('No files yet')).toBeInTheDocument();
    });
  });

  // ---- Directory navigation ----

  it('navigates into a directory when clicked', async () => {
    mockListGroupFiles
      .mockResolvedValueOnce(['file1.txt', 'subdir/'])
      .mockResolvedValueOnce(['nested.txt']);

    render(<FilesPage />);
    await waitFor(() => {
      expect(screen.getByText('subdir')).toBeInTheDocument();
    });

    const dirRow = screen.getByText('subdir').closest('tr')!;
    await act(async () => {
      fireEvent.click(dirRow);
    });

    await waitFor(() => {
      expect(screen.getByText('nested.txt')).toBeInTheDocument();
    });
  });

  it('updates breadcrumbs when navigating into directory', async () => {
    mockListGroupFiles
      .mockResolvedValueOnce(['subdir/'])
      .mockResolvedValueOnce(['inner.txt']);

    render(<FilesPage />);
    await waitFor(() => {
      expect(screen.getByText('subdir')).toBeInTheDocument();
    });

    const dirRow = screen.getByText('subdir').closest('tr')!;
    await act(async () => {
      fireEvent.click(dirRow);
    });

    await waitFor(() => {
      // Breadcrumbs should show workspace > subdir
      const buttons = screen.getAllByRole('button');
      const breadcrumbTexts = buttons.map(b => b.textContent);
      expect(breadcrumbTexts).toContain('subdir');
    });
  });

  it('navigates back to root when workspace breadcrumb is clicked', async () => {
    mockListGroupFiles
      .mockResolvedValueOnce(['subdir/'])
      .mockResolvedValueOnce(['inner.txt'])
      .mockResolvedValueOnce(['subdir/']);

    render(<FilesPage />);
    await waitFor(() => {
      expect(screen.getByText('subdir')).toBeInTheDocument();
    });

    // Navigate into subdir
    const dirRow = screen.getByText('subdir').closest('tr')!;
    await act(async () => {
      fireEvent.click(dirRow);
    });

    await waitFor(() => {
      expect(screen.getByText('inner.txt')).toBeInTheDocument();
    });

    // Click workspace breadcrumb to go back to root
    const workspaceBtn = screen.getByText((content, element) => {
      return element?.tagName === 'BUTTON' && content.includes('workspace');
    });
    await act(async () => {
      fireEvent.click(workspaceBtn);
    });

    await waitFor(() => {
      expect(screen.getByText('subdir')).toBeInTheDocument();
    });
  });

  // ---- File preview ----

  it('shows preview when a file is clicked', async () => {
    render(<FilesPage />);
    await waitFor(() => {
      expect(screen.getByText('file1.txt')).toBeInTheDocument();
    });

    const fileRow = screen.getByText('file1.txt').closest('tr')!;
    await act(async () => {
      fireEvent.click(fileRow);
    });

    await waitFor(() => {
      expect(mockReadGroupFile).toHaveBeenCalledWith('br:main', 'file1.txt');
      // Content appears in both desktop and mobile panes
      expect(screen.getAllByText('file content here').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows "[Unable to read file]" when preview fails', async () => {
    mockReadGroupFile.mockRejectedValue(new Error('read failed'));

    render(<FilesPage />);
    await waitFor(() => {
      expect(screen.getByText('file1.txt')).toBeInTheDocument();
    });

    const fileRow = screen.getByText('file1.txt').closest('tr')!;
    await act(async () => {
      fireEvent.click(fileRow);
    });

    await waitFor(() => {
      expect(screen.getAllByText('[Unable to read file]').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders HTML files in an iframe', async () => {
    mockListGroupFiles.mockResolvedValue(['page.html']);
    mockReadGroupFile.mockResolvedValue('<h1>Hello</h1>');

    const { container } = render(<FilesPage />);
    await waitFor(() => {
      expect(screen.getByText('page.html')).toBeInTheDocument();
    });

    const fileRow = screen.getByText('page.html').closest('tr')!;
    await act(async () => {
      fireEvent.click(fileRow);
    });

    await waitFor(() => {
      const iframe = container.querySelector('iframe');
      expect(iframe).toBeTruthy();
      expect(iframe!.getAttribute('title')).toBe('File preview');
    });
  });

  // ---- Delete confirmation ----

  it('shows delete confirmation dialog', async () => {
    render(<FilesPage />);
    await waitFor(() => {
      expect(screen.getByText('file1.txt')).toBeInTheDocument();
    });

    // Click file to preview
    const fileRow = screen.getByText('file1.txt').closest('tr')!;
    await act(async () => {
      fireEvent.click(fileRow);
    });

    await waitFor(() => {
      expect(screen.getAllByText('file content here').length).toBeGreaterThanOrEqual(1);
    });

    // Click delete button (the one with title="Delete")
    const deleteBtn = screen.getAllByTitle('Delete')[0];
    await act(async () => {
      fireEvent.click(deleteBtn);
    });

    await waitFor(() => {
      expect(screen.getByText('Delete file?')).toBeInTheDocument();
      expect(screen.getByText(/cannot be undone/)).toBeInTheDocument();
    });
  });

  it('cancels delete when Cancel is clicked', async () => {
    render(<FilesPage />);
    await waitFor(() => {
      expect(screen.getByText('file1.txt')).toBeInTheDocument();
    });

    const fileRow = screen.getByText('file1.txt').closest('tr')!;
    await act(async () => {
      fireEvent.click(fileRow);
    });
    await waitFor(() => {
      expect(screen.getAllByText('file content here').length).toBeGreaterThanOrEqual(1);
    });

    const deleteBtn = screen.getAllByTitle('Delete')[0];
    await act(async () => {
      fireEvent.click(deleteBtn);
    });
    await waitFor(() => {
      expect(screen.getByText('Delete file?')).toBeInTheDocument();
    });

    const cancelBtn = screen.getByText('Cancel');
    await act(async () => {
      fireEvent.click(cancelBtn);
    });

    await waitFor(() => {
      expect(screen.queryByText('Delete file?')).toBeNull();
    });
  });

  it('deletes file when confirmed', async () => {
    render(<FilesPage />);
    await waitFor(() => {
      expect(screen.getByText('file1.txt')).toBeInTheDocument();
    });

    const fileRow = screen.getByText('file1.txt').closest('tr')!;
    await act(async () => {
      fireEvent.click(fileRow);
    });
    await waitFor(() => {
      expect(screen.getAllByText('file content here').length).toBeGreaterThanOrEqual(1);
    });

    const deleteBtn = screen.getAllByTitle('Delete')[0];
    await act(async () => {
      fireEvent.click(deleteBtn);
    });
    await waitFor(() => {
      expect(screen.getByText('Delete file?')).toBeInTheDocument();
    });

    // Click the Delete confirm button in the dialog (inside modal-action)
    const dialog = document.querySelector('dialog')!;
    const confirmDeleteBtn = dialog.querySelector('.btn-error')!;
    await act(async () => {
      fireEvent.click(confirmDeleteBtn);
    });

    await waitFor(() => {
      expect(mockDeleteGroupFile).toHaveBeenCalledWith('br:main', 'file1.txt');
    });
  });

  it('shows error when delete fails', async () => {
    mockDeleteGroupFile.mockRejectedValue(new Error('delete failed'));

    render(<FilesPage />);
    await waitFor(() => {
      expect(screen.getByText('file1.txt')).toBeInTheDocument();
    });

    const fileRow = screen.getByText('file1.txt').closest('tr')!;
    await act(async () => {
      fireEvent.click(fileRow);
    });
    await waitFor(() => {
      expect(screen.getAllByText('file content here').length).toBeGreaterThanOrEqual(1);
    });

    const deleteBtn = screen.getAllByTitle('Delete')[0];
    await act(async () => {
      fireEvent.click(deleteBtn);
    });
    await waitFor(() => {
      expect(screen.getByText('Delete file?')).toBeInTheDocument();
    });

    const dialog = document.querySelector('dialog')!;
    const confirmDeleteBtn = dialog.querySelector('.btn-error')!;
    await act(async () => {
      fireEvent.click(confirmDeleteBtn);
    });

    await waitFor(() => {
      expect(screen.getByText('Failed to delete file')).toBeInTheDocument();
    });
  });

  // ---- File viewer modal ----

  it('opens file viewer modal when open button is clicked', async () => {
    render(<FilesPage />);
    await waitFor(() => {
      expect(screen.getByText('file1.txt')).toBeInTheDocument();
    });

    const fileRow = screen.getByText('file1.txt').closest('tr')!;
    await act(async () => {
      fireEvent.click(fileRow);
    });
    await waitFor(() => {
      expect(screen.getAllByText('file content here').length).toBeGreaterThanOrEqual(1);
    });

    // Click the "Open in viewer" button
    const openBtn = screen.getAllByTitle('Open in viewer')[0];
    await act(async () => {
      fireEvent.click(openBtn);
    });

    await waitFor(() => {
      expect(screen.getByTestId('file-viewer-modal')).toBeInTheDocument();
    });
  });

  it('closes file viewer modal', async () => {
    render(<FilesPage />);
    await waitFor(() => {
      expect(screen.getByText('file1.txt')).toBeInTheDocument();
    });

    const fileRow = screen.getByText('file1.txt').closest('tr')!;
    await act(async () => {
      fireEvent.click(fileRow);
    });
    await waitFor(() => {
      expect(screen.getAllByText('file content here').length).toBeGreaterThanOrEqual(1);
    });

    const openBtn = screen.getAllByTitle('Open in viewer')[0];
    await act(async () => {
      fireEvent.click(openBtn);
    });

    await waitFor(() => {
      expect(screen.getByTestId('file-viewer-modal')).toBeInTheDocument();
    });

    // Close the viewer
    await act(async () => {
      fireEvent.click(screen.getByText('Close Viewer'));
    });

    await waitFor(() => {
      expect(screen.queryByTestId('file-viewer-modal')).toBeNull();
    });
  });

  // ---- File preview in subdirectory ----

  it('reads file with correct path when in subdirectory', async () => {
    mockListGroupFiles
      .mockResolvedValueOnce(['subdir/'])
      .mockResolvedValueOnce(['nested.txt']);

    render(<FilesPage />);
    await waitFor(() => {
      expect(screen.getByText('subdir')).toBeInTheDocument();
    });

    // Navigate into subdir
    const dirRow = screen.getByText('subdir').closest('tr')!;
    await act(async () => {
      fireEvent.click(dirRow);
    });

    await waitFor(() => {
      expect(screen.getByText('nested.txt')).toBeInTheDocument();
    });

    // Click file to preview
    const fileRow = screen.getByText('nested.txt').closest('tr')!;
    await act(async () => {
      fireEvent.click(fileRow);
    });

    await waitFor(() => {
      expect(mockReadGroupFile).toHaveBeenCalledWith('br:main', 'subdir/nested.txt');
    });
  });

  // ---- Download ----

  it('triggers download when download button is clicked', async () => {
    const mockCreateObjectURL = vi.fn(() => 'blob:url');
    const mockRevokeObjectURL = vi.fn();
    (globalThis as any).URL.createObjectURL = mockCreateObjectURL;
    (globalThis as any).URL.revokeObjectURL = mockRevokeObjectURL;

    const mockClick = vi.fn();
    const mockCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = mockCreateElement(tag);
      if (tag === 'a') {
        el.click = mockClick;
      }
      return el;
    });

    render(<FilesPage />);
    await waitFor(() => {
      expect(screen.getByText('file1.txt')).toBeInTheDocument();
    });

    const fileRow = screen.getByText('file1.txt').closest('tr')!;
    await act(async () => {
      fireEvent.click(fileRow);
    });
    await waitFor(() => {
      expect(screen.getAllByText('file content here').length).toBeGreaterThanOrEqual(1);
    });

    const downloadBtn = screen.getAllByTitle('Download')[0];
    await act(async () => {
      fireEvent.click(downloadBtn);
    });

    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalled();

    vi.restoreAllMocks();
  });
});
