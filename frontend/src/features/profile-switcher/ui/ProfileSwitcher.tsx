import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/ui/popover'
import { Input } from '@/shared/ui/input'
import { Button } from '@/shared/ui/button'
import { ListProfiles, GetActiveProfile, SwitchProfile, CreateProfile, EventsOn } from '@shared/api'
import { useProfileStore } from '@entities/profile'

export function ProfileSwitcher() {
  const { profiles, activeProfileId, setProfiles, setActiveProfileId, upsertProfile } = useProfileStore()
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [newName, setNewName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

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
        } catch (err) {
          toast.error('Failed to switch profile', { description: String(err) })
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

  const handleSelect = async (id: string) => {
    setSwitching(true)
    try {
      await SwitchProfile(id)
      setActiveProfileId(id)
      setOpen(false)
    } catch (err) {
      toast.error('Failed to switch profile', { description: String(err) })
    } finally {
      setSwitching(false)
    }
  }

  const handleCreate = async () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    try {
      const created = await CreateProfile(trimmed)
      upsertProfile(created as any)
      await SwitchProfile(created.id)
      setActiveProfileId(created.id)
      setNewName('')
      setCreating(false)
      setOpen(false)
    } catch (err) {
      toast.error('Failed to create profile', { description: String(err) })
    }
  }

  const handleCreateKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleCreate()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setCreating(false)
      setNewName('')
    }
  }

  const startCreating = () => {
    setCreating(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const activeProfile = profiles.find((p) => p.id === activeProfileId)

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setCreating(false); setNewName('') } }}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="h-7 w-44 justify-between gap-1 px-2 text-sm"
          aria-label="Switch profile (⌘K)"
        >
          <span className="truncate">{activeProfile?.name ?? 'Select profile'}</span>
          {switching ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1" align="start">
        {profiles.map((p) => (
          <button
            key={p.id}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
            onClick={() => handleSelect(p.id)}
          >
            <Check className={`h-3.5 w-3.5 shrink-0 ${p.id === activeProfileId ? 'opacity-100' : 'opacity-0'}`} />
            <span className="truncate">{p.name}</span>
          </button>
        ))}

        {profiles.length > 0 && <div className="my-1 h-px bg-border" />}

        {creating ? (
          <div className="px-2 py-1">
            <Input
              ref={inputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleCreateKeyDown}
              onBlur={() => { if (!newName.trim()) { setCreating(false); setNewName('') } }}
              placeholder="Profile name"
              className="h-7 text-sm"
              autoFocus
            />
          </div>
        ) : (
          <button
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
            onClick={startCreating}
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span>New Profile</span>
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}
