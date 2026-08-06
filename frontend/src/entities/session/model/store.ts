import { create } from 'zustand'
import type {
  ColumnFilterState,
  GlobalContainsFilter,
  KafkaMessage,
  SortState,
} from '@entities/message'
import { DEFAULT_SORT, EMPTY_COLUMN_FILTER, EMPTY_GLOBAL_FILTER, getComparator } from '@entities/message'

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
  paused?: boolean
}

interface SessionState {
  sessions: Record<string, StreamSession>
  activeSessionId: string | null
  sortByTopic: Record<string, SortState>
  filterByTopic: Record<string, ColumnFilterState>
  globalFilterByTopic: Record<string, GlobalContainsFilter>

  addSession: (s: Omit<StreamSession, 'messages'>) => void
  removeSession: (id: string) => void
  mergeMessages: (sessionId: string, batch: KafkaMessage[]) => void
  setActiveSessionId: (id: string | null) => void
  clearMessages: (sessionId: string) => void
  setSessionPaused: (id: string, paused: boolean) => void
  getSort: (topic: string) => SortState
  setSort: (topic: string, sort: SortState) => void
  getFilter: (topic: string) => ColumnFilterState
  setFilter: (topic: string, filter: ColumnFilterState) => void
  getGlobalFilter: (topic: string) => GlobalContainsFilter
  setGlobalFilter: (topic: string, filter: GlobalContainsFilter) => void
}

function mergeSorted(
  existing: KafkaMessage[],
  incoming: KafkaMessage[],
  compare: (a: KafkaMessage, b: KafkaMessage) => number,
): KafkaMessage[] {
  const out: KafkaMessage[] = new Array(existing.length + incoming.length)
  let i = 0
  let j = 0
  let k = 0
  while (i < existing.length && j < incoming.length) {
    out[k++] = compare(existing[i], incoming[j]) <= 0 ? existing[i++] : incoming[j++]
  }
  while (i < existing.length) out[k++] = existing[i++]
  while (j < incoming.length) out[k++] = incoming[j++]
  return out
}

function capMessages(messages: KafkaMessage[], sort: SortState): KafkaMessage[] {
  if (messages.length <= MAX_MESSAGES) return messages
  // Use the primary sort's direction to decide which end is "oldest" (arrival-wise).
  // For asc (newest at tail) drop from the head; for desc drop from the tail.
  // When no sort is explicitly set, behave like default (partition-offset asc).
  const primary = sort[0]
  const direction = primary ? primary.direction : 'asc'
  return direction === 'asc'
    ? messages.slice(messages.length - MAX_MESSAGES)
    : messages.slice(0, MAX_MESSAGES)
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: {},
  activeSessionId: null,
  sortByTopic: {},
  filterByTopic: {},
  globalFilterByTopic: {},

  addSession: (s) =>
    set((state) => ({
      sessions: { ...state.sessions, [s.id]: { ...s, messages: [], paused: false } },
      activeSessionId: s.id,
    })),

  setSessionPaused: (id, paused) =>
    set((state) => {
      const session = state.sessions[id]
      if (!session) return state
      return {
        sessions: { ...state.sessions, [id]: { ...session, paused } },
      }
    }),

  removeSession: (id) =>
    set((state) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [id]: _removed, ...rest } = state.sessions
      return {
        sessions: rest,
        activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
      }
    }),

  mergeMessages: (sessionId, batch) =>
    set((state) => {
      const session = state.sessions[sessionId]
      if (!session || batch.length === 0) return state
      const sort = state.sortByTopic[session.topic] ?? DEFAULT_SORT
      const compare = getComparator(sort)
      const sortedBatch = batch.slice().sort(compare)
      const merged = mergeSorted(session.messages, sortedBatch, compare)
      const capped = capMessages(merged, sort)
      return {
        sessions: { ...state.sessions, [sessionId]: { ...session, messages: capped } },
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

  getSort: (topic) => get().sortByTopic[topic] ?? DEFAULT_SORT,

  setSort: (topic, sort) =>
    set((state) => {
      const effective = sort.length === 0 ? DEFAULT_SORT : sort
      const compare = getComparator(effective)
      const nextSessions: Record<string, StreamSession> = {}
      for (const [id, session] of Object.entries(state.sessions)) {
        if (session.topic === topic && session.messages.length > 0) {
          nextSessions[id] = {
            ...session,
            messages: session.messages.slice().sort(compare),
          }
        } else {
          nextSessions[id] = session
        }
      }
      return {
        sortByTopic: { ...state.sortByTopic, [topic]: sort },
        sessions: nextSessions,
      }
    }),

  getFilter: (topic) => get().filterByTopic[topic] ?? EMPTY_COLUMN_FILTER,

  setFilter: (topic, filter) =>
    set((state) => ({
      filterByTopic: { ...state.filterByTopic, [topic]: filter },
    })),

  getGlobalFilter: (topic) => get().globalFilterByTopic[topic] ?? EMPTY_GLOBAL_FILTER,

  setGlobalFilter: (topic, filter) =>
    set((state) => ({
      globalFilterByTopic: { ...state.globalFilterByTopic, [topic]: filter },
    })),
}))
