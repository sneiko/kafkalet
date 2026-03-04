import { useEffect, useRef } from 'react'
import { Play, Users, Send, Info, MoreHorizontal, Trash2 } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import type { Topic } from '../model/types'

interface Props {
  topic: Topic
  focused?: boolean
  onObserve: (topic: Topic) => void
  onConsume: (topic: Topic) => void
  onProduce: (topic: Topic) => void
  onInfo: (topic: Topic) => void
  onDelete?: (topic: Topic) => void
}

export function TopicRow({ topic, focused, onObserve, onConsume, onProduce, onInfo, onDelete }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (focused && ref.current) {
      ref.current.scrollIntoView({ block: 'nearest' })
    }
  }, [focused])

  return (
    <div
      ref={ref}
      role="option"
      aria-selected={focused}
      tabIndex={-1}
      className={cn(
        'group flex items-center gap-1 rounded px-2 py-1 text-xs',
        'hover:bg-accent/60 transition-colors cursor-pointer',
        focused && 'ring-2 ring-ring',
      )}
      onClick={() => onObserve(topic)}
    >
      <span className="flex-1 truncate text-foreground/90">{topic.name}</span>
      <span className="text-muted-foreground/60 shrink-0 tabular-nums">
        {topic.partitions}p
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="ml-1 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/20 hover:text-primary"
            aria-label="Topic actions"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="text-xs">
          <DropdownMenuItem onClick={() => onObserve(topic)}>
            <Play className="mr-2 h-3 w-3" />
            Observe
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onConsume(topic)}>
            <Users className="mr-2 h-3 w-3" />
            Consume
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onProduce(topic)}>
            <Send className="mr-2 h-3 w-3" />
            Produce
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onInfo(topic)}>
            <Info className="mr-2 h-3 w-3" />
            Topic Info
          </DropdownMenuItem>
          {onDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(topic)}
              >
                <Trash2 className="mr-2 h-3 w-3" />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
