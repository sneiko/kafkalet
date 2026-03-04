import { Badge } from '@/shared/ui/badge'
import type { Profile } from '../model/types'

interface Props {
  profile: Profile
  active?: boolean
}

export function ProfileBadge({ profile, active }: Props) {
  return (
    <Badge variant={active ? 'default' : 'secondary'} className="text-xs">
      {profile.name}
    </Badge>
  )
}
