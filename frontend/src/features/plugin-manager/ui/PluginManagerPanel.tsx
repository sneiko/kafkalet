import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/shared/ui/button'
import { IconButton } from '@/shared/ui/icon-button'
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
import { ListPlugins, DeletePlugin } from '@shared/api'
import { usePluginStore } from '@entities/plugin'
import type { Plugin } from '@entities/plugin'
import { PluginEditorDialog } from './PluginEditorDialog'

export function PluginManagerPanel() {
  const { plugins, setPlugins, removePlugin } = usePluginStore()
  const [editPlugin, setEditPlugin] = useState<Plugin | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [deletePlugin, setDeletePlugin] = useState<Plugin | null>(null)

  useEffect(() => {
    ListPlugins()
      .then(setPlugins)
      .catch((err) => toast.error('Failed to load plugins', { description: String(err) }))
  }, [])

  const handleConfirmDelete = async () => {
    if (!deletePlugin) return
    try {
      await DeletePlugin(deletePlugin.id)
      removePlugin(deletePlugin.id)
    } catch (err) {
      toast.error('Failed to delete plugin', { description: String(err) })
    }
    setDeletePlugin(null)
  }

  const handleEdit = (plugin: Plugin) => {
    setEditPlugin(plugin)
    setEditorOpen(true)
  }

  const handleAdd = () => {
    setEditPlugin(null)
    setEditorOpen(true)
  }

  return (
    <div className="space-y-2">
      {plugins.length === 0 ? (
        <p className="text-xs text-muted-foreground">No plugins yet.</p>
      ) : (
        plugins.map((plugin) => (
          <div
            key={plugin.id}
            className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent/50"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{plugin.name}</p>
              <p className="text-xs text-muted-foreground font-mono truncate">
                topic: {plugin.topicPattern}
              </p>
            </div>
            <div className="flex gap-1 shrink-0">
              <IconButton
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleEdit(plugin)}
                tooltip="Edit plugin"
              >
                <Pencil className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => setDeletePlugin(plugin)}
                tooltip="Delete plugin"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </IconButton>
            </div>
          </div>
        ))
      )}

      <Button variant="outline" size="sm" className="h-7 w-full text-xs" onClick={handleAdd}>
        <Plus className="h-3.5 w-3.5" />
        Add Plugin
      </Button>

      <PluginEditorDialog
        plugin={editPlugin}
        open={editorOpen}
        onOpenChange={setEditorOpen}
      />

      <AlertDialog open={Boolean(deletePlugin)} onOpenChange={(v) => !v && setDeletePlugin(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Plugin</AlertDialogTitle>
            <AlertDialogDescription>
              Delete plugin "{deletePlugin?.name}"? This cannot be undone.
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
