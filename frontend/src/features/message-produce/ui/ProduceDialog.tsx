import { useState } from 'react'
import { useForm, useFieldArray, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, Loader2 } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { JsonHighlight } from '@/shared/ui/json-highlight'
import { ProduceMessage, type broker } from '@shared/api'

function prettyJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2)
  } catch {
    return str
  }
}

function isValidJson(str: string): boolean {
  try {
    JSON.parse(str)
    return true
  } catch {
    return false
  }
}

const schema = z.object({
  key: z.string(),
  value: z.string().min(1, 'Value is required'),
  partition: z.number().int().min(-1),
  headers: z.array(z.object({ key: z.string(), value: z.string() })),
})

type FormData = z.infer<typeof schema>

interface Props {
  profileId: string
  brokerId: string
  topic: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProduceDialog({ profileId, brokerId, topic, open, onOpenChange }: Props) {
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { key: '', value: '', partition: -1, headers: [] },
  })

  const watchedValue = useWatch({ control, name: 'value' })

  const { fields, append, remove } = useFieldArray({ control, name: 'headers' })

  const onSubmit = async (data: FormData) => {
    setResult(null)
    try {
      await ProduceMessage(profileId, brokerId, {
        topic,
        partition: data.partition,
        key: data.key,
        value: data.value,
        headers: data.headers,
      } as unknown as broker.ProduceRequest)
      reset()
      onOpenChange(false)
    } catch (err) {
      setResult({ ok: false, msg: `✗ ${String(err)}` })
    }
  }

  const handleOpenChange = (v: boolean) => {
    if (!v) { reset(); setResult(null) }
    onOpenChange(v)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Produce to <span className="font-mono text-sm">{topic}</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <Label htmlFor="key">Key</Label>
              <Input id="key" placeholder="(empty)" {...register('key')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="partition">Partition</Label>
              <Input
                id="partition"
                type="number"
                min={-1}
                {...register('partition', { valueAsNumber: true })}
                className="tabular-nums"
              />
              <p className="text-[10px] text-muted-foreground">-1 = auto</p>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="value">Value</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-5 px-2 text-xs"
                onClick={() => setValue('value', prettyJson(watchedValue ?? ''))}
              >
                Format JSON
              </Button>
            </div>
            <textarea
              id="value"
              rows={5}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
              placeholder='{"key": "value"}'
              {...register('value')}
            />
            {errors.value && (
              <p className="text-xs text-destructive">{errors.value.message}</p>
            )}
            {watchedValue && isValidJson(watchedValue) && (
              <pre className="bg-muted/30 rounded p-2 font-mono text-xs overflow-auto max-h-40 whitespace-pre-wrap break-all">
                <JsonHighlight code={prettyJson(watchedValue)} />
              </pre>
            )}
          </div>

          {/* Headers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Headers</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-xs"
                onClick={() => append({ key: '', value: '' })}
              >
                <Plus className="h-3 w-3" />
                Add
              </Button>
            </div>
            {fields.map((field, idx) => (
              <div key={field.id} className="flex gap-2">
                <Input
                  placeholder="Key"
                  className="h-7 text-xs"
                  {...register(`headers.${idx}.key`)}
                />
                <Input
                  placeholder="Value"
                  className="h-7 text-xs"
                  {...register(`headers.${idx}.value`)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => remove(idx)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>

          {result && (
            <p className={result.ok ? 'text-sm text-green-500' : 'text-sm text-destructive'}>
              {result.msg}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Produce
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
