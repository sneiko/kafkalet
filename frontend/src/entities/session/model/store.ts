import { create } from 'zustand'
import type { KafkaMessage } from '@entities/message'

const MAX_MESSAGES = 10_000

export interface StreamSession {
  id: string
  profileId: string
  brokerId: string
  brokerName: string
  topic: string
  startOffset: string
  mode: 'observer' | 'consumer'
  groupId?: string
  messages: KafkaMessage[]
}

interface SessionState {
  sessions: Record<string, StreamSession>
  activeSessionId: string | null

  addSession: (s: Omit<StreamSession, 'messages'>) => void
  removeSession: (id: string) => void
  appendMessage: (sessionId: string, msg: KafkaMessage) => void
  setActiveSessionId: (id: string | null) => void
  clearMessages: (sessionId: string) => void
}

export const useSessionStore = create<SessionState>((set) => ({
  sessions: {},
  activeSessionId: null,

  addSession: (s) =>
    set((state) => ({
      sessions: { ...state.sessions, [s.id]: { ...s, messages: [] } },
      activeSessionId: s.id,
    })),

  removeSession: (id) =>
    set((state) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [id]: _removed, ...rest } = state.sessions
      return {
        sessions: rest,
        activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
      }
    }),

  appendMessage: (sessionId, msg) =>
    set((state) => {
      const session = state.sessions[sessionId]
      if (!session) return state
      const prev = session.messages
      const messages =
        prev.length >= MAX_MESSAGES ? [...prev.slice(1), msg] : [...prev, msg]
      return {
        sessions: { ...state.sessions, [sessionId]: { ...session, messages } },
      }
    }),

  setActiveSessionId: (id) => set({ activeSessionId: id }),

  clearMessages: (sessionId) =>
    set((state) => {
      const session = state.sessions[sessionId]
      if (!session) return state
      return {
        sessions: { ...state.sessions, [sessionId]: { ...session, messages: [] } },
      }
    }),
}))
