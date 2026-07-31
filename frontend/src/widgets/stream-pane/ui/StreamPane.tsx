import { useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Square, Trash2, CheckCheck, Loader2, Download, SendHorizonal, Pause, Play } from 'lucide-react'

import { Button } from '@/shared/ui/button'
import { IconButton } from '@/shared/ui/icon-button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { EventsOn, StopSession, CommitSession, PauseSession, ResumeSession } from '@shared/api'
import { useSessionStore } from '@entities/session'
import { useSearchStore } from '@entities/search'
import { SearchResultsPane } from '@features/topic-search'
import { MessageRow, MessageDetailDialog } from '@entities/message'
import type { KafkaMessage, SortField } from '@entities/message'
import { applyColumnFilter, DEFAULT_SORT, EMPTY_COLUMN_FILTER } from '@entities/message'
import { ColumnHeader } from '@features/message-column-header'
import { exportAsJson, exportAsCsv } from '@shared/lib/exportMessages'
import { usePluginStore } from '@entities/plugin'
import { applyPlugin } from '@shared/lib/applyPlugin'
import { ProduceDialog } from '@features/message-produce'

const ROW_HEIGHT = 36

const COLUMNS: Array<{ field: SortField; label: string }> = [
  { field: 'partition-offset', label: '#Offset' },
  { field: 'timestamp', label: 'Timestamp' },
  { field: 'key', label: 'Key' },
  { field: 'value', label: 'Value' },
]

const GRID_TEMPLATE = '104px 148px 168px 1fr'

export function StreamPane() {
  const activeSearchId = useSearchStore((s) => s.activeSearchId)

  if (activeSearchId) {
    return <SearchResultsPane sessionId={activeSearchId} />
  }

  return <StreamPaneInner />
}

function StreamPaneInner() {
  const { sessions, activeSessionId, mergeMessages, removeSession, clearMessages, setSessionPaused } =
    useSessionStore()
  const plugins = usePluginStore((s) => s.plugins)

  const session = activeSessionId ? sessions[activeSessionId] : null
  const topic = session?.topic ?? ''

  const sort = useSessionStore((s) => (topic ? s.getSort(topic) : DEFAULT_SORT))
  const filter = useSessionStore((s) => (topic ? s.getFilter(topic) : EMPTY_COLUMN_FILTER))
  const setSort = useSessionStore((s) => s.setSort)
  const setFilter = useSessionStore((s) => s.setFilter)

  const allMessages = session?.messages ?? []

  const [committing, setCommitting] = useState(false)
  const [commitResult, setCommitResult] = useState<string | null>(null)
  const [selectedMessage, setSelectedMessage] = useState<KafkaMessage | null>(null)
  const [selectedDecoded, setSelectedDecoded] = useState<string | null>(null)
  const [selectedDecodedKey, setSelectedDecodedKey] = useState<string | null>(null)
  const [produceOpen, setProduceOpen] = useState(false)

  const messages = applyColumnFilter(allMessages, filter)

  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 15,
  })

  // Auto-scroll when new messages arrive. Anchor depends on the primary sort:
  // asc keeps newest at the tail, desc at the head. Key/value sorts have no
  // predictable "newest" position so we don't move the viewport.
  const primary = sort[0] ?? DEFAULT_SORT[0]
  const anchorsTail =
    (primary.field === 'partition-offset' || primary.field === 'timestamp') &&
    primary.direction === 'asc'
  const anchorsHead =
    (primary.field === 'partition-offset' || primary.field === 'timestamp') &&
    primary.direction === 'desc'

  useEffect(() => {
    if (messages.length === 0) return
    if (anchorsTail) {
      virtualizer.scrollToIndex(messages.length - 1, { behavior: 'auto' })
    } else if (anchorsHead) {
      virtualizer.scrollToIndex(0, { behavior: 'auto' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMessages.length, anchorsTail, anchorsHead])

  // RAF-batched merge to keep sort cost amortized under high throughput.
  useEffect(() => {
    if (!activeSessionId) return
    const session = sessions[activeSessionId]
    if (!session || session.paused) return
    setCommitResult(null)

    const pending: KafkaMessage[] = []
    let rafHandle: number | null = null

    const flush = () => {
      rafHandle = null
      if (pending.length === 0) return
      const batch = pending.splice(0, pending.length)
      mergeMessages(activeSessionId, batch)
    }

    const unsubscribe = EventsOn(`stream:${activeSessionId}`, (msg: KafkaMessage) => {
      // Ignore messages if session is paused
      const currentSession = sessions[activeSessionId]
      if (currentSession?.paused) return
      
      pending.push(msg)
      if (rafHandle == null) {
        rafHandle = requestAnimationFrame(flush)
      }
    })

    return () => {
      unsubscribe()
      if (rafHandle != null) cancelAnimationFrame(rafHandle)
      if (pending.length > 0) mergeMessages(activeSessionId, pending)
    }
  }, [activeSessionId, mergeMessages, sessions])

  const handleStop = async () => {
    if (!activeSessionId) return
    await StopSession(activeSessionId)
    removeSession(activeSessionId)
  }

  const handlePause = async () => {
    if (!activeSessionId) return
    const session = sessions[activeSessionId]
    if (!session) return
    
    if (session.paused) {
      await ResumeSession(activeSessionId)
      setSessionPaused(activeSessionId, false)
    } else {
      await PauseSession(activeSessionId)
      setSessionPaused(activeSessionId, true)
    }
  }

  const handleClear = () => {
    if (!activeSessionId) return
    clearMessages(activeSessionId)
  }

  const handleCommit = async () => {
    if (!activeSessionId) return
    setCommitting(true)
    setCommitResult(null)
    try {
      await CommitSession(activeSessionId)
      setCommitResult(`✓ Committed (${allMessages.length} msgs)`)
    } catch (err) {
      setCommitResult(`✗ ${String(err)}`)
    } finally {
      setCommitting(false)
    }
  }

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Select a topic and click ▶ to observe, or 👥 to join a consumer group
      </div>
    )
  }

  const hasFilter = messages.length !== allMessages.length

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-xs shrink-0">
        <span className="font-mono text-foreground/80 font-medium">{session.topic}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{session.brokerName}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground capitalize">
          {session.mode === 'consumer' ? `group: ${session.groupId}` : session.startOffset}
        </span>
        <span className="ml-1 tabular-nums text-muted-foreground/60">
          ({hasFilter ? `${messages.length}/` : ''}{allMessages.length.toLocaleString()})
        </span>

        {commitResult && (
          <span
            className={
              commitResult.startsWith('✓')
                ? 'text-green-500 ml-1'
                : 'text-destructive ml-1'
            }
          >
            {commitResult}
          </span>
        )}

        <div className="flex-1" />

        <IconButton
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          tooltip="Produce message"
          onClick={() => setProduceOpen(true)}
        >
          <SendHorizonal className="h-3.5 w-3.5" />
        </IconButton>

        {session.mode === 'consumer' && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-xs"
            onClick={handleCommit}
            disabled={committing || allMessages.length === 0}
            aria-label="Commit offsets to Kafka"
          >
            {committing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCheck className="h-3.5 w-3.5" />
            )}
            Commit
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              aria-label="Export messages"
              disabled={allMessages.length === 0}
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-xs">
            <DropdownMenuItem onClick={() => exportAsJson(allMessages, session.topic)}>
              Export as JSON
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportAsCsv(allMessages, session.topic)}>
              Export as CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <IconButton
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleClear}
          tooltip="Clear messages"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handlePause}
          tooltip={session.paused ? 'Resume session' : 'Pause session'}
        >
          {session.paused ? (
            <Play className="h-3.5 w-3.5 fill-current" />
          ) : (
            <Pause className="h-3.5 w-3.5 fill-current" />
          )}
        </IconButton>
        <IconButton
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive hover:text-destructive"
          onClick={handleStop}
          tooltip="Stop session"
        >
          <Square className="h-3.5 w-3.5 fill-current" />
        </IconButton>
      </div>

      {/* Column header with per-column filter + sort */}
      <div
        className="grid border-b border-border/60 px-3 py-1 shrink-0 gap-2"
        style={{ gridTemplateColumns: GRID_TEMPLATE }}
      >
        {COLUMNS.map((col) => (
          <ColumnHeader
            key={col.field}
            label={col.label}
            field={col.field}
            sort={sort}
            filter={filter}
            onSortChange={(next) => setSort(session.topic, next)}
            onFilterChange={(next) => setFilter(session.topic, next)}
          />
        ))}
      </div>

      {/* Virtualized message list */}
      <div ref={parentRef} className="flex-1 overflow-y-auto min-h-0">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            {hasFilter ? 'No messages match the filter.' : 'Waiting for messages…'}
          </div>
        ) : (
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
            {virtualizer.getVirtualItems().map((vItem) => {
              const msg = messages[vItem.index]
              return (
                <MessageRow
                  key={vItem.key}
                  message={msg}
                  decodedValue={applyPlugin(msg, session.topic, plugins)}
                  decodedKey={msg.decodedKey || null}
                  style={{
                    position: 'absolute',
                    top: vItem.start,
                    left: 0,
                    right: 0,
                    height: `${vItem.size}px`,
                  }}
                  onClick={() => {
                    const decoded = applyPlugin(msg, session.topic, plugins)
                    setSelectedMessage(msg)
                    setSelectedDecoded(decoded)
                    setSelectedDecodedKey(msg.decodedKey || null)
                  }}
                />
              )
            })}
          </div>
        )}
      </div>

      <MessageDetailDialog
        message={selectedMessage}
        decodedValue={selectedDecoded}
        decodedKey={selectedDecodedKey}
        open={Boolean(selectedMessage)}
        onOpenChange={(v) => !v && setSelectedMessage(null)}
      />

      <ProduceDialog
        profileId={session.profileId}
        brokerId={session.brokerId}
        topic={session.topic}
        open={produceOpen}
        onOpenChange={setProduceOpen}
      />
    </div>
  )
}
