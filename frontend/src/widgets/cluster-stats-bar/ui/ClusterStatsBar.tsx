import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Loader2 } from 'lucide-react'

import { IconButton } from '@/shared/ui/icon-button'
import { GetClusterStats, type broker } from '@shared/api'
import { cn } from '@shared/lib/utils'

interface Props {
  profileId: string
  brokerId: string
}

export function ClusterStatsBar({ profileId, brokerId }: Props) {
  const [stats, setStats] = useState<broker.ClusterStats | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setStats(await GetClusterStats(profileId, brokerId))
    } catch {
      // silently ignore — bar just shows nothing
    } finally {
      setLoading(false)
    }
  }, [profileId, brokerId])

  useEffect(() => {
    load()
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [load])

  return (
    <div className="flex items-center gap-4 border-b border-border bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
      {loading && !stats ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : stats ? (
        <>
          <StatItem label="Brokers" value={stats.brokerCount} />
          <StatItem label="Topics" value={stats.topicCount} />
          <StatItem label="Partitions" value={stats.totalPartitions} />
          <StatItem
            label="URP"
            value={stats.underReplicatedPartitions}
            alert={stats.underReplicatedPartitions > 0}
          />
          <StatItem
            label="Offline"
            value={stats.offlinePartitions}
            alert={stats.offlinePartitions > 0}
          />
        </>
      ) : null}

      <div className="ml-auto">
        <IconButton
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={load}
          disabled={loading}
          tooltip="Refresh cluster stats"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
        </IconButton>
      </div>
    </div>
  )
}

function StatItem({
  label,
  value,
  alert = false,
}: {
  label: string
  value: number
  alert?: boolean
}) {
  return (
    <span className={cn('tabular-nums', alert && 'font-semibold text-destructive')}>
      {label}: {value}
    </span>
  )
}
