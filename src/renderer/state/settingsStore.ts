import { create } from 'zustand'
import type { AppSettings } from '../../shared/types'
import { DEFAULT_SETTINGS } from '../../shared/constants'
import { normalizeSettings } from '../../shared/utils/settingsValidation'

interface SettingsState {
  settings: AppSettings
  loaded: boolean
  load: () => Promise<void>
  update: (patch: Partial<AppSettings>) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  load: async () => {
    const all = await window.abumrium.store.getAll()
    set({ settings: normalizeSettings(all.settings), loaded: true })
  },

  update: async (patch) => {
    const next = normalizeSettings({ ...get().settings, ...patch })
    set({ settings: next })
    await window.abumrium.store.set('settings', next)
  },
}))
