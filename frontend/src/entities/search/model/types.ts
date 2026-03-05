export interface SearchMatch {
  topic: string
  partition: number
  offset: number
  key: string
  value: string
  timestamp: string
  headers: { key: string; value: string }[]
}

export interface SearchProgress {
  scanned: number
  totalEst: number
  matched: number
  done: boolean
  error?: string
}

export interface SearchSession {
  id: string
  profileId: string
  brokerId: string
  brokerName: string
  topic: string
  matches: SearchMatch[]
  progress: SearchProgress | null
}
