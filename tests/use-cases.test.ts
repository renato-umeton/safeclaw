import {
  USE_CASES,
  getUseCasesByCategory,
  getUseCasesByDifficulty,
  getAllCategories,
  getAllTags,
} from '../src/use-cases';

describe('use-cases catalog', () => {
  it('exports a non-empty array of use cases', () => {
    expect(Array.isArray(USE_CASES)).toBe(true);
    expect(USE_CASES.length).toBeGreaterThan(0);
  });

  it('every use case has required fields', () => {
    for (const uc of USE_CASES) {
      expect(uc).toHaveProperty('id');
      expect(uc).toHaveProperty('title');
      expect(uc).toHaveProperty('description');
      expect(uc).toHaveProperty('category');
      expect(uc).toHaveProperty('tags');
      expect(uc).toHaveProperty('difficulty');
      expect(typeof uc.id).toBe('string');
      expect(typeof uc.title).toBe('string');
      expect(typeof uc.description).toBe('string');
      expect(typeof uc.category).toBe('string');
      expect(uc.title.length).toBeGreaterThan(0);
      expect(uc.description.length).toBeGreaterThan(0);
    }
  });

  it('every id is unique', () => {
    const ids = USE_CASES.map((uc) => uc.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('difficulty is one of beginner, intermediate, advanced', () => {
    const valid = ['beginner', 'intermediate', 'advanced'];
    for (const uc of USE_CASES) {
      expect(valid).toContain(uc.difficulty);
    }
  });

  it('tags is a non-empty string array', () => {
    for (const uc of USE_CASES) {
      expect(Array.isArray(uc.tags)).toBe(true);
      expect(uc.tags.length).toBeGreaterThan(0);
      for (const tag of uc.tags) {
        expect(typeof tag).toBe('string');
      }
    }
  });

  it('getUseCasesByCategory returns only matching use cases', () => {
    const categories = getAllCategories();
    for (const cat of categories) {
      const result = getUseCasesByCategory(cat);
      expect(result.length).toBeGreaterThan(0);
      for (const uc of result) {
        expect(uc.category).toBe(cat);
      }
    }
  });

  it('getUseCasesByCategory returns empty array for unknown category', () => {
    expect(getUseCasesByCategory('nonexistent-category')).toEqual([]);
  });

  it('getUseCasesByDifficulty returns only matching use cases', () => {
    const result = getUseCasesByDifficulty('beginner');
    expect(result.length).toBeGreaterThan(0);
    for (const uc of result) {
      expect(uc.difficulty).toBe('beginner');
    }
  });

  it('getAllCategories returns unique category values', () => {
    const categories = getAllCategories();
    expect(categories.length).toBeGreaterThan(0);
    expect(new Set(categories).size).toBe(categories.length);
  });

  it('getAllTags returns unique flattened tag values', () => {
    const tags = getAllTags();
    expect(tags.length).toBeGreaterThan(0);
    expect(new Set(tags).size).toBe(tags.length);
  });
});
