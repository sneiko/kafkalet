import { useEffect } from 'react'
import { Settings, Sun, Moon } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Separator } from '@/shared/ui/separator'
import { ProfileSwitcher } from '@features/profile-switcher'
import { useTheme } from '@shared/lib/useTheme'

interface Props {
  onSettingsClick?: () => void
}

export function ProfileBar({ onSettingsClick }: Props) {
  const { theme, toggle } = useTheme()

  // Cmd/Ctrl+, → settings
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault()
        onSettingsClick?.()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onSettingsClick])

  return (
    <header className="flex h-10 items-center border-b border-border px-3 gap-2">
      <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase select-none">
        kafkalet
      </span>
      <Separator orientation="vertical" className="h-4" />
      <ProfileSwitcher />
      <div className="flex-1" />
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={toggle}
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onSettingsClick}
        title="Settings (⌘,)"
      >
        <Settings className="h-4 w-4" />
      </Button>
    </header>
  )
}
