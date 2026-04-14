import { useState, useEffect } from 'react'
import { ChevronDown, Plus, UserCog } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { ClusterStatsBar } from '@widgets/cluster-stats-bar'
import { EventsOn, SwitchBrokerCredential } from '@shared/api'
import { useProfileStore } from '@entities/profile'
import { CredentialFormDialog } from '@features/broker-connect'
import { TopicsTab } from './TopicsTab'
import { ConsumerGroupsTab } from './ConsumerGroupsTab'
import { ActiveSessionsTab } from './ActiveSessionsTab'

interface Props {
  profileId: string
  brokerId: string
  brokerName: string
}

export function BrokerDashboard({ profileId, brokerId, brokerName }: Props) {
  const [activeTab, setActiveTab] = useState('topics')
  const [refreshKey, setRefreshKey] = useState(0)
  const [credDialogOpen, setCredDialogOpen] = useState(false)

  const { profiles, upsertProfile } = useProfileStore()
  const profile = profiles.find((p) => p.id === profileId)
  const broker = profile?.brokers.find((b) => b.id === brokerId)
  const credentials = broker?.credentials ?? []
  const activeCredential = credentials.find((c) => c.id === broker?.activeCredentialID)

  const handleSwitchCredential = async (credentialId: string) => {
    await SwitchBrokerCredential(profileId, brokerId, credentialId)
    if (profile) {
      const updatedBrokers = profile.brokers.map((b) =>
        b.id === brokerId ? { ...b, activeCredentialID: credentialId } : b,
      )
      upsertProfile({ ...profile, brokers: updatedBrokers })
    }
  }

  // Re-fetch on credential switch
  useEffect(() => {
    return EventsOn('broker:credential-switched', (payload: any) => {
      if (payload?.brokerID === brokerId) {
        setRefreshKey((k) => k + 1)
      }
    })
  }, [brokerId])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header: broker name + credential switcher */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border shrink-0">
        <span className="text-sm font-medium truncate">{brokerName}</span>
        <div className="ml-auto flex items-center gap-1">
          {credentials.length === 0 && (
            <span className="text-xs text-muted-foreground">(no auth)</span>
          )}
          {credentials.length === 1 && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <UserCog className="h-3 w-3" />
              {credentials[0].name}
            </span>
          )}
          {credentials.length > 1 && (
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors">
                  <UserCog className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[120px]">
                    {activeCredential?.name ?? credentials[0].name}
                  </span>
                  <ChevronDown className="h-3 w-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="end">
                <p className="px-2 py-1 text-xs text-muted-foreground font-medium">Switch user</p>
                {credentials.map((cred) => (
                  <button
                    key={cred.id}
                    className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent/60 flex items-center gap-2 ${cred.id === broker?.activeCredentialID ? 'text-primary font-medium' : ''}`}
                    onClick={() => handleSwitchCredential(cred.id)}
                  >
                    <span className="flex-1 truncate">{cred.name}</span>
                    {cred.id === broker?.activeCredentialID && (
                      <span className="text-xs text-muted-foreground">active</span>
                    )}
                  </button>
                ))}
                <button
                  className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent/60 text-muted-foreground flex items-center gap-1"
                  onClick={() => setCredDialogOpen(true)}
                >
                  <Plus className="h-3 w-3" />
                  Add user
                </button>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>
      <ClusterStatsBar key={`stats-${refreshKey}`} profileId={profileId} brokerId={brokerId} />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
        <TabsList className="mx-3 mt-2 self-start h-8">
          <TabsTrigger value="topics" className="text-xs px-3 py-1">
            Topics
          </TabsTrigger>
          <TabsTrigger value="consumer-groups" className="text-xs px-3 py-1">
            Consumer Groups
          </TabsTrigger>
          <TabsTrigger value="sessions" className="text-xs px-3 py-1">
            Sessions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="topics" className="flex-1 min-h-0 mt-0">
          <TopicsTab
            key={`topics-${refreshKey}`}
            profileId={profileId}
            brokerId={brokerId}
            brokerName={brokerName}
          />
        </TabsContent>

        <TabsContent value="consumer-groups" className="flex-1 min-h-0 mt-0">
          <ConsumerGroupsTab key={`cg-${refreshKey}`} profileId={profileId} brokerId={brokerId} />
        </TabsContent>

        <TabsContent value="sessions" className="flex-1 min-h-0 mt-0">
          <ActiveSessionsTab brokerId={brokerId} />
        </TabsContent>
      </Tabs>

      <CredentialFormDialog
        profileId={profileId}
        brokerId={brokerId}
        open={credDialogOpen}
        onOpenChange={setCredDialogOpen}
      />
    </div>
  )
}
