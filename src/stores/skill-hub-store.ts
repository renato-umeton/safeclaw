// ---------------------------------------------------------------------------
// SafeClaw — Skill Hub Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import type { HubSkill, HubSkillDetail } from '../types.js';
import { searchSkills, listSkills, getSkillDetail, sortSkills } from '../skill-hub.js';

interface SkillHubStoreState {
  skills: HubSkill[];
  loading: boolean;
  error: string | null;
  query: string;
  nextCursor: string | null;
  selectedSkill: HubSkillDetail | null;
  selectedSkillLoading: boolean;

  browse: () => Promise<void>;
  search: (query: string, limit?: number) => Promise<void>;
  loadMore: () => Promise<void>;
  selectSkill: (slug: string) => Promise<void>;
  clearSelection: () => void;
  clearError: () => void;
}

export const useSkillHubStore = create<SkillHubStoreState>((set, get) => ({
  skills: [],
  loading: false,
  error: null,
  query: '',
  nextCursor: null,
  selectedSkill: null,
  selectedSkillLoading: false,

  async browse() {
    set({ loading: true, error: null, query: '' });
    try {
      const result = await listSkills({ limit: 20 });
      set({ skills: sortSkills(result.items), nextCursor: result.nextCursor, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false });
    }
  },

  async search(query: string, limit?: number) {
    set({ loading: true, error: null, query });
    try {
      const result = await searchSkills(query, limit);
      set({ skills: sortSkills(result.items), nextCursor: result.nextCursor, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false });
    }
  },

  async loadMore() {
    const { nextCursor, query, skills } = get();
    if (!nextCursor) return;

    set({ loading: true, error: null });
    try {
      const result = query
        ? await searchSkills(query)
        : await listSkills({ cursor: nextCursor, limit: 20 });
      set({
        skills: sortSkills([...skills, ...result.items]),
        nextCursor: result.nextCursor,
        loading: false,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false });
    }
  },

  async selectSkill(slug: string) {
    set({ selectedSkillLoading: true, error: null });
    try {
      const detail = await getSkillDetail(slug);
      set({ selectedSkill: detail, selectedSkillLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), selectedSkillLoading: false });
    }
  },

  clearSelection() {
    set({ selectedSkill: null });
  },

  clearError() {
    set({ error: null });
  },
}));
