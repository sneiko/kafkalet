export interface SASLConfig {
  mechanism: string // PLAIN | SCRAM-SHA-256 | SCRAM-SHA-512 | OAUTHBEARER
  username: string
  oauthTokenURL?: string
  oauthClientID?: string
  oauthScopes?: string[]
}

export interface SchemaRegistryConfig {
  url: string
  username: string
}

export interface TLSConfig {
  enabled: boolean
  insecureSkipVerify: boolean
  caCertPath: string
  clientCertPath: string
  clientKeyPath: string
}

export interface NamedCredential {
  id: string
  name: string
  sasl: SASLConfig
}

export interface Broker {
  id: string
  name: string
  addresses: string[]
  sasl: SASLConfig
  tls: TLSConfig
  schemaRegistry: SchemaRegistryConfig
  credentials?: NamedCredential[]
  activeCredentialID?: string
}

export interface Profile {
  id: string
  name: string
  brokers: Broker[]
}

export function emptyBroker(): Broker {
  return {
    id: '',
    name: '',
    addresses: [],
    sasl: { mechanism: '', username: '', oauthTokenURL: '', oauthClientID: '', oauthScopes: [] },
    schemaRegistry: { url: '', username: '' },
    tls: {
      enabled: false,
      insecureSkipVerify: false,
      caCertPath: '',
      clientCertPath: '',
      clientKeyPath: '',
    },
  }
}
