// Re-export Wails RPC bindings so features import from @shared/api, not directly from wailsjs.
export * from '@wails/go/main/App'
export { EventsOn, EventsOff, EventsEmit } from '@wails/runtime/runtime'
export type { profile, broker, plugin, updater } from '@wails/go/models'
