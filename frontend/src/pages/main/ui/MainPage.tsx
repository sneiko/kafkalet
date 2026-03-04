import { useState } from 'react'
import { ProfileBar } from '@widgets/profile-bar'
import { Sidebar } from '@widgets/sidebar'
import { StreamPane, SessionTabBar } from '@widgets/stream-pane'
import { GroupLagPanel } from '@widgets/group-lag-panel'
import { ClusterStatsBar } from '@widgets/cluster-stats-bar'
import { SettingsPage } from '@pages/settings'
import { Button } from '@/shared/ui/button'
import { useProfileStore } from '@entities/profile'

interface ActiveBroker {
  profileId: string
  brokerId: string
  brokerName: string
}

export function MainPage() {
  const [view, setView] = useState<'main' | 'settings'>('main')
  const [activeBroker, setActiveBroker] = useState<ActiveBroker | null>(null)
  const { profiles, isLoading } = useProfileStore()

  if (view === 'settings') {
    return <SettingsPage onBack={() => setView('main')} />
  }

  return (
    <div className="flex h-full flex-col">
      <ProfileBar onSettingsClick={() => setView('settings')} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar onBrokerSelect={setActiveBroker} />
        <main className="flex flex-1 flex-col overflow-hidden">
          {!isLoading && profiles.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="space-y-3 text-center">
                <p className="text-sm text-muted-foreground">
                  No profiles yet. Add one to connect to a Kafka cluster.
                </p>
                <Button onClick={() => setView('settings')}>Get Started</Button>
              </div>
            </div>
          ) : (
            <>
              {activeBroker && <ClusterStatsBar {...activeBroker} />}
              <SessionTabBar />
              <StreamPane />
              <GroupLagPanel />
            </>
          )}
        </main>
      </div>
    </div>
  )
}
