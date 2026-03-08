/**
 * Test helpers for SafeClaw.
 */

// ---------------------------------------------------------------------------
// In-memory OPFS mock
// ---------------------------------------------------------------------------

type FSEntry = { kind: 'file'; content: string } | { kind: 'directory'; children: Map<string, FSEntry> };

class MockFileSystemWritable {
  private entry: FSEntry & { kind: 'file' };
  private buffer = '';

  constructor(entry: FSEntry & { kind: 'file' }) {
    this.entry = entry;
  }

  async write(data: string | Uint8Array | ArrayBuffer) {
    if (typeof data === 'string') {
      this.buffer += data;
    } else if (data instanceof Uint8Array) {
      this.buffer += new TextDecoder().decode(data);
    } else if (data instanceof ArrayBuffer) {
      this.buffer += new TextDecoder().decode(new Uint8Array(data));
    }
  }

  async close() {
    this.entry.content = this.buffer;
  }
}

class MockFileSystemFileHandle {
  readonly kind = 'file' as const;
  readonly name: string;
  private entry: FSEntry & { kind: 'file' };

  constructor(name: string, entry: FSEntry & { kind: 'file' }) {
    this.name = name;
    this.entry = entry;
  }

  async getFile(): Promise<File> {
    return new File([this.entry.content], this.name);
  }

  async createWritable(): Promise<MockFileSystemWritable> {
    return new MockFileSystemWritable(this.entry);
  }
}

class MockFileSystemDirectoryHandle {
  readonly kind = 'directory' as const;
  readonly name: string;
  private dir: FSEntry & { kind: 'directory' };

  constructor(name: string, dir: FSEntry & { kind: 'directory' }) {
    this.name = name;
    this.dir = dir;
  }

  async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<MockFileSystemDirectoryHandle> {
    let entry = this.dir.children.get(name);
    if (!entry) {
      if (options?.create) {
        entry = { kind: 'directory', children: new Map() };
        this.dir.children.set(name, entry);
      } else {
        throw new DOMException(`Directory not found: ${name}`, 'NotFoundError');
      }
    }
    if (entry.kind !== 'directory') {
      throw new DOMException(`Not a directory: ${name}`, 'TypeMismatchError');
    }
    return new MockFileSystemDirectoryHandle(name, entry);
  }

  async getFileHandle(name: string, options?: { create?: boolean }): Promise<MockFileSystemFileHandle> {
    let entry = this.dir.children.get(name);
    if (!entry) {
      if (options?.create) {
        entry = { kind: 'file', content: '' };
        this.dir.children.set(name, entry);
      } else {
        throw new DOMException(`File not found: ${name}`, 'NotFoundError');
      }
    }
    if (entry.kind !== 'file') {
      throw new DOMException(`Not a file: ${name}`, 'TypeMismatchError');
    }
    return new MockFileSystemFileHandle(name, entry);
  }

  async removeEntry(name: string, _options?: { recursive?: boolean }): Promise<void> {
    if (!this.dir.children.has(name)) {
      throw new DOMException(`Entry not found: ${name}`, 'NotFoundError');
    }
    this.dir.children.delete(name);
  }

  async *entries(): AsyncIterableIterator<[string, MockFileSystemFileHandle | MockFileSystemDirectoryHandle]> {
    for (const [name, entry] of this.dir.children) {
      if (entry.kind === 'file') {
        yield [name, new MockFileSystemFileHandle(name, entry)];
      } else {
        yield [name, new MockFileSystemDirectoryHandle(name, entry)];
      }
    }
  }
}

class MockOPFS {
  private rootDir: FSEntry & { kind: 'directory' } = { kind: 'directory', children: new Map() };

  root(): MockFileSystemDirectoryHandle {
    return new MockFileSystemDirectoryHandle('', this.rootDir);
  }

  reset(): void {
    this.rootDir = { kind: 'directory', children: new Map() };
  }
}

export const mockOPFS = new MockOPFS();

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------

export function mockFetchResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  const responseHeaders = new Headers(headers);
  if (!responseHeaders.has('content-type')) {
    responseHeaders.set('content-type', 'application/json');
  }
  return new Response(
    typeof body === 'string' ? body : JSON.stringify(body),
    { status, headers: responseHeaders },
  );
}

export function createAnthropicResponse(text: string, stopReason = 'end_turn') {
  return {
    content: [{ type: 'text', text }],
    stop_reason: stopReason,
    usage: {
      input_tokens: 100,
      output_tokens: 50,
      cache_read_input_tokens: 10,
      cache_creation_input_tokens: 5,
    },
    model: 'claude-sonnet-4-6',
  };
}

export function createAnthropicToolUseResponse(toolName: string, toolInput: Record<string, unknown>, toolId = 'tool-123') {
  return {
    content: [
      { type: 'tool_use', id: toolId, name: toolName, input: toolInput },
    ],
    stop_reason: 'tool_use',
    usage: { input_tokens: 100, output_tokens: 50 },
    model: 'claude-sonnet-4-6',
  };
}

export function createGeminiResponse(text: string) {
  return {
    candidates: [{
      content: { parts: [{ text }] },
    }],
    usageMetadata: {
      promptTokenCount: 100,
      candidatesTokenCount: 50,
    },
  };
}

export function createGeminiToolCallResponse(name: string, args: Record<string, unknown>) {
  return {
    candidates: [{
      content: {
        parts: [{ functionCall: { name, args } }],
      },
    }],
    usageMetadata: {
      promptTokenCount: 100,
      candidatesTokenCount: 50,
    },
  };
}
