import { render, screen, fireEvent } from '@testing-library/react';
import { FileViewerModal } from '../../../src/components/files/FileViewerModal';

describe('FileViewerModal', () => {
  it('renders when file props are provided', () => {
    const { container } = render(
      <FileViewerModal
        name="test.txt"
        content="hello world"
        onClose={vi.fn()}
      />
    );
    expect(container.textContent).toContain('test.txt');
    expect(container.textContent).toContain('hello world');
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    const { container } = render(
      <FileViewerModal
        name="test.txt"
        content="content"
        onClose={onClose}
      />
    );

    // Find the X (close) button by its btn-square class
    const closeBtn = container.querySelector('.btn-square');
    expect(closeBtn).toBeTruthy();
    fireEvent.click(closeBtn!);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders HTML content for .html files', () => {
    const { container } = render(
      <FileViewerModal
        name="page.html"
        content="<h1>Hello</h1>"
        onClose={vi.fn()}
      />
    );
    expect(container).toBeTruthy();
  });

  it('renders SVG content for .svg files', () => {
    const { container } = render(
      <FileViewerModal
        name="icon.svg"
        content="<svg><circle /></svg>"
        onClose={vi.fn()}
      />
    );
    expect(container).toBeTruthy();
  });

  it('renders non-renderable file without extension as pre text', () => {
    const { container } = render(
      <FileViewerModal
        name="Makefile"
        content="all: build"
        onClose={vi.fn()}
      />
    );
    expect(container.querySelector('pre')).toBeTruthy();
    expect(container.querySelector('iframe')).toBeFalsy();
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(
      <FileViewerModal
        name="test.txt"
        content="content"
        onClose={onClose}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('does not call onClose for non-Escape keys', () => {
    const onClose = vi.fn();
    render(
      <FileViewerModal
        name="test.txt"
        content="content"
        onClose={onClose}
      />
    );

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('handles download button click', () => {
    const mockClick = vi.fn();
    const mockCreateElement = vi.spyOn(document, 'createElement');
    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:test-url');
    const mockRevokeObjectURL = vi.fn();

    // Mock URL methods
    (globalThis as any).URL.createObjectURL = mockCreateObjectURL;
    (globalThis as any).URL.revokeObjectURL = mockRevokeObjectURL;

    const { container } = render(
      <FileViewerModal
        name="report.txt"
        content="file content here"
        onClose={vi.fn()}
      />
    );

    // Find the Download button by text content
    const buttons = container.querySelectorAll('.btn-ghost');
    const downloadBtn = Array.from(buttons).find(
      (btn) => btn.textContent?.includes('Download')
    );
    expect(downloadBtn).toBeTruthy();

    fireEvent.click(downloadBtn!);

    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test-url');
  });

  it('handles Open in Tab button click', () => {
    const mockOpen = vi.fn();
    const originalOpen = window.open;
    window.open = mockOpen;

    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:tab-url');
    (globalThis as any).URL.createObjectURL = mockCreateObjectURL;

    const { container } = render(
      <FileViewerModal
        name="test.txt"
        content="plain text"
        onClose={vi.fn()}
      />
    );

    const buttons = container.querySelectorAll('.btn-ghost');
    const openBtn = Array.from(buttons).find(
      (btn) => btn.textContent?.includes('Open in Tab')
    );
    expect(openBtn).toBeTruthy();

    fireEvent.click(openBtn!);

    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockOpen).toHaveBeenCalledWith('blob:tab-url', '_blank');

    window.open = originalOpen;
  });

  it('handles Open in Tab for HTML files', () => {
    const mockOpen = vi.fn();
    const originalOpen = window.open;
    window.open = mockOpen;

    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:html-url');
    (globalThis as any).URL.createObjectURL = mockCreateObjectURL;

    const { container } = render(
      <FileViewerModal
        name="page.html"
        content="<h1>Hello</h1>"
        onClose={vi.fn()}
      />
    );

    const buttons = container.querySelectorAll('.btn-ghost');
    const openBtn = Array.from(buttons).find(
      (btn) => btn.textContent?.includes('Open in Tab')
    );
    fireEvent.click(openBtn!);

    // Verify createObjectURL was called (with a Blob containing the content)
    expect(mockCreateObjectURL).toHaveBeenCalled();
    const blobArg = mockCreateObjectURL.mock.calls[0][0];
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toBe('text/html');
    expect(mockOpen).toHaveBeenCalledWith('blob:html-url', '_blank');

    window.open = originalOpen;
  });

  it('cleans up keydown listener on unmount', () => {
    const onClose = vi.fn();
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = render(
      <FileViewerModal
        name="test.txt"
        content="content"
        onClose={onClose}
      />
    );

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    removeEventListenerSpy.mockRestore();
  });
});
