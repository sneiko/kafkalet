import { useEffect, useRef } from 'react'
import { Play, Users, Send, Info, Search, MoreHorizontal, Trash2, Star } from 'lucide-react'
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
  pinned?: boolean
  onObserve: (topic: Topic) => void
  onConsume: (topic: Topic) => void
  onProduce: (topic: Topic) => void
  onSearch: (topic: Topic) => void
  onInfo: (topic: Topic) => void
  onDelete?: (topic: Topic) => void
  onTogglePin?: (topic: Topic) => void
}

export function TopicRow({ topic, focused, pinned, onObserve, onConsume, onProduce, onSearch, onInfo, onDelete, onTogglePin }: Props) {
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
      {onTogglePin && (
        <button
          className={cn(
            'shrink-0 p-0.5 rounded transition-colors',
            pinned
              ? 'text-yellow-500 hover:text-yellow-600'
              : 'text-muted-foreground/30 hover:text-yellow-500 opacity-0 group-hover:opacity-100',
          )}
          aria-label={pinned ? 'Unpin topic' : 'Pin topic'}
          onClick={(e) => {
            e.stopPropagation()
            onTogglePin(topic)
          }}
        >
          <Star className={cn('h-3 w-3', pinned && 'fill-current')} />
        </button>
      )}
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
          <DropdownMenuItem onClick={() => onSearch(topic)}>
            <Search className="mr-2 h-3 w-3" />
            Search
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onInfo(topic)}>
            <Info className="mr-2 h-3 w-3" />
            Topic Info
          </DropdownMenuItem>
          {onTogglePin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onTogglePin(topic)}>
                <Star className={cn('mr-2 h-3 w-3', pinned && 'fill-current text-yellow-500')} />
                {pinned ? 'Unpin topic' : 'Pin topic'}
              </DropdownMenuItem>
            </>
          )}
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
