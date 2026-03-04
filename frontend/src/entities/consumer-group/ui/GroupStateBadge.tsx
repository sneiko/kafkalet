import { cn } from '@shared/lib/utils'

interface Props {
  state: string
  className?: string
}

const stateStyles: Record<string, string> = {
  Stable: 'bg-green-500/15 text-green-600 dark:text-green-400',
  Empty: 'bg-muted text-muted-foreground',
  PreparingRebalance: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
  CompletingRebalance: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
  Dead: 'bg-destructive/15 text-destructive',
}

export function GroupStateBadge({ state, className }: Props) {
  const style = stateStyles[state] ?? 'bg-muted text-muted-foreground'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium',
        style,
        className,
      )}
    >
      {state || '—'}
    </span>
  )
}
