import { useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Square, Download } from 'lucide-react'

import { Button } from '@/shared/ui/button'
import { IconButton } from '@/shared/ui/icon-button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { EventsOn, StopSearch } from '@shared/api'
import { useSearchStore } from '@entities/search'
import type { SearchMatch, SearchProgress } from '@entities/search'
import { MessageRow, MessageDetailDialog } from '@entities/message'
import type { KafkaMessage } from '@entities/message'
import { exportAsJson, exportAsCsv } from '@shared/lib/exportMessages'

const ROW_HEIGHT = 36

function matchToMessage(m: SearchMatch): KafkaMessage {
  return {
    topic: m.topic,
    partition: m.partition,
    offset: m.offset,
    key: m.key,
    value: m.value,
    timestamp: m.timestamp,
    headers: m.headers,
  }
}

export function SearchResultsPane({ sessionId }: { sessionId: string }) {
  const session = useSearchStore((s) => s.sessions[sessionId])
  const appendMatch = useSearchStore((s) => s.appendMatch)
  const updateProgress = useSearchStore((s) => s.updateProgress)
  const removeSession = useSearchStore((s) => s.removeSession)

  const [selectedMessage, setSelectedMessage] = useState<KafkaMessage | null>(null)

  const parentRef = useRef<HTMLDivElement>(null)
  const matches = session?.matches ?? []
  const progress = session?.progress

  const virtualizer = useVirtualizer({
    count: matches.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 15,
  })

  // Subscribe to search events
  useEffect(() => {
    const unsubMatch = EventsOn(`search:match:${sessionId}`, (m: SearchMatch) => {
      appendMatch(sessionId, m)
    })
    const unsubProgress = EventsOn(`search:progress:${sessionId}`, (p: SearchProgress) => {
      updateProgress(sessionId, p)
    })
    return () => {
      unsubMatch()
      unsubProgress()
    }
  }, [sessionId, appendMatch, updateProgress])

  const handleStop = async () => {
    await StopSearch(sessionId)
    // Don't remove — keep results visible. Just stop the scan.
  }

  const handleClose = async () => {
    await StopSearch(sessionId)
    removeSession(sessionId)
  }

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Search session not found.
      </div>
    )
  }

  const isDone = progress?.done ?? false
  const scanned = progress?.scanned ?? 0
  const totalEst = progress?.totalEst ?? 0
  const pct = totalEst > 0 ? Math.min(100, Math.round((scanned / totalEst) * 100)) : 0

  const messages = matches.map(matchToMessage)

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-xs shrink-0">
        <span className="font-mono text-foreground/80 font-medium">{session.topic}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{session.brokerName}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">
          Scanned: {scanned.toLocaleString()}{totalEst > 0 && ` / ${totalEst.toLocaleString()}`}
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="text-foreground/70 font-medium">
          Matches: {matches.length.toLocaleString()}
        </span>

        {!isDone && (
          <span className="text-primary font-medium ml-1">{pct}%</span>
        )}
        {isDone && (
          <span className="text-green-500 ml-1">Done</span>
        )}
        {progress?.error && (
          <span className="text-destructive ml-1">{progress.error}</span>
        )}

        <div className="flex-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              aria-label="Export results"
              disabled={matches.length === 0}
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-xs">
            <DropdownMenuItem onClick={() => exportAsJson(messages, `${session.topic}-search`)}>
              Export as JSON
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportAsCsv(messages, `${session.topic}-search`)}>
              Export as CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {!isDone && (
          <IconButton
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={handleStop}
            tooltip="Stop search"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </IconButton>
        )}

        <IconButton
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleClose}
          tooltip="Close search"
        >
          <span className="text-sm leading-none">&times;</span>
        </IconButton>
      </div>

      {/* Progress bar */}
      {!isDone && totalEst > 0 && (
        <div className="h-1 bg-muted shrink-0">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

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

      {/* Virtualized result list */}
      <div ref={parentRef} className="flex-1 overflow-y-auto min-h-0">
        {matches.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            {isDone ? 'No matches found.' : 'Searching...'}
          </div>
        ) : (
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
            {virtualizer.getVirtualItems().map((vItem) => {
              const msg = messages[vItem.index]
              return (
                <MessageRow
                  key={vItem.key}
                  message={msg}
                  style={{
                    position: 'absolute',
                    top: vItem.start,
                    left: 0,
                    right: 0,
                    height: `${vItem.size}px`,
                  }}
                  onClick={() => setSelectedMessage(msg)}
                />
              )
            })}
          </div>
        )}
      </div>

      <MessageDetailDialog
        message={selectedMessage}
        open={Boolean(selectedMessage)}
        onOpenChange={(v) => !v && setSelectedMessage(null)}
      />
    </div>
  )
}
