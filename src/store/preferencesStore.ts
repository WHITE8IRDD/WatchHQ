// src/store/preferencesStore.ts
import { create } from 'zustand';

interface PreferencesState {
  prefs: UserPreferences | null;
  loading: boolean;
  loadPreferences: () => Promise<void>;
  updatePreference: (key: string, value: any) => Promise<void>;
  get: () => UserPreferences | null;
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  prefs: null,
  loading: false,

  loadPreferences: async () => {
    try {
      set({ loading: true });
      const prefs = await window.electronAPI.getPreferences();
      set({ prefs });
    } catch {
      // ignore
    } finally {
      set({ loading: false });
    }
  },

  updatePreference: async (key: string, value: any) => {
    try {
      await window.electronAPI.updatePreferences({ [key]: value });
      set((state) => ({
        prefs: state.prefs ? { ...state.prefs, [key]: value } : state.prefs,
      }));
    } catch {
      // ignore
    }
  },

  get: () => get().prefs,
}));

// Helper selector for specific pref
export const prefValue = (key: keyof UserPreferences) => (state: PreferencesState) =>
  state.prefs?.[key] ?? undefined;
