import { z } from 'zod'
import { type profile } from '@shared/api'

export const baseSchema = z.object({
  name: z.string().min(1, 'Required'),
  addresses: z.string().min(1, 'Required'),
  tlsEnabled: z.boolean(),
  tlsCaCertPath: z.string(),
  tlsClientCertPath: z.string(),
  tlsClientKeyPath: z.string(),
  tlsInsecureSkipVerify: z.boolean(),
  srUrl: z.string(),
  srUsername: z.string(),
  srPassword: z.string(),
  // Initial user fields (add mode only)
  initialCredName: z.string(),
  initialCredMechanism: z.string(),
  initialCredUsername: z.string(),
  initialCredPassword: z.string(),
  initialCredOAuthTokenURL: z.string(),
  initialCredOAuthClientId: z.string(),
  initialCredOAuthScopes: z.string(),
  initialCredOAuthExtensions: z.array(z.object({ key: z.string(), value: z.string() })),
})

export function buildSchema(isEdit: boolean) {
  if (isEdit) return baseSchema
  return baseSchema.superRefine((data, ctx) => {
    if (!data.initialCredName.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required', path: ['initialCredName'] })
    }
    const isOAuth = data.initialCredMechanism === 'OAUTHBEARER'
    if (!isOAuth) {
      if (!data.initialCredUsername.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required', path: ['initialCredUsername'] })
      }
      if (!data.initialCredPassword) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required', path: ['initialCredPassword'] })
      }
    } else {
      if (!data.initialCredPassword) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required', path: ['initialCredPassword'] })
      }
    }
  })
}

export type FormValues = z.infer<typeof baseSchema>

export const credSchema = z.object({
  credName: z.string().min(1, 'Required'),
  credMechanism: z.string(),
  credUsername: z.string(),
  credPassword: z.string(),
})

export type CredFormValues = z.infer<typeof credSchema>

export function buildTestParams(values: {
  addresses: string
  tlsEnabled: boolean
  tlsCaCertPath: string
  tlsClientCertPath: string
  tlsClientKeyPath: string
  tlsInsecureSkipVerify: boolean
  initialCredMechanism: string
  initialCredUsername: string
  initialCredPassword: string
  initialCredOAuthTokenURL: string
  initialCredOAuthClientId: string
  initialCredOAuthScopes: string
  initialCredOAuthExtensions: { key: string; value: string }[]
}) {
  const addresses = values.addresses.split(',').map((s) => s.trim()).filter(Boolean)
  const mechanism = values.initialCredMechanism
  const isOAuth = mechanism === 'OAUTHBEARER'
  const tls = { enabled: values.tlsEnabled, insecureSkipVerify: values.tlsInsecureSkipVerify, caCertPath: values.tlsCaCertPath, clientCertPath: values.tlsClientCertPath, clientKeyPath: values.tlsClientKeyPath } as unknown as profile.TLSConfig
  const sasl = isOAuth
    ? { mechanism: 'OAUTHBEARER', username: '', oauthTokenURL: values.initialCredOAuthTokenURL, oauthClientID: values.initialCredOAuthClientId, oauthScopes: values.initialCredOAuthScopes.split(' ').filter(Boolean), oauthExtensions: Object.fromEntries(values.initialCredOAuthExtensions.filter(e => e.key.trim()).map(e => [e.key.trim(), e.value])) } as unknown as profile.SASLConfig
    : { mechanism, username: values.initialCredUsername, oauthTokenURL: '', oauthClientID: '', oauthScopes: [] } as unknown as profile.SASLConfig
  return { addresses, tls, sasl, password: values.initialCredPassword }
}
