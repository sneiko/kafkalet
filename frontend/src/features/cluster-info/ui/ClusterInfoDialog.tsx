import { useEffect, useState } from 'react'
import { RefreshCw, Loader2, ShieldCheck, ChevronRight, ChevronDown } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { IconButton } from '@/shared/ui/icon-button'
import { Badge } from '@/shared/ui/badge'
import { GetClusterInfo, type broker } from '@shared/api'
import { MessageRatePanel } from '@features/message-rate'

interface Props {
  profileId: string
  brokerId: string
  brokerName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ClusterInfoDialog({ profileId, brokerId, brokerName, open, onOpenChange }: Props) {
  const [info, setInfo] = useState<broker.ClusterInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rateOpen, setRateOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      setInfo(await GetClusterInfo(profileId, brokerId))
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      load()
    } else {
      setRateOpen(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>
              Cluster — <span className="font-normal text-muted-foreground">{brokerName}</span>
            </DialogTitle>
            <IconButton
              variant="ghost"
              size="icon"
              className="ml-auto h-6 w-6"
              onClick={load}
              disabled={loading}
              tooltip="Refresh"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
            </IconButton>
          </div>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {info && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground mb-0.5">Cluster ID</p>
                <p className="font-mono break-all">{info.clusterId || '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-0.5">Controller</p>
                <p className="font-mono">Node {info.controllerId}</p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Brokers ({info.brokers.length})
              </p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-1 text-left font-normal">Node</th>
                    <th className="pb-1 text-left font-normal">Address</th>
                    <th className="pb-1 text-left font-normal">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {info.brokers.map((b) => (
                    <tr key={b.nodeId} className="border-b border-border/40">
                      <td className="py-1 tabular-nums">{b.nodeId}</td>
                      <td className="py-1 font-mono text-muted-foreground">
                        {b.host}:{b.port}
                      </td>
                      <td className="py-1">
                        {b.isController ? (
                          <Badge variant="secondary" className="gap-1 text-[10px]">
                            <ShieldCheck className="h-2.5 w-2.5" />
                            Controller
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">Broker</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Message Rate section */}
            <div>
              <button
                className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setRateOpen((v) => !v)}
              >
                {rateOpen ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                Message Rate
              </button>
              {rateOpen && (
                <div className="mt-2">
                  <MessageRatePanel profileId={profileId} brokerId={brokerId} />
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
