import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Loader2, ChevronRight, ChevronDown, Search } from 'lucide-react'

import { IconButton } from '@/shared/ui/icon-button'
import { Input } from '@/shared/ui/input'
import { GroupStateBadge } from '@entities/consumer-group'
import type { GroupSummary, GroupDetail } from '@entities/consumer-group'
import { ListAllConsumerGroups, GetConsumerGroupDetail } from '@shared/api'

interface Props {
  profileId: string
  brokerId: string
}

export function ConsumerGroupsTab({ profileId, brokerId }: Props) {
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const [detailCache, setDetailCache] = useState<Record<string, GroupDetail>>({})
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null)

  const load = useCallback(async () => {
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
  }, [profileId, brokerId])

  useEffect(() => {
    load()
  }, [load])

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

  const filtered = groups.filter((g) =>
    g.groupId.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 shrink-0">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search consumer groups..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 pl-7 text-xs"
          />
        </div>
        <IconButton
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={load}
          disabled={loading}
          tooltip="Refresh consumer groups"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </IconButton>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 min-h-0">
        {error && <p className="px-2 py-2 text-sm text-destructive">{error}</p>}

        {loading && groups.length === 0 && !error ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading consumer groups...
          </div>
        ) : !loading && groups.length === 0 && !error ? (
          <p className="py-8 text-center text-xs text-muted-foreground">No consumer groups found.</p>
        ) : filtered.length > 0 ? (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-background z-10">
              <tr className="border-b border-border text-muted-foreground">
                <th className="pb-1 text-left font-normal w-5" />
                <th className="pb-1 text-left font-normal">Group ID</th>
                <th className="pb-1 text-left font-normal">State</th>
                <th className="pb-1 text-right font-normal">Total Lag</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => {
                const isExpanded = expandedGroup === g.groupId
                const detail = detailCache[g.groupId]
                const isLoadingDetail = loadingDetail === g.groupId

                return (
                  <GroupRow
                    key={g.groupId}
                    group={g}
                    isExpanded={isExpanded}
                    detail={detail}
                    isLoadingDetail={isLoadingDetail}
                    onToggle={() => handleToggleGroup(g.groupId)}
                  />
                )
              })}
            </tbody>
          </table>
        ) : search ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            No groups match "{search}"
          </p>
        ) : null}
      </div>
    </div>
  )
}

function GroupRow({
  group,
  isExpanded,
  detail,
  isLoadingDetail,
  onToggle,
}: {
  group: GroupSummary
  isExpanded: boolean
  detail?: GroupDetail
  isLoadingDetail: boolean
  onToggle: () => void
}) {
  return (
    <>
      <tr
        className="border-b border-border/40 cursor-pointer hover:bg-accent/30"
        onClick={onToggle}
      >
        <td className="py-1 pr-1">
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
        </td>
        <td className="py-1 font-mono">{group.groupId}</td>
        <td className="py-1">
          <GroupStateBadge state={group.state} />
        </td>
        <td className={`py-1 text-right tabular-nums ${group.totalLag > 0 ? 'text-yellow-500' : 'text-green-500'}`}>
          {group.totalLag.toLocaleString()}
        </td>
      </tr>

      {isExpanded && (
        <tr className="border-b border-border/20">
          <td colSpan={4} className="pb-2 pl-5">
            {isLoadingDetail ? (
              <div className="flex items-center gap-1.5 py-2 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading...
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
}
