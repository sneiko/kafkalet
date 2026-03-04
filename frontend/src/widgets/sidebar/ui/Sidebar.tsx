import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronRight, ChevronLeft, Plus } from 'lucide-react'

import { IconButton } from '@/shared/ui/icon-button'
import { BrokerCard } from '@entities/broker'
import { useProfileStore, type Broker } from '@entities/profile'
import { BrokerFormDialog } from '@features/broker-connect'

const LS_WIDTH = 'sidebar-width'
const LS_COLLAPSED = 'sidebar-collapsed'

function readWidth(): number {
  const v = localStorage.getItem(LS_WIDTH)
  const n = v ? Number(v) : NaN
  return Number.isFinite(n) && n >= 160 && n <= 480 ? n : 224
}

function readCollapsed(): boolean {
  return localStorage.getItem(LS_COLLAPSED) === 'true'
}

interface Props {
  activeBrokerId?: string
  onBrokerSelect?: (broker: { profileId: string; brokerId: string; brokerName: string } | null) => void
}

export function Sidebar({ activeBrokerId, onBrokerSelect }: Props) {
  const { profiles, activeProfileId } = useProfileStore()

  const [addOpen, setAddOpen] = useState(false)

  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [width, setWidth] = useState(readWidth)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)
  const widthRef = useRef(width)

  const toggleCollapsed = useCallback((value: boolean) => {
    setCollapsed(value)
    localStorage.setItem(LS_COLLAPSED, String(value))
  }, [])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const delta = e.clientX - dragStartX.current
      const newWidth = Math.min(480, Math.max(160, dragStartWidth.current + delta))
      widthRef.current = newWidth
      setWidth(newWidth)
    }
    const onMouseUp = () => {
      if (!isDragging.current) return
      isDragging.current = false
      localStorage.setItem(LS_WIDTH, String(widthRef.current))
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

  const handleBrokerClick = (broker: Broker) => {
    if (activeBrokerId === broker.id) {
      onBrokerSelect?.(null)
      return
    }
    if (activeProfileId) {
      onBrokerSelect?.({ profileId: activeProfileId, brokerId: broker.id, brokerName: broker.name })
    }
  }

  // Keyboard navigation
  const [focusedIndex, setFocusedIndex] = useState(-1)

  const handleNavKeyDown = (e: React.KeyboardEvent) => {
    if (brokers.length === 0) return
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setFocusedIndex((i) => (i < brokers.length - 1 ? i + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIndex((i) => (i > 0 ? i - 1 : brokers.length - 1))
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (focusedIndex >= 0 && focusedIndex < brokers.length) {
          handleBrokerClick(brokers[focusedIndex])
        }
        break
    }
  }

  return (
    <aside
      className="relative flex h-full flex-col border-r border-border shrink-0"
      style={{ width: collapsed ? 40 : width, transition: 'width 150ms' }}
    >
      {collapsed ? (
        <div className="flex h-full items-center justify-center">
          <IconButton
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => toggleCollapsed(false)}
            tooltip="Expand sidebar"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Brokers
            </span>
            <div className="flex items-center gap-0.5">
              <IconButton
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setAddOpen(true)}
                tooltip="Add broker"
              >
                <Plus className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => toggleCollapsed(true)}
                tooltip="Collapse sidebar"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </IconButton>
            </div>
          </div>

          <nav
            className="flex-1 overflow-y-auto px-1 pb-2"
            role="listbox"
            tabIndex={0}
            onKeyDown={handleNavKeyDown}
            onBlur={() => setFocusedIndex(-1)}
          >
            {brokers.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                No brokers yet.
                <br />
                Click + to add one.
              </p>
            ) : (
              brokers.map((broker, index) => (
                <BrokerCard
                  key={broker.id}
                  broker={broker}
                  selected={activeBrokerId === broker.id}
                  focused={focusedIndex === index}
                  onClick={() => handleBrokerClick(broker)}
                />
              ))
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
    </aside>
  )
}
