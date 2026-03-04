import { memo } from 'react'
import { formatRelativeTime } from '@shared/lib/formatters'
import { cn } from '@/shared/lib/utils'
import type { KafkaMessage } from '../model/types'

interface Props {
  message: KafkaMessage
  style?: React.CSSProperties
  decodedValue?: string | null
  onClick?: () => void
}

const VALUE_MAX = 100
const GRID_COLS = '104px 148px 168px 1fr'

export const MessageRow = memo(function MessageRow({ message, style, decodedValue, onClick }: Props) {
  const raw = decodedValue ?? message.value
  const value = raw.length > VALUE_MAX ? raw.slice(0, VALUE_MAX) + '…' : raw

  return (
    <div
      style={{ ...style, gridTemplateColumns: GRID_COLS }}
      className={cn(
        'grid items-center border-b border-border/40 px-3 text-xs',
        onClick ? 'cursor-pointer hover:bg-accent/50' : 'hover:bg-accent/30',
      )}
      onClick={onClick}
    >
      <span className="font-mono text-muted-foreground tabular-nums truncate pr-2">
        P{message.partition} · #{message.offset}
      </span>
      <span className="text-muted-foreground/70 tabular-nums truncate pr-2">
        {formatRelativeTime(message.timestamp)}
      </span>
      <span className="font-mono truncate pr-2">
        {message.key
          ? <span className="bg-muted/50 rounded px-1 text-foreground/70">{message.key}</span>
          : <span className="text-muted-foreground/40">—</span>}
      </span>
      <span className="font-mono text-foreground/85 truncate">
        {value || <span className="text-muted-foreground/50 italic">empty</span>}
      </span>
    </div>
  )
})
