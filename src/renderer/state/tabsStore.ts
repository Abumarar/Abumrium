/**
 * Zustand tab store — mirrors tab state sent from the main process.
 * The main process is the source of truth; this store is updated via IPC events.
 */
import { create } from 'zustand'
import type { Tab, ContainerId } from '../../shared/types'
import { parseAddressBarInput } from '../../shared/utils/urlParser'
import { useSettingsStore } from './settingsStore'

interface TabsState {
  tabs: Tab[]
  activeTabId: string | null

  // Actions (call window.abumrium.tabs.* then wait for TAB_UPDATED event)
  newTab: (url?: string, containerId?: ContainerId) => Promise<void>
  closeTab: (tabId: string) => Promise<void>
  switchTab: (tabId: string) => Promise<void>
  navigate: (tabId: string, rawInput: string, searchEngine?: string) => Promise<void>
  reload: (tabId: string) => Promise<void>
  stopLoading: (tabId: string) => Promise<void>
  goBack: (tabId: string) => Promise<void>
  goForward: (tabId: string) => Promise<void>

  // Called by IPC event listener in App.tsx
  _syncFromMain: (tabs: Tab[], activeTabId: string | null) => void
}

export const useTabsStore = create<TabsState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  newTab: async (url, containerId) => {
    const settings = useSettingsStore.getState().settings
    const target = parseAddressBarInput(url ?? settings.homePage, settings.searchEngine)
    await window.abumrium.tabs.create(target, containerId ?? settings.defaultContainer)
  },

  closeTab: async (tabId) => {
    await window.abumrium.tabs.close(tabId)
  },

  switchTab: async (tabId) => {
    await window.abumrium.tabs.switch(tabId)
  },

  navigate: async (tabId, rawInput, searchEngine) => {
    const engine = searchEngine ?? useSettingsStore.getState().settings.searchEngine
    const url = parseAddressBarInput(rawInput, engine)
    await window.abumrium.tabs.navigate(tabId, url)
  },

  reload: async (tabId) => {
    await window.abumrium.tabs.reload(tabId)
  },

  stopLoading: async (tabId) => {
    await window.abumrium.tabs.stopLoading(tabId)
  },

  goBack: async (tabId) => {
    await window.abumrium.tabs.goBack(tabId)
  },

  goForward: async (tabId) => {
    await window.abumrium.tabs.goForward(tabId)
  },

  _syncFromMain: (tabs, activeTabId) => set({ tabs, activeTabId }),
}))

export const useActiveTab = (): Tab | undefined => {
  const { tabs, activeTabId } = useTabsStore()
  return tabs.find(t => t.id === activeTabId)
}
