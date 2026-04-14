import { useEffect, useState } from 'react'
import { RefreshCw, Loader2, ChevronRight, ChevronDown, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog'
import { IconButton } from '@/shared/ui/icon-button'
import { GroupStateBadge } from '@entities/consumer-group'
import type { GroupSummary, GroupDetail, GroupMemberInfo } from '@entities/consumer-group'
import {
  ListAllConsumerGroups,
  GetConsumerGroupDetail,
  DescribeConsumerGroupMembers,
  DeleteConsumerGroup,
} from '@shared/api'

interface Props {
  profileId: string
  brokerId: string
  brokerName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ConsumerGroupsDialog({
  profileId,
  brokerId,
  brokerName,
  open,
  onOpenChange,
}: Props) {
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const [detailCache, setDetailCache] = useState<Record<string, GroupDetail>>({})
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

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
    } catch (err) {
      toast.error('Failed to load group details', { description: String(err) })
    } finally {
      setLoadingDetail(null)
    }
  }

  const handleDeleteGroup = async () => {
    if (!deleteTarget) return
    try {
      await DeleteConsumerGroup(profileId, brokerId, deleteTarget)
      setGroups((prev) => prev.filter((g) => g.groupId !== deleteTarget))
      if (expandedGroup === deleteTarget) setExpandedGroup(null)
      toast.success(`Deleted consumer group "${deleteTarget}"`)
    } catch (err) {
      toast.error('Failed to delete consumer group', { description: String(err) })
    } finally {
      setDeleteTarget(null)
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

        {!loading && groups.length === 0 && !error && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No consumer groups found.
          </p>
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
                  <th className="pb-1 font-normal w-7" />
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => {
                  const isExpanded = expandedGroup === g.groupId
                  const detail = detailCache[g.groupId]
                  const isLoadingDetail = loadingDetail === g.groupId

                  return (
                    <DialogGroupRow
                      key={g.groupId}
                      profileId={profileId}
                      brokerId={brokerId}
                      group={g}
                      isExpanded={isExpanded}
                      detail={detail}
                      isLoadingDetail={isLoadingDetail}
                      onToggle={() => handleToggleGroup(g.groupId)}
                      onDelete={() => setDeleteTarget(g.groupId)}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Consumer Group</AlertDialogTitle>
            <AlertDialogDescription>
              Delete consumer group <span className="font-mono">{deleteTarget}</span>? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteGroup}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}

function DialogGroupRow({
  profileId,
  brokerId,
  group,
  isExpanded,
  detail,
  isLoadingDetail,
  onToggle,
  onDelete,
}: {
  profileId: string
  brokerId: string
  group: GroupSummary
  isExpanded: boolean
  detail?: GroupDetail
  isLoadingDetail: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  const [activeTab, setActiveTab] = useState<'lag' | 'members'>('lag')
  const [members, setMembers] = useState<GroupMemberInfo[] | null>(null)
  const [loadingMembers, setLoadingMembers] = useState(false)

  const loadMembers = async () => {
    if (members) return
    setLoadingMembers(true)
    try {
      const result = await DescribeConsumerGroupMembers(profileId, brokerId, group.groupId)
      setMembers(result ?? [])
    } catch {
      // silently — user can retry
    } finally {
      setLoadingMembers(false)
    }
  }

  const handleTabClick = (tab: 'lag' | 'members') => {
    setActiveTab(tab)
    if (tab === 'members') loadMembers()
  }

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
        <td
          className={`py-1 text-right tabular-nums ${group.totalLag > 0 ? 'text-yellow-500' : 'text-green-500'}`}
        >
          {group.totalLag.toLocaleString()}
        </td>
        <td className="py-1 text-center">
          <IconButton
            variant="ghost"
            size="icon"
            className="h-5 w-5 opacity-0 group-hover:opacity-100 hover:text-destructive"
            tooltip="Delete group"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
          >
            <Trash2 className="h-3 w-3" />
          </IconButton>
        </td>
      </tr>

      {isExpanded && (
        <tr className="border-b border-border/20">
          <td colSpan={5} className="pb-2 pl-5">
            {isLoadingDetail ? (
              <div className="flex items-center gap-1.5 py-2 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading...
              </div>
            ) : detail ? (
              <div className="pt-1">
                {/* Sub-tabs */}
                <div className="flex gap-3 mb-2 border-b border-border/30">
                  <button
                    className={`pb-1 text-xs transition-colors ${activeTab === 'lag' ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                    onClick={() => handleTabClick('lag')}
                  >
                    Lag
                  </button>
                  <button
                    className={`pb-1 text-xs transition-colors ${activeTab === 'members' ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                    onClick={() => handleTabClick('members')}
                  >
                    Members
                  </button>
                </div>

                {activeTab === 'lag' && (
                  <div className="space-y-2">
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
                                <td
                                  className={`py-0.5 text-right tabular-nums ${p.lag > 0 ? 'text-yellow-500' : 'text-green-500'}`}
                                >
                                  {p.lag}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'members' && (
                  <div>
                    {loadingMembers ? (
                      <div className="flex items-center gap-1.5 py-2 text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading members...
                      </div>
                    ) : members && members.length > 0 ? (
                      <table className="w-full">
                        <thead>
                          <tr className="text-muted-foreground">
                            <th className="pb-0.5 text-left font-normal">Client ID</th>
                            <th className="pb-0.5 text-left font-normal">Host</th>
                            <th className="pb-0.5 text-left font-normal">Assigned Topics</th>
                          </tr>
                        </thead>
                        <tbody>
                          {members.map((m) => (
                            <tr key={m.memberId} className="border-t border-border/20">
                              <td className="py-0.5 font-mono">{m.clientId}</td>
                              <td className="py-0.5 text-muted-foreground">{m.clientHost}</td>
                              <td className="py-0.5 text-muted-foreground">
                                {m.topics?.join(', ') || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="py-2 text-muted-foreground">No members (group is empty).</p>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </td>
        </tr>
      )}
    </>
  )
}
