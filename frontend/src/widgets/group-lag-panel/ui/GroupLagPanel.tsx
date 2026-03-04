import { useState } from 'react'
import { RefreshCw, Loader2, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react'

import { useSessionStore } from '@entities/session'
import { LagBadge } from '@entities/consumer-group'
import { Button } from '@/shared/ui/button'
import { IconButton } from '@/shared/ui/icon-button'
import { Separator } from '@/shared/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
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
import { Tooltip, TooltipTrigger, TooltipContent } from '@/shared/ui/tooltip'
import { ListConsumerGroups, ResetConsumerGroup, type broker } from '@shared/api'

export function GroupLagPanel() {
  const { sessions, activeSessionId } = useSessionStore()
  const session = activeSessionId ? sessions[activeSessionId] : null

  const [groupData, setGroupData] = useState<broker.GroupLag | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [resetTarget, setResetTarget] = useState<'earliest' | 'latest' | null>(null)
  const [resetting, setResetting] = useState(false)
  const [resetResult, setResetResult] = useState<{ ok: boolean; msg: string } | null>(null)

  if (!session || session.mode !== 'consumer' || !session.groupId) {
    return null
  }

  const handleRefresh = async () => {
    setLoading(true)
    try {
      const all = await ListConsumerGroups(session.profileId, session.brokerId, session.topic)
      const mine = all?.find((g) => g.groupId === session.groupId) ?? null
      setGroupData(mine)
    } catch {
      // silently keep stale data
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    if (!resetTarget || !session.groupId) return
    setResetting(true)
    setResetResult(null)
    try {
      await ResetConsumerGroup(
        session.profileId,
        session.brokerId,
        session.topic,
        session.groupId,
        resetTarget,
      )
      setResetResult({ ok: true, msg: `✓ Reset to ${resetTarget}` })
      await handleRefresh()
    } catch (err) {
      setResetResult({ ok: false, msg: `✗ ${String(err)}` })
    } finally {
      setResetting(false)
      setResetTarget(null)
    }
  }

  return (
    <div className="border-t border-border">
      <Separator />
      <div className="flex items-center gap-3 px-3 py-2 text-xs">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setExpanded((v) => !v)}
              aria-label="Toggle lag details"
            >
              {expanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>Toggle lag details</TooltipContent>
        </Tooltip>

        <span className="text-muted-foreground shrink-0">Group</span>
        <LagBadge groupId={session.groupId} />
        <span className="text-muted-foreground shrink-0">topic</span>
        <span className="font-mono text-foreground/80 truncate">{session.topic}</span>

        {groupData && (
          <span className={`tabular-nums shrink-0 ${groupData.totalLag > 0 ? 'text-yellow-500' : 'text-green-500'}`}>
            lag: {groupData.totalLag}
          </span>
        )}

        {resetResult && (
          <span className={resetResult.ok ? 'text-green-500 shrink-0' : 'text-destructive shrink-0'}>
            {resetResult.msg}
          </span>
        )}

        <span className="ml-auto text-muted-foreground/60 shrink-0">
          {session.messages.length.toLocaleString()} received
        </span>

        {/* Reset dropdown — keep Button with aria-label, no Tooltip (nested trigger) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 shrink-0"
              disabled={resetting}
              aria-label="Reset consumer group offset"
            >
              {resetting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RotateCcw className="h-3 w-3" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-xs">
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => { setResetResult(null); setResetTarget('earliest') }}
            >
              Reset to Earliest
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => { setResetResult(null); setResetTarget('latest') }}
            >
              Reset to Latest
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <IconButton
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0"
          onClick={handleRefresh}
          disabled={loading}
          tooltip="Refresh lag"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
        </IconButton>
      </div>

      {/* Per-partition lag table */}
      {expanded && groupData && groupData.partitions.length > 0 && (
        <div className="px-3 pb-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="pb-1 text-left font-normal">Partition</th>
                <th className="pb-1 text-right font-normal">Committed</th>
                <th className="pb-1 text-right font-normal">Log End</th>
                <th className="pb-1 text-right font-normal">Lag</th>
              </tr>
            </thead>
            <tbody>
              {groupData.partitions.map((p) => (
                <tr key={p.partition} className="border-t border-border/30">
                  <td className="py-0.5 tabular-nums">{p.partition}</td>
                  <td className="py-0.5 text-right tabular-nums text-muted-foreground">{p.commitOffset}</td>
                  <td className="py-0.5 text-right tabular-nums text-muted-foreground">{p.logEndOffset}</td>
                  <td className={`py-0.5 text-right tabular-nums ${p.lag > 0 ? 'text-yellow-500' : 'text-green-500'}`}>
                    {p.lag}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reset confirmation dialog */}
      <AlertDialog open={resetTarget !== null} onOpenChange={(v) => !v && setResetTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset consumer group offset</AlertDialogTitle>
            <AlertDialogDescription>
              Reset <strong>{session.groupId}</strong> on topic{' '}
              <strong>{session.topic}</strong> to <strong>{resetTarget}</strong>.
              <br />
              The active session will need to be restarted to pick up the new position.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleReset}
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
