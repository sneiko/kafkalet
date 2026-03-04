import { useState, useRef, useEffect } from 'react'
import { ChevronRight, ChevronDown, ChevronLeft, Plus, Loader2, Server, Users, UserCog } from 'lucide-react'

import { Button } from '@/shared/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { BrokerCard } from '@entities/broker'
import { useProfileStore, type Broker } from '@entities/profile'
import { TopicRow, type Topic } from '@entities/topic'
import { BrokerFormDialog } from '@features/broker-connect'
import { ObserveDialog } from '@features/topic-observe'
import { ConsumeDialog } from '@features/topic-consume'
import { ProduceDialog } from '@features/message-produce'
import { TopicInfoDialog } from '@features/topic-info'
import { ClusterInfoDialog } from '@features/cluster-info'
import { ConsumerGroupsDialog } from '@features/consumer-groups'
import { ListTopics, SwitchBrokerCredential, DeleteTopic } from '@shared/api'
import { CreateTopicDialog } from '@features/topic-create'
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

interface TopicTarget {
  profileId: string
  brokerId: string
  brokerName: string
  topic: string
}

interface Props {
  onBrokerSelect?: (broker: { profileId: string; brokerId: string; brokerName: string } | null) => void
}

export function Sidebar({ onBrokerSelect }: Props) {
  const { profiles, activeProfileId, upsertProfile } = useProfileStore()

  const [addOpen, setAddOpen] = useState(false)
  const [expandedBrokerId, setExpandedBrokerId] = useState<string | null>(null)
  const [topicsCache, setTopicsCache] = useState<Record<string, Topic[]>>({})
  const [loadingBrokerId, setLoadingBrokerId] = useState<string | null>(null)
  const [observeTarget, setObserveTarget] = useState<TopicTarget | null>(null)
  const [consumeTarget, setConsumeTarget] = useState<TopicTarget | null>(null)
  const [produceTarget, setProduceTarget] = useState<TopicTarget | null>(null)
  const [infoTarget, setInfoTarget] = useState<TopicTarget | null>(null)
  const [clusterBroker, setClusterBroker] = useState<Broker | null>(null)
  const [groupsBroker, setGroupsBroker] = useState<Broker | null>(null)
  const [createTopicBroker, setCreateTopicBroker] = useState<Broker | null>(null)
  const [deleteTopicTarget, setDeleteTopicTarget] = useState<TopicTarget | null>(null)

  const [collapsed, setCollapsed] = useState(false)
  const [width, setWidth] = useState(224)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const delta = e.clientX - dragStartX.current
      const newWidth = Math.min(480, Math.max(160, dragStartWidth.current + delta))
      setWidth(newWidth)
    }
    const onMouseUp = () => {
      isDragging.current = false
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const profile = profiles.find((p) => p.id === activeProfileId)
  const brokers = profile?.brokers ?? []

  const handleBrokerClick = async (broker: Broker) => {
    if (expandedBrokerId === broker.id) {
      setExpandedBrokerId(null)
      onBrokerSelect?.(null)
      return
    }
    setExpandedBrokerId(broker.id)
    if (activeProfileId) {
      onBrokerSelect?.({ profileId: activeProfileId, brokerId: broker.id, brokerName: broker.name })
    }
    if (topicsCache[broker.id] || !activeProfileId) return
    setLoadingBrokerId(broker.id)
    try {
      const topics = await ListTopics(activeProfileId, broker.id)
      setTopicsCache((prev) => ({ ...prev, [broker.id]: topics }))
    } catch {
      setTopicsCache((prev) => ({ ...prev, [broker.id]: [] }))
    } finally {
      setLoadingBrokerId(null)
    }
  }

  const makeTarget = (broker: Broker, topic: Topic): TopicTarget => ({
    profileId: activeProfileId!,
    brokerId: broker.id,
    brokerName: broker.name,
    topic: topic.name,
  })

  const handleRefreshTopics = async (broker: Broker) => {
    if (!activeProfileId) return
    setLoadingBrokerId(broker.id)
    try {
      const topics = await ListTopics(activeProfileId, broker.id)
      setTopicsCache((prev) => ({ ...prev, [broker.id]: topics }))
    } finally {
      setLoadingBrokerId(null)
    }
  }

  const handleSwitchCredential = async (broker: Broker, credentialId: string) => {
    if (!activeProfileId) return
    await SwitchBrokerCredential(activeProfileId, broker.id, credentialId)
    // Update local store to reflect new active credential
    if (profile) {
      const updatedBrokers = profile.brokers.map((b) =>
        b.id === broker.id ? { ...b, activeCredentialID: credentialId } : b
      )
      upsertProfile({ ...profile, brokers: updatedBrokers })
    }
  }

  const handleTopicCreated = async (broker: Broker) => {
    setCreateTopicBroker(null)
    await handleRefreshTopics(broker)
  }

  const handleTopicDeleted = async (broker: Broker) => {
    setDeleteTopicTarget(null)
    await handleRefreshTopics(broker)
  }

  return (
    <aside
      className="relative flex h-full flex-col border-r border-border shrink-0"
      style={{ width: collapsed ? 40 : width, transition: 'width 150ms' }}
    >
      {collapsed ? (
        <div className="flex h-full items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setCollapsed(false)}
            title="Expand sidebar"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Brokers
            </span>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setAddOpen(true)}
                title="Add broker"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setCollapsed(true)}
                title="Collapse sidebar"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-1 pb-2">
            {brokers.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                No brokers yet.
                <br />
                Click + to add one.
              </p>
            ) : (
              brokers.map((broker) => {
                const isExpanded = expandedBrokerId === broker.id
                const isLoading = loadingBrokerId === broker.id
                const topics = topicsCache[broker.id]
                const credentials = broker.credentials ?? []
                const activeCredential = credentials.find((c) => c.id === broker.activeCredentialID)

                return (
                  <div key={broker.id}>
                    <div className="group/broker flex items-center gap-0.5">
                      <button
                        onClick={() => handleBrokerClick(broker)}
                        className="shrink-0 p-0.5 rounded hover:bg-accent/60 text-muted-foreground"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <BrokerCard
                        broker={broker}
                        selected={isExpanded}
                        onClick={() => handleBrokerClick(broker)}
                      />
                      {/* Credential badge + switcher */}
                      {credentials.length > 0 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              className="shrink-0 p-0.5 rounded text-muted-foreground opacity-0 group-hover/broker:opacity-100 transition-opacity hover:bg-accent/60 hover:text-foreground"
                              title={`Active: ${activeCredential?.name ?? 'default'}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <UserCog className="h-3 w-3" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-48 p-1" align="start">
                            <p className="px-2 py-1 text-xs text-muted-foreground font-medium">Switch user</p>
                            {credentials.map((cred) => (
                              <button
                                key={cred.id}
                                className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent/60 flex items-center gap-2 ${cred.id === broker.activeCredentialID ? 'text-primary font-medium' : ''}`}
                                onClick={() => handleSwitchCredential(broker, cred.id)}
                              >
                                <span className="flex-1 truncate">{cred.name}</span>
                                {cred.id === broker.activeCredentialID && (
                                  <span className="text-xs text-muted-foreground">active</span>
                                )}
                              </button>
                            ))}
                          </PopoverContent>
                        </Popover>
                      )}
                      <button
                        onClick={() => setClusterBroker(broker)}
                        className="shrink-0 p-0.5 rounded text-muted-foreground opacity-0 group-hover/broker:opacity-100 transition-opacity hover:bg-accent/60 hover:text-foreground"
                        title="Cluster info"
                      >
                        <Server className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setGroupsBroker(broker) }}
                        className="shrink-0 p-0.5 rounded text-muted-foreground opacity-0 group-hover/broker:opacity-100 transition-opacity hover:bg-accent/60 hover:text-foreground"
                        title="Consumer groups"
                      >
                        <Users className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Active credential badge */}
                    {isExpanded && activeCredential && (
                      <div className="ml-5 px-2 pb-0.5">
                        <span className="text-xs text-muted-foreground/70">user: {activeCredential.name}</span>
                      </div>
                    )}

                    {isExpanded && (
                      <div className="ml-5 mb-1">
                        {isLoading ? (
                          <div className="flex items-center gap-1.5 px-2 py-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Loading topics…
                          </div>
                        ) : topics && topics.length > 0 ? (
                          <>
                            {topics.map((topic) => (
                              <TopicRow
                                key={topic.name}
                                topic={topic}
                                onObserve={() => setObserveTarget(makeTarget(broker, topic))}
                                onConsume={() => setConsumeTarget(makeTarget(broker, topic))}
                                onProduce={() => setProduceTarget(makeTarget(broker, topic))}
                                onInfo={() => setInfoTarget(makeTarget(broker, topic))}
                                onDelete={() => setDeleteTopicTarget(makeTarget(broker, topic))}
                              />
                            ))}
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleRefreshTopics(broker)}
                                className="px-2 py-1 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                              >
                                ↻ refresh
                              </button>
                              <button
                                onClick={() => setCreateTopicBroker(broker)}
                                className="px-2 py-1 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                              >
                                + topic
                              </button>
                            </div>
                          </>
                        ) : topics && topics.length === 0 ? (
                          <>
                            <p className="px-2 py-1.5 text-xs text-muted-foreground/60">
                              No topics found.
                            </p>
                            <button
                              onClick={() => setCreateTopicBroker(broker)}
                              className="px-2 py-1 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                            >
                              + topic
                            </button>
                          </>
                        ) : null}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </nav>
        </>
      )}

      {/* Drag handle for resize */}
      {!collapsed && (
        <div
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 transition-colors"
          onMouseDown={(e) => {
            isDragging.current = true
            dragStartX.current = e.clientX
            dragStartWidth.current = width
          }}
        />
      )}

      <BrokerFormDialog
        profileId={profile?.id ?? ''}
        open={addOpen && Boolean(profile)}
        onOpenChange={setAddOpen}
      />

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

      {infoTarget && (
        <TopicInfoDialog
          {...infoTarget}
          open={Boolean(infoTarget)}
          onOpenChange={(v) => !v && setInfoTarget(null)}
        />
      )}

      {clusterBroker && activeProfileId && (
        <ClusterInfoDialog
          profileId={activeProfileId}
          brokerId={clusterBroker.id}
          brokerName={clusterBroker.name}
          open={Boolean(clusterBroker)}
          onOpenChange={(v) => !v && setClusterBroker(null)}
        />
      )}

      {groupsBroker && activeProfileId && (
        <ConsumerGroupsDialog
          profileId={activeProfileId}
          brokerId={groupsBroker.id}
          brokerName={groupsBroker.name}
          open={Boolean(groupsBroker)}
          onOpenChange={(v) => !v && setGroupsBroker(null)}
        />
      )}

      {createTopicBroker && activeProfileId && (
        <CreateTopicDialog
          profileId={activeProfileId}
          brokerId={createTopicBroker.id}
          open={Boolean(createTopicBroker)}
          onOpenChange={(v) => !v && setCreateTopicBroker(null)}
          onCreated={() => handleTopicCreated(createTopicBroker)}
        />
      )}

      {deleteTopicTarget && (
        <DeleteTopicConfirm
          target={deleteTopicTarget}
          onClose={() => setDeleteTopicTarget(null)}
          onDeleted={() => {
            const broker = brokers.find((b) => b.id === deleteTopicTarget.brokerId)
            if (broker) handleTopicDeleted(broker)
          }}
        />
      )}
    </aside>
  )
}

// ── Delete topic confirmation ─────────────────────────────────────────────────

function DeleteTopicConfirm({
  target,
  onClose,
  onDeleted,
}: {
  target: TopicTarget
  onClose: () => void
  onDeleted: () => void
}) {
  const handleDelete = async () => {
    await DeleteTopic(target.profileId, target.brokerId, target.topic)
    onDeleted()
  }
  return (
    <AlertDialog open onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Topic</AlertDialogTitle>
          <AlertDialogDescription>
            Delete topic <span className="font-mono">{target.topic}</span>? All data will be permanently lost.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={handleDelete}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
