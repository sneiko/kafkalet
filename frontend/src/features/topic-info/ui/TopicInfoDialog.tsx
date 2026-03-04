import { useEffect, useState } from 'react'
import { RefreshCw, Loader2, Pencil, Check, X } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { IconButton } from '@/shared/ui/icon-button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/shared/ui/tooltip'
import { Input } from '@/shared/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/ui/tabs'
import { GetTopicMetadata, ListConsumerGroups, GetTopicConfig, AlterTopicConfig, type broker } from '@shared/api'

interface Props {
  profileId: string
  brokerId: string
  topic: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TopicInfoDialog({ profileId, brokerId, topic, open, onOpenChange }: Props) {
  const [meta, setMeta] = useState<broker.TopicMetadata | null>(null)
  const [groups, setGroups] = useState<broker.GroupLag[]>([])
  const [configs, setConfigs] = useState<broker.TopicConfigEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [m, g, c] = await Promise.all([
        GetTopicMetadata(profileId, brokerId, topic),
        ListConsumerGroups(profileId, brokerId, topic),
        GetTopicConfig(profileId, brokerId, topic),
      ])
      setMeta(m)
      setGroups(g ?? [])
      setConfigs(c ?? [])
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleStartEdit = (key: string, value: string) => {
    setEditingKey(key)
    setEditingValue(value)
  }

  const handleSaveConfig = async (key: string) => {
    setSavingKey(key)
    try {
      await AlterTopicConfig(profileId, brokerId, topic, key, editingValue)
      setConfigs((prev) =>
        prev.map((c) => (c.name === key ? { ...c, value: editingValue, isDefault: false } : c))
      )
      setEditingKey(null)
    } catch (err) {
      setError(String(err))
    } finally {
      setSavingKey(null)
    }
  }

  const handleCancelEdit = () => {
    setEditingKey(null)
    setEditingValue('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>
              <span className="font-mono text-sm">{topic}</span>
            </DialogTitle>
            <IconButton
              variant="ghost"
              size="icon"
              className="ml-auto h-6 w-6"
              onClick={load}
              disabled={loading}
              tooltip="Refresh"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
            </IconButton>
          </div>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Tabs defaultValue="partitions">
          <TabsList className="w-full">
            <TabsTrigger value="partitions" className="flex-1">
              Partitions {meta && <span className="ml-1 text-muted-foreground text-xs">({meta.partitions.length})</span>}
            </TabsTrigger>
            <TabsTrigger value="groups" className="flex-1">
              Groups {groups.length > 0 && <span className="ml-1 text-muted-foreground text-xs">({groups.length})</span>}
            </TabsTrigger>
            <TabsTrigger value="config" className="flex-1">Config</TabsTrigger>
          </TabsList>

          <TabsContent value="partitions">
            {meta && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-1 text-left font-normal">Partition</th>
                    <th className="pb-1 text-left font-normal">Leader</th>
                    <th className="pb-1 text-left font-normal">Replicas</th>
                    <th className="pb-1 text-left font-normal">ISR</th>
                  </tr>
                </thead>
                <tbody>
                  {meta.partitions.map((p) => (
                    <tr key={p.partition} className="border-b border-border/40">
                      <td className="py-1 tabular-nums">{p.partition}</td>
                      <td className="py-1 tabular-nums">{p.leader}</td>
                      <td className="py-1 font-mono text-muted-foreground">{p.replicas.join(', ')}</td>
                      <td className="py-1 font-mono text-muted-foreground">{p.isr.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!loading && !meta && <p className="text-xs text-muted-foreground mt-2">No partition data.</p>}
          </TabsContent>

          <TabsContent value="groups">
            {groups.length > 0 ? (
              groups.map((g) => (
                <div key={g.groupId} className="mb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs">{g.groupId}</span>
                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                      total lag:{' '}
                      <span className={g.totalLag > 0 ? 'text-yellow-500' : 'text-green-500'}>
                        {g.totalLag}
                      </span>
                    </span>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="pb-1 text-left font-normal">Partition</th>
                        <th className="pb-1 text-right font-normal">Committed</th>
                        <th className="pb-1 text-right font-normal">Log End</th>
                        <th className="pb-1 text-right font-normal">Lag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.partitions.map((p) => (
                        <tr key={p.partition} className="border-b border-border/40">
                          <td className="py-1 tabular-nums">{p.partition}</td>
                          <td className="py-1 text-right tabular-nums text-muted-foreground">{p.commitOffset}</td>
                          <td className="py-1 text-right tabular-nums text-muted-foreground">{p.logEndOffset}</td>
                          <td className={`py-1 text-right tabular-nums ${p.lag > 0 ? 'text-yellow-500' : 'text-green-500'}`}>
                            {p.lag}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">No consumer groups found for this topic.</p>
            )}
          </TabsContent>

          <TabsContent value="config">
            {configs.length > 0 ? (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-1 text-left font-normal w-1/2">Name</th>
                    <th className="pb-1 text-left font-normal">Value</th>
                    <th className="pb-1 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {configs.map((cfg) => (
                    <tr key={cfg.name} className="border-b border-border/40">
                      <td className="py-1 font-mono text-muted-foreground">{cfg.name}</td>
                      <td className="py-1">
                        {editingKey === cfg.name ? (
                          <Input
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            className="h-6 text-xs py-0 px-1"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveConfig(cfg.name)
                              if (e.key === 'Escape') handleCancelEdit()
                            }}
                          />
                        ) : (
                          <span className={cfg.isDefault ? 'text-muted-foreground/60' : ''}>
                            {cfg.value}
                          </span>
                        )}
                      </td>
                      <td className="py-1">
                        {editingKey === cfg.name ? (
                          <div className="flex gap-0.5 justify-end">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => handleSaveConfig(cfg.name)}
                                  disabled={savingKey === cfg.name}
                                  className="p-0.5 rounded hover:bg-accent/60 text-green-500"
                                  aria-label="Save"
                                >
                                  {savingKey === cfg.name ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Check className="h-3 w-3" />
                                  )}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Save</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={handleCancelEdit}
                                  className="p-0.5 rounded hover:bg-accent/60 text-muted-foreground"
                                  aria-label="Cancel"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Cancel</TooltipContent>
                            </Tooltip>
                          </div>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => handleStartEdit(cfg.name, cfg.value)}
                                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent/60 text-muted-foreground"
                                aria-label="Edit"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">No config entries loaded.</p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
