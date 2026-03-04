import { Eye, Users, Square } from 'lucide-react'

import { IconButton } from '@/shared/ui/icon-button'
import { useSessionStore } from '@entities/session'
import { StopSession } from '@shared/api'

interface Props {
  brokerId: string
}

export function ActiveSessionsTab({ brokerId }: Props) {
  const { sessions, activeSessionId, setActiveSessionId, removeSession } = useSessionStore()

  const brokerSessions = Object.values(sessions).filter((s) => s.brokerId === brokerId)

  const handleStop = async (sessionId: string) => {
    await StopSession(sessionId)
    removeSession(sessionId)
  }

  if (brokerSessions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center py-12 text-xs text-muted-foreground">
        No active sessions for this broker.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1 p-3">
      {brokerSessions.map((session) => (
        <button
          key={session.id}
          onClick={() => setActiveSessionId(session.id)}
          className={`flex items-center gap-3 rounded-md border px-3 py-2 text-xs transition-colors ${
            session.id === activeSessionId
              ? 'border-primary/40 bg-accent'
              : 'border-border hover:bg-accent/50'
          }`}
        >
          {session.mode === 'consumer' ? (
            <Users className="h-3.5 w-3.5 shrink-0 text-primary/70" />
          ) : (
            <Eye className="h-3.5 w-3.5 shrink-0 text-primary/70" />
          )}
          <div className="flex-1 min-w-0 text-left">
            <span className="font-mono text-foreground/90">{session.topic}</span>
            {session.mode === 'consumer' && session.groupId && (
              <span className="ml-2 text-muted-foreground">group: {session.groupId}</span>
            )}
          </div>
          <span className="tabular-nums text-muted-foreground shrink-0">
            {session.messages.length.toLocaleString()} msgs
          </span>
          <IconButton
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation()
              handleStop(session.id)
            }}
            tooltip="Stop session"
          >
            <Square className="h-3 w-3 fill-current" />
          </IconButton>
        </button>
      ))}
    </div>
  )
}
