import { EventsOn, EventsOff } from '@wails/runtime/runtime'

export function typedEventsOn<T>(eventName: string, callback: (data: T) => void): () => void {
  EventsOn(eventName, callback)
  return () => EventsOff(eventName)
}
