import { useState } from 'react'
import { Loader2, Users } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/ui/form'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

import { StartConsumer } from '@shared/api'
import { useSessionStore } from '@entities/session'

const schema = z.object({
  groupId: z.string().min(1, 'Group ID is required'),
})

type FormValues = z.infer<typeof schema>

interface Props {
  profileId: string
  brokerId: string
  brokerName: string
  topic: string
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function ConsumeDialog({
  profileId,
  brokerId,
  brokerName,
  topic,
  open,
  onOpenChange,
}: Props) {
  const [startOffset, setStartOffset] = useState<'latest' | 'earliest'>('latest')
  const [error, setError] = useState<string | null>(null)

  const addSession = useSessionStore((s) => s.addSession)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { groupId: '' },
  })

  const onSubmit = async ({ groupId }: FormValues) => {
    setError(null)
    try {
      const sessionId = await StartConsumer(profileId, brokerId, topic, groupId, startOffset)
      addSession({
        id: sessionId,
        profileId,
        brokerId,
        brokerName,
        topic,
        startOffset,
        mode: 'consumer',
        groupId,
      })
      onOpenChange(false)
      form.reset()
    } catch (err) {
      setError(String(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Join Consumer Group
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>
                <span className="font-medium text-foreground/80">{brokerName}</span>
                {' / '}
                <span className="font-mono">{topic}</span>
              </p>
            </div>

            <FormField
              control={form.control}
              name="groupId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Consumer Group ID</FormLabel>
                  <FormControl>
                    <Input placeholder="my-consumer-group" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <Label className="text-xs">Start From</Label>
              <p className="text-xs text-muted-foreground -mt-1">
                Used only if the group has no committed offsets yet.
              </p>
              <div className="flex gap-3">
                {(['latest', 'earliest'] as const).map((opt) => (
                  <label
                    key={opt}
                    className="flex items-center gap-1.5 text-sm cursor-pointer"
                  >
                    <input
                      type="radio"
                      value={opt}
                      checked={startOffset === opt}
                      onChange={() => setStartOffset(opt)}
                      className="accent-primary"
                    />
                    <span className="capitalize">{opt}</span>
                  </label>
                ))}
              </div>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
                Join Group
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
