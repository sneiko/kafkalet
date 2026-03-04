import { useEffect, useState } from 'react'
import { RefreshCw, Loader2, ChevronRight, ChevronDown } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { GroupStateBadge } from '@entities/consumer-group'
import type { GroupSummary, GroupDetail } from '@entities/consumer-group'
import { ListAllConsumerGroups, GetConsumerGroupDetail } from '@shared/api'

interface Props {
  profileId: string
  brokerId: string
  brokerName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ConsumerGroupsDialog({ profileId, brokerId, brokerName, open, onOpenChange }: Props) {
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const [detailCache, setDetailCache] = useState<Record<string, GroupDetail>>({})
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await ListAllConsumerGroups(profileId, brokerId)
      setGroups(result ?? [])
      setDetailCache({})
      setExpandedGroup(null)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleToggleGroup = async (groupId: string) => {
    if (expandedGroup === groupId) {
      setExpandedGroup(null)
      return
    }
    setExpandedGroup(groupId)
    if (detailCache[groupId]) return

    setLoadingDetail(groupId)
    try {
      const detail = await GetConsumerGroupDetail(profileId, brokerId, groupId)
      setDetailCache((prev) => ({ ...prev, [groupId]: detail as unknown as GroupDetail }))
    } catch {
      // silently — user can retry by re-expanding
    } finally {
      setLoadingDetail(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>
              Consumer Groups —{' '}
              <span className="font-normal text-muted-foreground">{brokerName}</span>
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-6 w-6"
              onClick={load}
              disabled={loading}
              title="Refresh"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {!loading && groups.length === 0 && !error && (
          <p className="py-4 text-center text-sm text-muted-foreground">No consumer groups found.</p>
        )}

        {groups.length > 0 && (
          <div className="max-h-[480px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-1 text-left font-normal w-5" />
                  <th className="pb-1 text-left font-normal">Group ID</th>
                  <th className="pb-1 text-left font-normal">State</th>
                  <th className="pb-1 text-right font-normal">Total Lag</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => {
                  const isExpanded = expandedGroup === g.groupId
                  const detail = detailCache[g.groupId]
                  const isLoadingDetail = loadingDetail === g.groupId

                  return (
                    <>
                      <tr
                        key={g.groupId}
                        className="border-b border-border/40 cursor-pointer hover:bg-accent/30"
                        onClick={() => handleToggleGroup(g.groupId)}
                      >
                        <td className="py-1 pr-1">
                          {isExpanded ? (
                            <ChevronDown className="h-3 w-3 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          )}
                        </td>
                        <td className="py-1 font-mono">{g.groupId}</td>
                        <td className="py-1">
                          <GroupStateBadge state={g.state} />
                        </td>
                        <td className={`py-1 text-right tabular-nums ${g.totalLag > 0 ? 'text-yellow-500' : 'text-green-500'}`}>
                          {g.totalLag.toLocaleString()}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr key={`${g.groupId}-detail`} className="border-b border-border/20">
                          <td colSpan={4} className="pb-2 pl-5">
                            {isLoadingDetail ? (
                              <div className="flex items-center gap-1.5 py-2 text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Loading…
                              </div>
                            ) : detail ? (
                              <div className="space-y-2 pt-1">
                                {detail.topics.map((t) => (
                                  <div key={t.topic}>
                                    <p className="mb-1 font-mono text-foreground/80">{t.topic}</p>
                                    <table className="w-full">
                                      <thead>
                                        <tr className="text-muted-foreground">
                                          <th className="pb-0.5 text-left font-normal">Partition</th>
                                          <th className="pb-0.5 text-right font-normal">Committed</th>
                                          <th className="pb-0.5 text-right font-normal">Log End</th>
                                          <th className="pb-0.5 text-right font-normal">Lag</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {t.partitions.map((p) => (
                                          <tr key={p.partition} className="border-t border-border/20">
                                            <td className="py-0.5 tabular-nums">{p.partition}</td>
                                            <td className="py-0.5 text-right tabular-nums text-muted-foreground">
                                              {p.commitOffset}
                                            </td>
                                            <td className="py-0.5 text-right tabular-nums text-muted-foreground">
                                              {p.logEndOffset}
                                            </td>
                                            <td className={`py-0.5 text-right tabular-nums ${p.lag > 0 ? 'text-yellow-500' : 'text-green-500'}`}>
                                              {p.lag}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
