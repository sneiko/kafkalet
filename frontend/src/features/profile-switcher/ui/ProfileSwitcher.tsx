import { useEffect, useState } from 'react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { ListProfiles, GetActiveProfile, SwitchProfile, EventsOn } from '@shared/api'
import { useProfileStore } from '@entities/profile'

export function ProfileSwitcher() {
  const { profiles, activeProfileId, setProfiles, setActiveProfileId } = useProfileStore()
  const [open, setOpen] = useState(false)

  // Load on mount
  useEffect(() => {
    const load = async () => {
      const [all, active] = await Promise.all([ListProfiles(), GetActiveProfile()])
      setProfiles(all ?? [])
      if (active?.id) {
        setActiveProfileId(active.id)
      } else if (all && all.length > 0) {
        try {
          await SwitchProfile(all[0].id)
          setActiveProfileId(all[0].id)
        } catch {
          // auto-select failed; user can pick manually
        }
      }
    }
    load()
  }, [])

  // Keep in sync with backend events (hot profile swap from elsewhere)
  useEffect(() => {
    return EventsOn('profile:switched', (id: string) => {
      setActiveProfileId(id)
    })
  }, [])

  // Cmd/Ctrl+K → open profile switcher
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleChange = async (id: string) => {
    await SwitchProfile(id)
    setActiveProfileId(id)
    setOpen(false)
  }

  if (profiles.length === 0) return null

  return (
    <Select open={open} onOpenChange={setOpen} value={activeProfileId ?? ''} onValueChange={handleChange}>
      <SelectTrigger className="h-7 w-44 gap-1 border-0 bg-transparent px-2 text-sm focus:ring-0" title="Switch profile (⌘K)">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {profiles.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
