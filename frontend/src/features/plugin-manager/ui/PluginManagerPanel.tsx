import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'

import { Button } from '@/shared/ui/button'
import { ListPlugins, DeletePlugin } from '@shared/api'
import { usePluginStore } from '@entities/plugin'
import type { Plugin } from '@entities/plugin'
import { PluginEditorDialog } from './PluginEditorDialog'

export function PluginManagerPanel() {
  const { plugins, setPlugins, removePlugin } = usePluginStore()
  const [editPlugin, setEditPlugin] = useState<Plugin | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)

  useEffect(() => {
    ListPlugins().then(setPlugins).catch(console.error)
  }, [])

  const handleDelete = async (plugin: Plugin) => {
    if (!confirm(`Delete plugin "${plugin.name}"?`)) return
    await DeletePlugin(plugin.id)
    removePlugin(plugin.id)
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
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleEdit(plugin)}
                title="Edit plugin"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => handleDelete(plugin)}
                title="Delete plugin"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
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
    </div>
  )
}
