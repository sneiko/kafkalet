import { create } from 'zustand'
import type { Plugin } from './types'

interface PluginState {
  plugins: Plugin[]
  setPlugins: (plugins: Plugin[]) => void
  upsertPlugin: (plugin: Plugin) => void
  removePlugin: (id: string) => void
}

export const usePluginStore = create<PluginState>((set) => ({
  plugins: [],
  setPlugins: (plugins) => set({ plugins }),
  upsertPlugin: (plugin) =>
    set((s) => ({
      plugins: s.plugins.some((p) => p.id === plugin.id)
        ? s.plugins.map((p) => (p.id === plugin.id ? plugin : p))
        : [...s.plugins, plugin],
    })),
  removePlugin: (id) => set((s) => ({ plugins: s.plugins.filter((p) => p.id !== id) })),
}))
