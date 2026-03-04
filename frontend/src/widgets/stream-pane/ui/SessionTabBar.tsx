import { Eye, Users, X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/shared/ui/tooltip'
import { useSessionStore } from '@entities/session'
import { StopSession } from '@shared/api'

export function SessionTabBar() {
  const { sessions, activeSessionId, setActiveSessionId, removeSession } = useSessionStore()
  const sessionList = Object.values(sessions)

  if (sessionList.length === 0) return null

  const handleClose = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await StopSession(id)
    removeSession(id)
  }

  return (
    <div className="flex border-b border-border overflow-x-auto shrink-0 bg-background">
      {sessionList.map((s) => (
        <button
          key={s.id}
          onClick={() => setActiveSessionId(s.id)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-xs border-r border-border whitespace-nowrap transition-colors',
            s.id === activeSessionId
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
          )}
        >
          {s.mode === 'consumer' ? (
            <Users className="h-3 w-3 shrink-0 text-primary/70" />
          ) : (
            <Eye className="h-3 w-3 shrink-0 text-primary/70" />
          )}
          <span className="max-w-[120px] truncate font-mono">{s.topic}</span>
          {s.mode === 'consumer' && s.groupId && (
            <span className="text-muted-foreground/60 truncate max-w-[80px]">
              {s.groupId}
            </span>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => handleClose(s.id, e)}
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
