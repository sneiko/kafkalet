import { useState, useRef, useEffect, useCallback } from 'react'
import { ProfileBar } from '@widgets/profile-bar'
import { Sidebar } from '@widgets/sidebar'
import { StreamPane, SessionTabBar } from '@widgets/stream-pane'
import { GroupLagPanel } from '@widgets/group-lag-panel'
import { BrokerDashboard } from '@widgets/broker-dashboard'
import { SettingsPage } from '@pages/settings'
import { Button } from '@/shared/ui/button'
import { useProfileStore } from '@entities/profile'
import { useSessionStore } from '@entities/session'

interface ActiveBroker {
  profileId: string
  brokerId: string
  brokerName: string
}

const MIN_DASHBOARD_HEIGHT = 150
const MIN_STREAM_HEIGHT = 120
const DEFAULT_SPLIT_RATIO = 0.55
const LS_SPLIT_RATIO = 'split-ratio'

export function MainPage() {
  const [view, setView] = useState<'main' | 'settings'>('main')
  const [activeBroker, setActiveBroker] = useState<ActiveBroker | null>(null)
  const { profiles, isLoading } = useProfileStore()

  const sessions = useSessionStore((s) => s.sessions)
  const hasSessions = Object.keys(sessions).length > 0

  // Split layout state
  const containerRef = useRef<HTMLDivElement>(null)
  const [topHeight, setTopHeight] = useState<number | null>(null)
  const isDragging = useRef(false)
  const dragStartY = useRef(0)
  const dragStartHeight = useRef(0)
  const topHeightRef = useRef<number | null>(null)

  // Initialize top height based on container size
  const initTopHeight = useCallback(() => {
    if (containerRef.current && hasSessions) {
      const total = containerRef.current.offsetHeight
      const saved = localStorage.getItem(LS_SPLIT_RATIO)
      const ratio = saved ? parseFloat(saved) : DEFAULT_SPLIT_RATIO
      const clamped = Math.min(0.85, Math.max(0.15, isNaN(ratio) ? DEFAULT_SPLIT_RATIO : ratio))
      setTopHeight(Math.round(total * clamped))
    }
  }, [hasSessions])

  useEffect(() => {
    initTopHeight()
  }, [initTopHeight])

  useEffect(() => {
    topHeightRef.current = topHeight
  }, [topHeight])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const totalHeight = containerRect.height
      const delta = e.clientY - dragStartY.current
      const newHeight = dragStartHeight.current + delta
      const clamped = Math.min(
        totalHeight - MIN_STREAM_HEIGHT,
        Math.max(MIN_DASHBOARD_HEIGHT, newHeight)
      )
      setTopHeight(clamped)
    }
    const onMouseUp = () => {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      if (containerRef.current && topHeightRef.current != null) {
        const total = containerRef.current.offsetHeight
        if (total > 0) {
          localStorage.setItem(LS_SPLIT_RATIO, String(topHeightRef.current / total))
        }
      }
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  if (view === 'settings') {
    return <SettingsPage onBack={() => setView('main')} />
  }

  return (
    <div className="flex h-full flex-col">
      <ProfileBar onSettingsClick={() => setView('settings')} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeBrokerId={activeBroker?.brokerId} onBrokerSelect={setActiveBroker} />
        <main className="flex flex-1 flex-col overflow-hidden" ref={containerRef}>
          {!isLoading && profiles.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="space-y-3 text-center">
                <p className="text-sm text-muted-foreground">
                  No profiles yet. Add one to connect to a Kafka cluster.
                </p>
                <Button onClick={() => setView('settings')}>Get Started</Button>
              </div>
            </div>
          ) : activeBroker ? (
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Dashboard area */}
              <div
                className="flex flex-col overflow-hidden"
                style={{ height: hasSessions ? topHeight ?? '55%' : '100%' }}
              >
                <BrokerDashboard {...activeBroker} />
              </div>

              {/* Stream area */}
              {hasSessions && (
                <>
                  {/* Resize handle */}
                  <div
                    className="h-1 shrink-0 cursor-row-resize bg-border/50 hover:bg-primary/30 transition-colors"
                    onMouseDown={(e) => {
                      isDragging.current = true
                      dragStartY.current = e.clientY
                      dragStartHeight.current = topHeight ?? 0
                      document.body.style.cursor = 'row-resize'
                      document.body.style.userSelect = 'none'
                    }}
                  />
                  <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
                    <SessionTabBar />
                    <StreamPane />
                    <GroupLagPanel />
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Select a broker from the sidebar to get started.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
