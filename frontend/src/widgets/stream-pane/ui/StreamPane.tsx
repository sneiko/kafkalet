import { useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Square, Trash2, CheckCheck, Loader2, Filter, Download, SendHorizonal } from 'lucide-react'

import { Button } from '@/shared/ui/button'
import { IconButton } from '@/shared/ui/icon-button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { EventsOn, StopSession, CommitSession } from '@shared/api'
import { useSessionStore } from '@entities/session'
import { MessageRow, MessageDetailDialog } from '@entities/message'
import type { KafkaMessage } from '@entities/message'
import { FilterBar, applyFilter } from '@features/message-filter'
import type { FilterState } from '@features/message-filter'
import { exportAsJson, exportAsCsv } from '@shared/lib/exportMessages'
import { usePluginStore } from '@entities/plugin'
import { applyPlugin } from '@shared/lib/applyPlugin'
import { ProduceDialog } from '@features/message-produce'

const ROW_HEIGHT = 36
const LS_FILTER_VISIBLE = 'filter-visible'

export function StreamPane() {
  const { sessions, activeSessionId, appendMessage, removeSession, clearMessages } =
    useSessionStore()
  const plugins = usePluginStore((s) => s.plugins)

  const session = activeSessionId ? sessions[activeSessionId] : null
  const allMessages = session?.messages ?? []

  const [committing, setCommitting] = useState(false)
  const [commitResult, setCommitResult] = useState<string | null>(null)
  const [filterVisible, setFilterVisible] = useState(
    () => localStorage.getItem(LS_FILTER_VISIBLE) === 'true',
  )
  const [filter, setFilter] = useState<FilterState>({ key: '', value: '' })
  const [selectedMessage, setSelectedMessage] = useState<KafkaMessage | null>(null)
  const [selectedDecoded, setSelectedDecoded] = useState<string | null>(null)
  const [produceOpen, setProduceOpen] = useState(false)

  const messages = applyFilter(allMessages, filter)

  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 15,
  })

  // Auto-scroll to bottom when new messages arrive (only if no filter active)
  useEffect(() => {
    if (messages.length > 0 && !filter.key && !filter.value) {
      virtualizer.scrollToIndex(messages.length - 1, { behavior: 'auto' })
    }
  }, [allMessages.length])

  // Subscribe to Wails events for the active session
  useEffect(() => {
    if (!activeSessionId) return
    setCommitResult(null)
    return EventsOn(`stream:${activeSessionId}`, (msg: KafkaMessage) => {
      appendMessage(activeSessionId, msg)
    })
  }, [activeSessionId])

  const handleStop = async () => {
    if (!activeSessionId) return
    await StopSession(activeSessionId)
    removeSession(activeSessionId)
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

  const toggleFilter = () => {
    const next = !filterVisible
    setFilterVisible(next)
    localStorage.setItem(LS_FILTER_VISIBLE, String(next))
    if (!next) setFilter({ key: '', value: '' })
  }

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Select a topic and click ▶ to observe, or 👥 to join a consumer group
      </div>
    )
  }

  const hasFilter = Boolean(filter.key || filter.value)

  return (
    <div className="flex h-full flex-col">
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
          variant={filterVisible ? 'secondary' : 'ghost'}
          size="icon"
          className="h-6 w-6"
          onClick={toggleFilter}
          tooltip="Toggle filter (regex)"
        >
          <Filter className="h-3.5 w-3.5" />
        </IconButton>

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
          className="h-6 w-6 text-destructive hover:text-destructive"
          onClick={handleStop}
          tooltip="Stop session"
        >
          <Square className="h-3.5 w-3.5 fill-current" />
        </IconButton>
      </div>

      {/* Filter bar */}
      {filterVisible && <FilterBar filter={filter} onChange={setFilter} />}

      {/* Column header */}
      <div
        className="grid text-[10px] text-muted-foreground border-b border-border/60 px-3 py-1 shrink-0"
        style={{ gridTemplateColumns: '104px 148px 168px 1fr' }}
      >
        <span>#Offset</span>
        <span>Timestamp</span>
        <span>Key</span>
        <span>Value</span>
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
