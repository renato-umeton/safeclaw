import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { Layout } from '../../../src/components/layout/Layout';

const mockCloseFile = vi.fn();
let mockFile: { name: string; content: string } | null = null;

vi.mock('../../../src/stores/file-viewer-store', () => ({
  useFileViewerStore: vi.fn((selector: any) => {
    const state = { file: mockFile, openFile: vi.fn(), closeFile: mockCloseFile };
    return selector ? selector(state) : state;
  }),
}));

describe('Layout', () => {
  it('renders the layout shell', () => {
    const { container } = render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    );
    expect(container).toBeTruthy();
  });

  it('contains navigation links', () => {
    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    );

    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
  });

  it('renders SafeClaw branding', () => {
    const { container } = render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    );
    expect(container.textContent).toContain('SafeClaw');
  });

  it('renders nav items with correct labels', () => {
    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    );
    expect(screen.getAllByText('Chat').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Files').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tasks').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Settings').length).toBeGreaterThan(0);
  });

  it('highlights active nav tab', () => {
    render(
      <MemoryRouter initialEntries={['/chat']}>
        <Layout />
      </MemoryRouter>
    );
    // The active NavLink should have tab-active class
    const links = screen.getAllByRole('link');
    const chatLinks = links.filter(l => l.textContent?.includes('Chat'));
    expect(chatLinks.some(l => l.className.includes('active'))).toBe(true);
  });

  it('renders FileViewerModal when file is open', () => {
    mockFile = { name: 'test.txt', content: 'hello world' };
    const { container } = render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    );
    // Modal should be rendered
    expect(container.querySelector('dialog')).toBeTruthy();
    mockFile = null;
  });
});
