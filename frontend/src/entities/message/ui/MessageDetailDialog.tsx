import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { JsonHighlight } from '@/shared/ui/json-highlight'
import { formatTimestamp, formatRelativeTime } from '@shared/lib/formatters'
import type { KafkaMessage } from '../model/types'

interface Props {
  message: KafkaMessage | null
  decodedValue?: string | null
  open: boolean
  onOpenChange: (v: boolean) => void
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy}>
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </Button>
  )
}

function prettyJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2)
  } catch {
    return str
  }
}

export function MessageDetailDialog({ message, decodedValue, open, onOpenChange }: Props) {
  const [showRaw, setShowRaw] = useState(false)

  if (!message) return null

  const hasDecoded = decodedValue != null && decodedValue !== message.value
  const displayValue = showRaw ? message.value : (decodedValue ?? message.value)
  const prettyValue = prettyJson(displayValue)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between text-sm">
            <span>Message Detail</span>
            <span className="font-mono text-muted-foreground text-xs">
              P{message.partition} · #{message.offset}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 min-h-0 text-xs">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 bg-muted/30 rounded p-3">
            <div>
              <span className="text-muted-foreground">Topic</span>
              <p className="font-mono font-medium">{message.topic}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Timestamp</span>
              <p className="font-mono">
                {formatTimestamp(message.timestamp)}{' '}
                <span className="text-muted-foreground">({formatRelativeTime(message.timestamp)})</span>
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Partition</span>
              <p className="font-mono">{message.partition}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Offset</span>
              <p className="font-mono">{message.offset}</p>
            </div>
          </div>

          {/* Key */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium text-muted-foreground uppercase tracking-wide">Key</span>
              {message.key && <CopyButton text={message.key} />}
            </div>
            <div className="bg-muted/30 rounded p-2 font-mono">
              {message.key || <span className="text-muted-foreground/50 italic">empty</span>}
            </div>
          </div>

          {/* Value */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-muted-foreground uppercase tracking-wide">Value</span>
              <div className="flex items-center gap-1 ml-auto">
                {hasDecoded && (
                  <Button
                    variant={showRaw ? 'outline' : 'secondary'}
                    size="sm"
                    className="h-5 px-2 text-xs"
                    onClick={() => setShowRaw((v) => !v)}
                  >
                    {showRaw ? 'Decoded' : 'Raw'}
                  </Button>
                )}
                <CopyButton text={prettyValue} />
              </div>
            </div>
            <pre className="bg-muted/30 rounded p-2 font-mono text-xs overflow-auto max-h-64 whitespace-pre-wrap break-all">
              {prettyValue
                ? <JsonHighlight code={prettyValue} />
                : <span className="text-muted-foreground/50 italic">empty</span>}
            </pre>
          </div>

          {/* Headers */}
          {message.headers.length > 0 && (
            <div className="space-y-1">
              <span className="font-medium text-muted-foreground uppercase tracking-wide">
                Headers ({message.headers.length})
              </span>
              <div className="bg-muted/30 rounded divide-y divide-border/40">
                {message.headers.map((h, i) => (
                  <div key={i} className="flex gap-3 px-2 py-1 font-mono">
                    <span className="text-muted-foreground shrink-0 min-w-[120px]">{h.key}</span>
                    <span className="truncate">{h.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
