import { Users } from 'lucide-react'
import { Badge } from '@/shared/ui/badge'

interface Props {
  groupId: string
}

export function LagBadge({ groupId }: Props) {
  return (
    <Badge variant="secondary" className="gap-1 font-mono text-xs">
      <Users className="h-3 w-3" />
      {groupId}
    </Badge>
  )
}
