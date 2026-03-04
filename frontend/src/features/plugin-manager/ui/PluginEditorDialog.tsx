import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Play, Loader2 } from 'lucide-react'

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
import { Separator } from '@/shared/ui/separator'

import { SavePlugin } from '@shared/api'
import { usePluginStore } from '@entities/plugin'
import type { Plugin } from '@entities/plugin'
import { applyPlugin } from '@shared/lib/applyPlugin'

const DEFAULT_SCRIPT = `// Parameters: value (string), key (string), headers (Object)
// Must return a string or serialisable value.
return JSON.stringify(JSON.parse(value), null, 2);`

const schema = z.object({
  name: z.string().min(1, 'Required'),
  topicPattern: z.string().min(1, 'Required'),
  script: z.string().min(1, 'Required'),
})

type FormValues = z.infer<typeof schema>

interface Props {
  plugin?: Plugin | null
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function PluginEditorDialog({ plugin, open, onOpenChange }: Props) {
  const { upsertPlugin } = usePluginStore()
  const [testInput, setTestInput] = useState('{"hello":"world"}')
  const [testOutput, setTestOutput] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: plugin?.name ?? '',
      topicPattern: plugin?.topicPattern ?? '',
      script: plugin?.script ?? DEFAULT_SCRIPT,
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        name: plugin?.name ?? '',
        topicPattern: plugin?.topicPattern ?? '',
        script: plugin?.script ?? DEFAULT_SCRIPT,
      })
      setTestOutput(null)
    }
  }, [open, plugin])

  const onSubmit = async (values: FormValues) => {
    try {
      const saved = await SavePlugin({
        id: plugin?.id ?? '',
        name: values.name,
        topicPattern: values.topicPattern,
        script: values.script,
      })
      upsertPlugin(saved)
      onOpenChange(false)
    } catch (err) {
      form.setError('root', { message: String(err) })
    }
  }

  const handleTest = () => {
    const values = form.getValues()
    const result = applyPlugin(
      { value: testInput, key: '', headers: [] },
      'test-topic',
      [{ id: 'test', name: 'test', topicPattern: 'test-topic', script: values.script }],
    )
    setTestOutput(result ?? '(no match)')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{plugin ? 'Edit Plugin' : 'New Plugin'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="JSON pretty-printer" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="topicPattern"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Topic Pattern (regex)</FormLabel>
                  <FormControl>
                    <Input placeholder="my-topic-.*" className="font-mono text-xs" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="script"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Decode Script{' '}
                    <span className="text-muted-foreground text-xs font-normal">
                      (value, key, headers) → string
                    </span>
                  </FormLabel>
                  <FormControl>
                    <textarea
                      {...field}
                      rows={7}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono resize-y ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            {/* Test section */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Test
              </p>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1">Input value</p>
                  <Input
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                    className="h-8 text-xs font-mono"
                    placeholder='{"key":"value"}'
                  />
                </div>
                <Button type="button" variant="outline" size="sm" className="h-8" onClick={handleTest}>
                  <Play className="h-3 w-3" />
                  Run
                </Button>
              </div>
              {testOutput !== null && (
                <pre className="rounded-md bg-muted px-3 py-2 text-xs font-mono whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                  {testOutput}
                </pre>
              )}
            </div>

            {form.formState.errors.root && (
              <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
            )}

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} type="button">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
                {plugin ? 'Save' : 'Create Plugin'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
