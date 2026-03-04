import { create } from 'zustand'
import type { Profile } from './types'

interface ProfileState {
  profiles: Profile[]
  activeProfileId: string | null
  isLoading: boolean

  setProfiles: (profiles: Profile[]) => void
  setActiveProfileId: (id: string | null) => void
  setLoading: (v: boolean) => void
  upsertProfile: (p: Profile) => void
  removeProfile: (id: string) => void
}

export const useProfileStore = create<ProfileState>((set) => ({
  profiles: [],
  activeProfileId: null,
  isLoading: false,

  setProfiles: (profiles) => set({ profiles }),
  setActiveProfileId: (id) => set({ activeProfileId: id }),
  setLoading: (isLoading) => set({ isLoading }),

  upsertProfile: (p) =>
    set((s) => {
      const idx = s.profiles.findIndex((x) => x.id === p.id)
      if (idx === -1) return { profiles: [...s.profiles, p] }
      const next = [...s.profiles]
      next[idx] = p
      return { profiles: next }
    }),

  removeProfile: (id) =>
    set((s) => ({ profiles: s.profiles.filter((p) => p.id !== id) })),
}))

export const activeProfile = () => {
  const { profiles, activeProfileId } = useProfileStore.getState()
  return profiles.find((p) => p.id === activeProfileId) ?? null
}
