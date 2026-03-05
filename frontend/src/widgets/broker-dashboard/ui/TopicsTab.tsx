import { useState, useEffect, useCallback, useMemo } from 'react'
import { RefreshCw, Loader2, Plus, ChevronRight, ChevronDown, FolderOpen, Search, Star } from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { IconButton } from '@/shared/ui/icon-button'
import { Input } from '@/shared/ui/input'
import { Checkbox } from '@/shared/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
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
import { TopicRow, type Topic } from '@entities/topic'
import { useProfileStore, type TopicGroup } from '@entities/profile'
import { ObserveDialog } from '@features/topic-observe'
import { ConsumeDialog } from '@features/topic-consume'
import { ProduceDialog } from '@features/message-produce'
import { TopicInfoDialog } from '@features/topic-info'
import { CreateTopicDialog } from '@features/topic-create'
import { SearchDialog } from '@features/topic-search'
import { ListTopics, DeleteTopic, SaveTopicGroup, DeleteTopicGroup, ListProfiles, InvalidateTopicsCache, PinTopic, UnpinTopic } from '@shared/api'

interface TopicTarget {
  profileId: string
  brokerId: string
  brokerName: string
  topic: string
}

interface Props {
  profileId: string
  brokerId: string
  brokerName: string
}

export function TopicsTab({ profileId, brokerId, brokerName }: Props) {
  const { profiles } = useProfileStore()
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [regexEnabled, setRegexEnabled] = useState(false)
  const [minPartitions, setMinPartitions] = useState('')

  const [observeTarget, setObserveTarget] = useState<TopicTarget | null>(null)
  const [consumeTarget, setConsumeTarget] = useState<TopicTarget | null>(null)
  const [produceTarget, setProduceTarget] = useState<TopicTarget | null>(null)
  const [infoTarget, setInfoTarget] = useState<TopicTarget | null>(null)
  const [searchTarget, setSearchTarget] = useState<TopicTarget | null>(null)
  const [deleteTopicTarget, setDeleteTopicTarget] = useState<TopicTarget | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const [newGroupOpen, setNewGroupOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [focusedTopicIndex, setFocusedTopicIndex] = useState(-1)

  const profile = profiles.find((p) => p.id === profileId)
  const broker = profile?.brokers.find((b) => b.id === brokerId)
  const topicGroups = broker?.topicGroups ?? []
  const pinnedTopics = broker?.pinnedTopics ?? []

  const load = useCallback(async (force?: boolean) => {
    setLoading(true)
    try {
      if (force) await InvalidateTopicsCache(brokerId)
      const result = await ListTopics(profileId, brokerId)
      setTopics(result ?? [])
    } catch (err) {
      setTopics([])
      toast.error('Failed to load topics', { description: String(err) })
    } finally {
      setLoading(false)
    }
  }, [profileId, brokerId])

  useEffect(() => {
    load()
  }, [load])

  // Regex validation
  const regexError = useMemo(() => {
    if (!regexEnabled || !search) return false
    try {
      new RegExp(search)
      return false
    } catch {
      return true
    }
  }, [search, regexEnabled])

  const filtered = useMemo(() => {
    let result = topics

    // Text / regex filter
    if (search && !regexError) {
      if (regexEnabled) {
        try {
          const re = new RegExp(search, 'i')
          result = result.filter((t) => re.test(t.name))
        } catch {
          // fallback — no filter on invalid regex
        }
      } else {
        const q = search.toLowerCase()
        result = result.filter((t) => t.name.toLowerCase().includes(q))
      }
    }

    // Partition count filter
    const minP = parseInt(minPartitions, 10)
    if (minP > 0) {
      result = result.filter((t) => t.partitions >= minP)
    }

    return result
  }, [topics, search, regexEnabled, regexError, minPartitions])

  const makeTarget = (topic: Topic): TopicTarget => ({
    profileId,
    brokerId,
    brokerName,
    topic: topic.name,
  })

  const groupedTopicNames = new Set(topicGroups.flatMap((g) => g.topics))
  const pinnedSet = new Set(pinnedTopics)
  const pinnedFiltered = filtered.filter((t) => pinnedSet.has(t.name))
  const ungrouped = filtered.filter((t) => !groupedTopicNames.has(t.name) && !pinnedSet.has(t.name))
  const mainList = topicGroups.length > 0 || pinnedFiltered.length > 0 ? ungrouped : filtered.filter((t) => !pinnedSet.has(t.name))

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return
    try {
      const g: TopicGroup = { id: '', name: newGroupName.trim(), topics: [] }
      await SaveTopicGroup(profileId, brokerId, g as any)
      refreshProfile()
      setNewGroupName('')
      setNewGroupOpen(false)
    } catch (err) {
      toast.error('Failed to create group', { description: String(err) })
    }
  }

  const handleDeleteGroup = async (groupId: string) => {
    try {
      await DeleteTopicGroup(profileId, brokerId, groupId)
      refreshProfile()
    } catch (err) {
      toast.error('Failed to delete group', { description: String(err) })
    }
  }

  const handleAssignToGroup = async (groupId: string, topicName: string) => {
    const group = topicGroups.find((g) => g.id === groupId)
    if (!group) return
    try {
      const updated: TopicGroup = { ...group, topics: [...group.topics, topicName] }
      await SaveTopicGroup(profileId, brokerId, updated as any)
      refreshProfile()
    } catch (err) {
      toast.error('Failed to assign topic to group', { description: String(err) })
    }
  }

  const handleRemoveFromGroup = async (groupId: string, topicName: string) => {
    const group = topicGroups.find((g) => g.id === groupId)
    if (!group) return
    try {
      const updated: TopicGroup = { ...group, topics: group.topics.filter((t) => t !== topicName) }
      await SaveTopicGroup(profileId, brokerId, updated as any)
      refreshProfile()
    } catch (err) {
      toast.error('Failed to remove topic from group', { description: String(err) })
    }
  }

  const handleTogglePin = async (topic: Topic) => {
    try {
      if (pinnedSet.has(topic.name)) {
        await UnpinTopic(profileId, brokerId, topic.name)
      } else {
        await PinTopic(profileId, brokerId, topic.name)
      }
      await refreshProfile()
    } catch (err) {
      toast.error('Failed to update pin', { description: String(err) })
    }
  }

  const refreshProfile = async () => {
    const all = await ListProfiles()
    useProfileStore.getState().setProfiles(all ?? [])
  }

  const handleTopicDeleted = async () => {
    setDeleteTopicTarget(null)
    await load()
  }

  const handleTopicCreated = async () => {
    setCreateOpen(false)
    await load()
  }

  // Build flat list of visible topics for keyboard nav
  const flatTopics: Topic[] = [...pinnedFiltered]
  for (const group of topicGroups) {
    if (!collapsedGroups.has(group.id)) {
      flatTopics.push(...filtered.filter((t) => group.topics.includes(t.name) && !pinnedSet.has(t.name)))
    }
  }
  flatTopics.push(...mainList)

  const handleTopicListKeyDown = (e: React.KeyboardEvent) => {
    if (flatTopics.length === 0) return
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setFocusedTopicIndex((i) => (i < flatTopics.length - 1 ? i + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedTopicIndex((i) => (i > 0 ? i - 1 : flatTopics.length - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (focusedTopicIndex >= 0 && focusedTopicIndex < flatTopics.length) {
          setObserveTarget(makeTarget(flatTopics[focusedTopicIndex]))
        }
        break
    }
  }

  const renderTopicRow = (topic: Topic, groupId?: string) => {
    const flatIdx = flatTopics.indexOf(topic)
    return (
      <div key={topic.name} className="group/topic flex items-center">
        <div className="flex-1 min-w-0">
          <TopicRow
            topic={topic}
            focused={focusedTopicIndex === flatIdx}
            pinned={pinnedSet.has(topic.name)}
            onObserve={() => setObserveTarget(makeTarget(topic))}
            onConsume={() => setConsumeTarget(makeTarget(topic))}
            onProduce={() => setProduceTarget(makeTarget(topic))}
            onSearch={() => setSearchTarget(makeTarget(topic))}
            onInfo={() => setInfoTarget(makeTarget(topic))}
            onDelete={() => setDeleteTopicTarget(makeTarget(topic))}
            onTogglePin={() => handleTogglePin(topic)}
          />
        </div>
        {topicGroups.length > 0 && !groupId && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="shrink-0 p-0.5 rounded text-muted-foreground opacity-0 group-hover/topic:opacity-100 transition-opacity hover:bg-accent/60"
                aria-label="Add to group"
                onClick={(e) => e.stopPropagation()}
              >
                <FolderOpen className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs">
              {topicGroups.map((g) => (
                <DropdownMenuItem
                  key={g.id}
                  onClick={() => handleAssignToGroup(g.id, topic.name)}
                >
                  {g.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {groupId && (
          <button
            className="shrink-0 p-0.5 rounded text-muted-foreground opacity-0 group-hover/topic:opacity-100 transition-opacity hover:bg-accent/60 text-[10px]"
            aria-label="Remove from group"
            onClick={() => handleRemoveFromGroup(groupId, topic.name)}
          >
            &times;
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 shrink-0">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={regexEnabled ? 'Regex pattern...' : 'Search topics...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn('h-7 pl-7 text-xs', regexError && 'border-destructive focus-visible:ring-destructive')}
          />
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
          <Checkbox
            checked={regexEnabled}
            onCheckedChange={(v) => setRegexEnabled(v === true)}
            className="h-3.5 w-3.5"
          />
          Regex
        </label>
        <Input
          placeholder="Min partitions"
          type="number"
          min={0}
          value={minPartitions}
          onChange={(e) => setMinPartitions(e.target.value)}
          className="h-7 w-28 text-xs"
        />
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => setNewGroupOpen(true)}
        >
          <FolderOpen className="h-3 w-3" />
          Group
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-3 w-3" />
          Topic
        </Button>
        <IconButton
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => load(true)}
          disabled={loading}
          tooltip="Refresh topics"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </IconButton>
      </div>

      {/* Topic list */}
      <div
        className="flex-1 overflow-y-auto px-2 pb-2 min-h-0"
        role="listbox"
        tabIndex={0}
        onKeyDown={handleTopicListKeyDown}
        onBlur={() => setFocusedTopicIndex(-1)}
      >
        {loading && topics.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading topics...
          </div>
        ) : topics.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-xs text-muted-foreground gap-2">
            <p>No topics found.</p>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setCreateOpen(true)}>
              Create topic
            </Button>
          </div>
        ) : (
          <>
            {/* Pinned topics */}
            {pinnedFiltered.length > 0 && (
              <div className="mb-1">
                <div className="flex items-center gap-1 px-1 py-1">
                  <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                  <span className="text-xs font-medium text-foreground/80">Pinned</span>
                  <span className="text-[10px] text-muted-foreground ml-1">({pinnedFiltered.length})</span>
                </div>
                <div className="ml-4">
                  {pinnedFiltered.map((t) => renderTopicRow(t))}
                </div>
              </div>
            )}

            {/* Named groups */}
            {topicGroups.map((group) => {
              const groupTopics = filtered.filter((t) => group.topics.includes(t.name) && !pinnedSet.has(t.name))
              const isCollapsed = collapsedGroups.has(group.id)

              return (
                <div key={group.id} className="mb-1">
                  <div className="flex items-center gap-1 px-1 py-1">
                    <button
                      onClick={() => toggleGroupCollapse(group.id)}
                      className="p-0.5 rounded hover:bg-accent/60 text-muted-foreground"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </button>
                    <FolderOpen className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground/80">{group.name}</span>
                    <span className="text-[10px] text-muted-foreground ml-1">({groupTopics.length})</span>
                    <button
                      onClick={() => handleDeleteGroup(group.id)}
                      className="ml-auto p-0.5 rounded text-muted-foreground/50 hover:text-destructive text-[10px] transition-colors"
                      aria-label="Delete group"
                    >
                      &times;
                    </button>
                  </div>
                  {!isCollapsed && (
                    <div className="ml-4">
                      {groupTopics.length === 0 ? (
                        <p className="px-2 py-1 text-[10px] text-muted-foreground/60">No topics in group</p>
                      ) : (
                        groupTopics.map((t) => renderTopicRow(t, group.id))
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Ungrouped */}
            {(topicGroups.length > 0 || pinnedFiltered.length > 0) && mainList.length > 0 && (
              <div className="mb-1">
                <div className="flex items-center gap-1 px-1 py-1">
                  <span className="text-xs font-medium text-muted-foreground">Ungrouped</span>
                  <span className="text-[10px] text-muted-foreground ml-1">({mainList.length})</span>
                </div>
              </div>
            )}
            {mainList.map((t) => renderTopicRow(t))}

            {filtered.length === 0 && search && (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                {regexError ? 'Invalid regex pattern' : `No topics match "${search}"`}
              </p>
            )}
          </>
        )}
      </div>

      {/* Dialogs */}
      {observeTarget && (
        <ObserveDialog
          {...observeTarget}
          open={Boolean(observeTarget)}
          onOpenChange={(v) => !v && setObserveTarget(null)}
        />
      )}

      {consumeTarget && (
        <ConsumeDialog
          {...consumeTarget}
          open={Boolean(consumeTarget)}
          onOpenChange={(v) => !v && setConsumeTarget(null)}
        />
      )}

      {produceTarget && (
        <ProduceDialog
          {...produceTarget}
          open={Boolean(produceTarget)}
          onOpenChange={(v) => !v && setProduceTarget(null)}
        />
      )}

      {searchTarget && (
        <SearchDialog
          {...searchTarget}
          open={Boolean(searchTarget)}
          onOpenChange={(v) => !v && setSearchTarget(null)}
        />
      )}

      {infoTarget && (
        <TopicInfoDialog
          {...infoTarget}
          open={Boolean(infoTarget)}
          onOpenChange={(v) => !v && setInfoTarget(null)}
        />
      )}

      <CreateTopicDialog
        profileId={profileId}
        brokerId={brokerId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleTopicCreated}
      />

      {deleteTopicTarget && (
        <AlertDialog open onOpenChange={(v) => !v && setDeleteTopicTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Topic</AlertDialogTitle>
              <AlertDialogDescription>
                Delete topic <span className="font-mono">{deleteTopicTarget.topic}</span>? All data will be permanently lost.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async () => {
                  await DeleteTopic(deleteTopicTarget.profileId, deleteTopicTarget.brokerId, deleteTopicTarget.topic)
                  handleTopicDeleted()
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* New group dialog */}
      <Dialog open={newGroupOpen} onOpenChange={setNewGroupOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Topic Group</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Group name"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewGroupOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateGroup} disabled={!newGroupName.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
