import { useFileViewerStore } from '../../src/stores/file-viewer-store';
import { writeGroupFile } from '../../src/storage';

describe('useFileViewerStore', () => {
  beforeEach(() => {
    useFileViewerStore.setState({ file: null });
  });

  it('starts with null file', () => {
    expect(useFileViewerStore.getState().file).toBeNull();
  });

  it('opens a file', async () => {
    await writeGroupFile('br:main', 'test.txt', 'hello');
    await useFileViewerStore.getState().openFile('test.txt');

    const state = useFileViewerStore.getState();
    expect(state.file).not.toBeNull();
    expect(state.file!.name).toBe('test.txt');
    expect(state.file!.content).toBe('hello');
  });

  it('extracts filename from path', async () => {
    await writeGroupFile('br:main', 'deep/nested/file.js', 'code');
    await useFileViewerStore.getState().openFile('deep/nested/file.js');

    expect(useFileViewerStore.getState().file!.name).toBe('file.js');
  });

  it('closes file', async () => {
    await writeGroupFile('br:main', 'test.txt', 'hello');
    await useFileViewerStore.getState().openFile('test.txt');
    useFileViewerStore.getState().closeFile();

    expect(useFileViewerStore.getState().file).toBeNull();
  });

  it('uses full path as name when split yields empty', async () => {
    // Edge case: path with no segments after split
    await writeGroupFile('br:main', 'test.txt', 'hello');
    // When path is just a filename, pop() returns the filename itself
    await useFileViewerStore.getState().openFile('test.txt');
    expect(useFileViewerStore.getState().file!.name).toBe('test.txt');
  });

  it('opens file with custom groupId', async () => {
    await writeGroupFile('br:custom', 'custom.txt', 'custom content');
    await useFileViewerStore.getState().openFile('custom.txt', 'br:custom');
    expect(useFileViewerStore.getState().file!.content).toBe('custom content');
  });

  it('handles error when file does not exist', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await useFileViewerStore.getState().openFile('nonexistent.txt');

    expect(useFileViewerStore.getState().file).toBeNull();
    consoleSpy.mockRestore();
  });
});
