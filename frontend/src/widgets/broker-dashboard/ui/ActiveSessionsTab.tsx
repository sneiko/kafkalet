import { Eye, Users, Pause, Play } from 'lucide-react'

import { IconButton } from '@/shared/ui/icon-button'
import { useSessionStore } from '@entities/session'
import { PauseSession, ResumeSession } from '@shared/api'

interface Props {
  brokerId: string
}

export function ActiveSessionsTab({ brokerId }: Props) {
  const { sessions, activeSessionId, setActiveSessionId, setSessionPaused } = useSessionStore()

  const brokerSessions = Object.values(sessions).filter((s) => s.brokerId === brokerId)

  const handlePause = async (sessionId: string) => {
    const session = sessions[sessionId]
    if (!session) return
    
    if (session.paused) {
      await ResumeSession(sessionId)
      setSessionPaused(sessionId, false)
    } else {
      await PauseSession(sessionId)
      setSessionPaused(sessionId, true)
    }
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
            className="h-5 w-5 shrink-0 text-primary hover:text-primary"
            onClick={(e) => {
              e.stopPropagation()
              handlePause(session.id)
            }}
            tooltip={session.paused ? 'Resume session' : 'Pause session'}
          >
            {session.paused ? (
              <Play className="h-3 w-3 fill-current" />
            ) : (
              <Pause className="h-3 w-3 fill-current" />
            )}
          </IconButton>
        </button>
      ))}
    </div>
  )
}
