import { ulid } from '../src/ulid';

describe('ulid', () => {
  it('returns a 26-character string', () => {
    const id = ulid();
    expect(id).toHaveLength(26);
  });

  it('uses only Crockford Base32 characters', () => {
    const valid = /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;
    for (let i = 0; i < 50; i++) {
      expect(ulid()).toMatch(valid);
    }
  });

  it('generates unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(ulid());
    }
    expect(ids.size).toBe(1000);
  });

  it('generates lexicographically sortable IDs (later IDs sort after earlier ones)', async () => {
    const first = ulid();
    // Advance time slightly
    await new Promise((r) => setTimeout(r, 2));
    const second = ulid();
    expect(second > first).toBe(true);
  });

  it('generates monotonically increasing IDs within the same millisecond', () => {
    // Call multiple times rapidly — within the same ms they should increment
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) {
      ids.push(ulid());
    }
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i] >= ids[i - 1]).toBe(true);
    }
  });
});
