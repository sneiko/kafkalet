import { Eye, Users, Search, X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/shared/ui/tooltip'
import { useSessionStore } from '@entities/session'
import { useSearchStore } from '@entities/search'
import { StopSession, StopSearch } from '@shared/api'

type TabKind = 'stream' | 'search'

interface TabItem {
  id: string
  kind: TabKind
  topic: string
  mode?: 'observer' | 'consumer'
  groupId?: string
}

export function SessionTabBar() {
  const { sessions, activeSessionId, setActiveSessionId, removeSession } = useSessionStore()
  const searchSessions = useSearchStore((s) => s.sessions)
  const activeSearchId = useSearchStore((s) => s.activeSearchId)
  const setActiveSearchId = useSearchStore((s) => s.setActiveSearchId)
  const removeSearchSession = useSearchStore((s) => s.removeSession)

  const streamTabs: TabItem[] = Object.values(sessions).map((s) => ({
    id: s.id,
    kind: 'stream',
    topic: s.topic,
    mode: s.mode,
    groupId: s.groupId,
  }))

  const searchTabs: TabItem[] = Object.values(searchSessions).map((s) => ({
    id: s.id,
    kind: 'search',
    topic: s.topic,
  }))

  const allTabs = [...streamTabs, ...searchTabs]

  if (allTabs.length === 0) return null

  const activeId = activeSearchId ?? activeSessionId

  const handleSelect = (tab: TabItem) => {
    if (tab.kind === 'search') {
      setActiveSearchId(tab.id)
      setActiveSessionId(null)
    } else {
      setActiveSessionId(tab.id)
      setActiveSearchId(null)
    }
  }

  const handleClose = async (tab: TabItem, e: React.MouseEvent) => {
    e.stopPropagation()
    if (tab.kind === 'search') {
      await StopSearch(tab.id)
      removeSearchSession(tab.id)
    } else {
      await StopSession(tab.id)
      removeSession(tab.id)
    }
  }

  return (
    <div className="flex border-b border-border overflow-x-auto shrink-0 bg-background">
      {allTabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => handleSelect(tab)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-xs border-r border-border whitespace-nowrap transition-colors',
            tab.id === activeId
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
          )}
        >
          {tab.kind === 'search' ? (
            <Search className="h-3 w-3 shrink-0 text-orange-500/70" />
          ) : tab.mode === 'consumer' ? (
            <Users className="h-3 w-3 shrink-0 text-primary/70" />
          ) : (
            <Eye className="h-3 w-3 shrink-0 text-primary/70" />
          )}
          <span className="max-w-[120px] truncate font-mono">{tab.topic}</span>
          {tab.kind === 'stream' && tab.mode === 'consumer' && tab.groupId && (
            <span className="text-muted-foreground/60 truncate max-w-[80px]">
              {tab.groupId}
            </span>
          )}
          {tab.kind === 'search' && (
            <span className="text-orange-500/60 text-[10px]">search</span>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => handleClose(tab, e)}
                className="ml-1 rounded p-0.5 hover:text-destructive transition-colors"
                aria-label="Close session"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Close session</TooltipContent>
          </Tooltip>
        </button>
      ))}
    </div>
  )
}
