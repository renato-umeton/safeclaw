import { render, screen } from '@testing-library/react';
import { AcknowledgementsSection } from '../../../src/components/settings/AcknowledgementsSection';

describe('AcknowledgementsSection', () => {
  it('renders the acknowledgements heading', () => {
    render(<AcknowledgementsSection />);
    expect(screen.getByText('Acknowledgements')).toBeInTheDocument();
  });

  it('credits OpenClaw with a link', () => {
    render(<AcknowledgementsSection />);
    const link = screen.getByRole('link', { name: 'OpenClaw' });
    expect(link).toHaveAttribute('href', 'https://github.com/openclaw');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('credits OpenBrowserClaw with a link', () => {
    render(<AcknowledgementsSection />);
    const link = screen.getByRole('link', { name: 'OpenBrowserClaw' });
    expect(link).toHaveAttribute('href', 'https://github.com/sachaa/openbrowserclaw');
  });

  it('credits awesome-openclaw-usecases with a link', () => {
    render(<AcknowledgementsSection />);
    const link = screen.getByRole('link', { name: 'awesome-openclaw-usecases' });
    expect(link).toHaveAttribute('href', 'https://github.com/hesamsheikh/awesome-openclaw-usecases');
  });

  it('credits ClawHub with a link', () => {
    render(<AcknowledgementsSection />);
    const link = screen.getByRole('link', { name: 'ClawHub' });
    expect(link).toHaveAttribute('href', 'https://clawhub.ai');
  });

  it('credits WebLLM with a link', () => {
    render(<AcknowledgementsSection />);
    const link = screen.getByRole('link', { name: 'WebLLM' });
    expect(link).toHaveAttribute('href', 'https://webllm.mlc.ai/');
  });

  it('credits Chromium with a link', () => {
    render(<AcknowledgementsSection />);
    const link = screen.getByRole('link', { name: 'Chromium' });
    expect(link).toHaveAttribute('href', 'https://www.chromium.org/');
  });

  it('credits PWA standards with a link', () => {
    render(<AcknowledgementsSection />);
    const link = screen.getByRole('link', { name: 'PWA' });
    expect(link).toHaveAttribute('href', 'https://web.dev/progressive-web-apps/');
  });

  it('contains the "stands on the shoulders of giants" text', () => {
    render(<AcknowledgementsSection />);
    expect(screen.getByText(/stands on the shoulders of giants/)).toBeInTheDocument();
  });
});
