import { create } from 'zustand'
import type { SearchSession, SearchMatch, SearchProgress } from './types'

const MAX_MATCHES = 10_000

interface SearchState {
  sessions: Record<string, SearchSession>
  activeSearchId: string | null

  addSession: (s: Omit<SearchSession, 'matches' | 'progress'>) => void
  removeSession: (id: string) => void
  appendMatch: (sessionId: string, match: SearchMatch) => void
  updateProgress: (sessionId: string, progress: SearchProgress) => void
  setActiveSearchId: (id: string | null) => void
}

export const useSearchStore = create<SearchState>((set) => ({
  sessions: {},
  activeSearchId: null,

  addSession: (s) =>
    set((state) => ({
      sessions: {
        ...state.sessions,
        [s.id]: { ...s, matches: [], progress: null },
      },
      activeSearchId: s.id,
    })),

  removeSession: (id) =>
    set((state) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [id]: _removed, ...rest } = state.sessions
      return {
        sessions: rest,
        activeSearchId: state.activeSearchId === id ? null : state.activeSearchId,
      }
    }),

  appendMatch: (sessionId, match) =>
    set((state) => {
      const session = state.sessions[sessionId]
      if (!session) return state
      const prev = session.matches
      const matches =
        prev.length >= MAX_MATCHES ? [...prev.slice(1), match] : [...prev, match]
      return {
        sessions: { ...state.sessions, [sessionId]: { ...session, matches } },
      }
    }),

  updateProgress: (sessionId, progress) =>
    set((state) => {
      const session = state.sessions[sessionId]
      if (!session) return state
      return {
        sessions: { ...state.sessions, [sessionId]: { ...session, progress } },
      }
    }),

  setActiveSearchId: (id) => set({ activeSearchId: id }),
}))
