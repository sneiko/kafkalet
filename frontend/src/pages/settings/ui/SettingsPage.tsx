import { useEffect, useRef, useState } from 'react'
import { Plus, Pencil, Trash2, ChevronLeft, Download, Upload, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/shared/ui/button'
import { IconButton } from '@/shared/ui/icon-button'
import { Input } from '@/shared/ui/input'
import { Separator } from '@/shared/ui/separator'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/card'
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

import {
  CreateProfile,
  DeleteProfile,
  SwitchProfile,
  DeleteBroker,
  RenameProfile,
  ExportSettings,
  ImportSettings,
} from '@shared/api'
import { useProfileStore, type Profile, type Broker } from '@entities/profile'
import { BrokerFormDialog } from '@features/broker-connect'
import { PluginManagerPanel } from '@features/plugin-manager'

interface DeleteTarget {
  type: 'profile' | 'broker'
  profileId: string
  brokerId?: string
  name: string
}

interface Props {
  onBack: () => void
}

export function SettingsPage({ onBack }: Props) {
  const { profiles, activeProfileId, upsertProfile, removeProfile, setActiveProfileId } =
    useProfileStore()

  const [newProfileName, setNewProfileName] = useState('')
  const [editBroker, setEditBroker] = useState<{ profileId: string; broker: Broker } | null>(null)
  const [addBrokerProfileId, setAddBrokerProfileId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [showExportWarning, setShowExportWarning] = useState(false)
  const [includeSecrets, setIncludeSecrets] = useState(false)
  const [importing, setImporting] = useState(false)
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingProfileId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingProfileId])

  const handleCreateProfile = async () => {
    const name = newProfileName.trim()
    if (!name) return
    try {
      const created = await CreateProfile(name)
      upsertProfile(created as unknown as Profile)
      setNewProfileName('')
      if (!activeProfileId) {
        setActiveProfileId(created.id)
      }
    } catch (err) {
      toast.error('Failed to create profile', { description: String(err) })
    }
  }

  const handleDeleteProfile = async (id: string) => {
    await DeleteProfile(id)
    removeProfile(id)
    if (activeProfileId === id && profiles.length > 1) {
      const next = profiles.find((p) => p.id !== id)
      if (next) {
        await SwitchProfile(next.id)
        setActiveProfileId(next.id)
      }
    }
  }

  const handleDeleteBroker = async (profileId: string, brokerId: string) => {
    await DeleteBroker(profileId, brokerId)
    const profile = profiles.find((p) => p.id === profileId)
    if (profile) {
      upsertProfile({ ...profile, brokers: profile.brokers.filter((b) => b.id !== brokerId) })
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    try {
      if (deleteTarget.type === 'profile') {
        await handleDeleteProfile(deleteTarget.profileId)
      } else if (deleteTarget.brokerId) {
        await handleDeleteBroker(deleteTarget.profileId, deleteTarget.brokerId)
      }
    } catch (err) {
      toast.error(`Failed to delete ${deleteTarget.type}`, { description: String(err) })
    }
    setDeleteTarget(null)
  }

  const handleSwitchProfile = async (id: string) => {
    await SwitchProfile(id)
    setActiveProfileId(id)
  }

  const handleStartRename = (profile: Profile) => {
    setEditingProfileId(profile.id)
    setEditingName(profile.name)
  }

  const handleCommitRename = async () => {
    if (!editingProfileId) return
    const name = editingName.trim()
    if (name) {
      try {
        await RenameProfile(editingProfileId, name)
        const p = profiles.find((pr) => pr.id === editingProfileId)
        if (p) upsertProfile({ ...p, name })
      } catch (err) {
        toast.error('Failed to rename profile', { description: String(err) })
      }
    }
    setEditingProfileId(null)
  }

  const handleCancelRename = () => {
    setEditingProfileId(null)
  }

  const doExport = async () => {
    setShowExportWarning(false)
    try {
      await ExportSettings(includeSecrets)
      toast.success('Settings exported')
    } catch (err) {
      toast.error('Export failed', { description: String(err) })
    }
  }

  const handleImport = async () => {
    setImporting(true)
    try {
      await ImportSettings()
      toast.success('Settings imported')
    } catch (err) {
      toast.error('Import failed', { description: String(err) })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <IconButton variant="ghost" size="icon" className="h-7 w-7" onClick={onBack} tooltip="Back">
          <ChevronLeft className="h-4 w-4" />
        </IconButton>
        <h1 className="text-sm font-semibold flex-1">Settings</h1>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleImport} disabled={importing}>
          {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Import Settings
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowExportWarning(true)}>
          <Download className="h-3.5 w-3.5" />
          Export Settings
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Create profile */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">New Profile</CardTitle>
            <CardDescription className="text-xs">
              A profile groups broker connections for an environment (prod, staging, dev).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Profile name"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateProfile()}
                className="h-8 text-sm"
              />
              <Button size="sm" onClick={handleCreateProfile} disabled={!newProfileName.trim()}>
                <Plus className="h-3.5 w-3.5" />
                Create
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Profiles list */}
        {profiles.map((profile) => (
          <Card key={profile.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {editingProfileId === profile.id ? (
                    <Input
                      ref={editInputRef}
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={handleCommitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCommitRename()
                        if (e.key === 'Escape') handleCancelRename()
                      }}
                      className="h-7 text-sm font-semibold max-w-48"
                    />
                  ) : (
                    <CardTitle
                      className="text-sm cursor-pointer hover:underline"
                      onClick={() => handleStartRename(profile)}
                      title="Click to rename"
                    >
                      {profile.name}
                    </CardTitle>
                  )}
                  {profile.id === activeProfileId && (
                    <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs text-primary shrink-0">
                      active
                    </span>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  {profile.id !== activeProfileId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleSwitchProfile(profile.id)}
                    >
                      Switch
                    </Button>
                  )}
                  <IconButton
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() =>
                      setDeleteTarget({ type: 'profile', profileId: profile.id, name: profile.name })
                    }
                    tooltip="Delete profile"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconButton>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-1">
              <Separator className="mb-2" />

              {profile.brokers.length === 0 ? (
                <p className="text-xs text-muted-foreground">No brokers in this profile.</p>
              ) : (
                profile.brokers.map((broker) => (
                  <div
                    key={broker.id}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent/50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{broker.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {broker.addresses.join(', ')}
                        {broker.sasl.mechanism && (
                          <span className="ml-2 text-muted-foreground/60">
                            {broker.sasl.mechanism}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <IconButton
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setEditBroker({ profileId: profile.id, broker })}
                        tooltip="Edit broker"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </IconButton>
                      <IconButton
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() =>
                          setDeleteTarget({
                            type: 'broker',
                            profileId: profile.id,
                            brokerId: broker.id,
                            name: broker.name,
                          })
                        }
                        tooltip="Delete broker"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconButton>
                    </div>
                  </div>
                ))
              )}

              <Button
                variant="outline"
                size="sm"
                className="mt-2 h-7 w-full text-xs"
                onClick={() => setAddBrokerProfileId(profile.id)}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Broker
              </Button>
            </CardContent>
          </Card>
        ))}
        {/* Plugins */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Message Decoder Plugins</CardTitle>
            <CardDescription className="text-xs">
              JavaScript plugins to decode raw message values. Each plugin matches topics by regex
              and runs a decode function on every message.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PluginManagerPanel />
          </CardContent>
        </Card>
      </div>

      {/* Add broker dialog */}
      <BrokerFormDialog
        profileId={addBrokerProfileId ?? ''}
        open={Boolean(addBrokerProfileId)}
        onOpenChange={(v) => !v && setAddBrokerProfileId(null)}
      />

      {/* Edit broker dialog */}
      <BrokerFormDialog
        profileId={editBroker?.profileId ?? ''}
        broker={editBroker?.broker}
        open={Boolean(editBroker)}
        onOpenChange={(v) => !v && setEditBroker(null)}
      />

      {/* Export warning dialog */}
      <AlertDialog open={showExportWarning} onOpenChange={(v) => { setShowExportWarning(v); if (!v) setIncludeSecrets(false) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Export Settings</AlertDialogTitle>
            <AlertDialogDescription>
              {includeSecrets
                ? 'The exported file will contain your broker passwords in plaintext. Store it securely and do not share it.'
                : 'Passwords will not be included. Safe to share with your team.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex items-center gap-2 px-6 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeSecrets}
              onChange={(e) => setIncludeSecrets(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span className="text-sm">Include passwords</span>
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doExport}>Export</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTarget?.type === 'profile' ? 'Profile' : 'Broker'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === 'profile'
                ? `Delete profile "${deleteTarget.name}" and all its brokers? This cannot be undone.`
                : `Delete broker "${deleteTarget?.name}"? This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
