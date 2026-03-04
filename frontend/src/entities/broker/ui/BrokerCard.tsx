import { Server, Wifi, WifiOff } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import type { Broker } from '@entities/profile'

interface Props {
  broker: Broker
  status?: 'idle' | 'connected' | 'error'
  selected?: boolean
  onClick?: () => void
}

export function BrokerCard({ broker, status = 'idle', selected, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        selected && 'bg-accent text-accent-foreground',
      )}
    >
      <Server className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{broker.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {broker.addresses.join(', ') || 'no addresses'}
        </p>
      </div>
      {status === 'connected' && <Wifi className="h-3.5 w-3.5 shrink-0 text-green-500" />}
      {status === 'error' && <WifiOff className="h-3.5 w-3.5 shrink-0 text-destructive" />}
    </button>
  )
}
