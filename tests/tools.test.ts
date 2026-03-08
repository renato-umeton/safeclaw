import { TOOL_DEFINITIONS } from '../src/tools';

describe('TOOL_DEFINITIONS', () => {
  it('exports an array of tool definitions', () => {
    expect(Array.isArray(TOOL_DEFINITIONS)).toBe(true);
    expect(TOOL_DEFINITIONS.length).toBeGreaterThan(0);
  });

  it('contains all expected tools', () => {
    const names = TOOL_DEFINITIONS.map((t) => t.name);
    expect(names).toContain('bash');
    expect(names).toContain('read_file');
    expect(names).toContain('write_file');
    expect(names).toContain('list_files');
    expect(names).toContain('fetch_url');
    expect(names).toContain('update_memory');
    expect(names).toContain('create_task');
    expect(names).toContain('javascript');
  });

  it('all tools have required fields', () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.input_schema).toBeDefined();
      expect(tool.input_schema.type).toBe('object');
      expect(tool.input_schema.properties).toBeDefined();
    }
  });

  it('bash tool requires command parameter', () => {
    const bash = TOOL_DEFINITIONS.find((t) => t.name === 'bash')!;
    expect(bash.input_schema.required).toContain('command');
  });

  it('read_file tool requires path parameter', () => {
    const readFile = TOOL_DEFINITIONS.find((t) => t.name === 'read_file')!;
    expect(readFile.input_schema.required).toContain('path');
  });

  it('write_file tool requires path and content', () => {
    const writeFile = TOOL_DEFINITIONS.find((t) => t.name === 'write_file')!;
    expect(writeFile.input_schema.required).toContain('path');
    expect(writeFile.input_schema.required).toContain('content');
  });

  it('fetch_url tool requires url parameter', () => {
    const fetchUrl = TOOL_DEFINITIONS.find((t) => t.name === 'fetch_url')!;
    expect(fetchUrl.input_schema.required).toContain('url');
  });

  it('create_task tool requires schedule and prompt', () => {
    const createTask = TOOL_DEFINITIONS.find((t) => t.name === 'create_task')!;
    expect(createTask.input_schema.required).toContain('schedule');
    expect(createTask.input_schema.required).toContain('prompt');
  });

  it('javascript tool requires code parameter', () => {
    const js = TOOL_DEFINITIONS.find((t) => t.name === 'javascript')!;
    expect(js.input_schema.required).toContain('code');
  });

  it('list_files tool does not require path (optional)', () => {
    const listFiles = TOOL_DEFINITIONS.find((t) => t.name === 'list_files')!;
    expect(listFiles.input_schema.required).toBeUndefined();
  });
});
