import { useEffect } from 'react'
import { toast } from 'sonner'
import { EventsOn, OpenURL } from '@shared/api'

interface Release {
  tag_name: string
  name: string
  html_url: string
  body: string
}

export function useUpdateChecker() {
  useEffect(() => {
    return EventsOn('app:update-available', (rel: Release) => {
      toast('Update available', {
        description: `Version ${rel.tag_name} is ready`,
        duration: Infinity,
        action: {
          label: 'Download',
          onClick: () => OpenURL(rel.html_url),
        },
      })
    })
  }, [])
}
