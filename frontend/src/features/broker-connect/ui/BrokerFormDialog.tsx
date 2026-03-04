import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Trash2, Plus, UserCheck } from 'lucide-react'

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog'

import {
  AddBroker,
  UpdateBroker,
  SetBrokerPassword,
  SetSchemaRegistryPassword,
  TestBrokerConnection,
  AddBrokerCredential,
  DeleteBrokerCredential,
  SetNamedCredentialPassword,
  type profile,
} from '@shared/api'
import { useProfileStore, type Broker, type NamedCredential } from '@entities/profile'

const schema = z.object({
  name: z.string().min(1, 'Required'),
  addresses: z.string().min(1, 'Required'),
  saslMechanism: z.string(),
  saslUsername: z.string(),
  saslPassword: z.string(),
  oauthTokenURL: z.string(),
  oauthClientId: z.string(),
  oauthScopes: z.string(),
  tlsEnabled: z.boolean(),
  srUrl: z.string(),
  srUsername: z.string(),
  srPassword: z.string(),
})

type FormValues = z.infer<typeof schema>

const credSchema = z.object({
  credName: z.string().min(1, 'Required'),
  credMechanism: z.string(),
  credUsername: z.string(),
  credPassword: z.string(),
})

type CredFormValues = z.infer<typeof credSchema>

interface Props {
  profileId: string
  broker?: Broker
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function BrokerFormDialog({ profileId, broker, open, onOpenChange }: Props) {
  const isEdit = Boolean(broker)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [credDeleteTarget, setCredDeleteTarget] = useState<NamedCredential | null>(null)
  const [addingCred, setAddingCred] = useState(false)
  const { upsertProfile, profiles } = useProfileStore()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: broker?.name ?? '',
      addresses: broker?.addresses.join(', ') ?? '',
      saslMechanism: broker?.sasl.mechanism || '__none__',
      saslUsername: broker?.sasl.username ?? '',
      saslPassword: '',
      oauthTokenURL: broker?.sasl.oauthTokenURL ?? '',
      oauthClientId: broker?.sasl.oauthClientID ?? '',
      oauthScopes: broker?.sasl.oauthScopes?.join(' ') ?? '',
      tlsEnabled: broker?.tls.enabled ?? false,
      srUrl: broker?.schemaRegistry?.url ?? '',
      srUsername: broker?.schemaRegistry?.username ?? '',
      srPassword: '',
    },
  })

  const credForm = useForm<CredFormValues>({
    resolver: zodResolver(credSchema),
    defaultValues: {
      credName: '',
      credMechanism: 'PLAIN',
      credUsername: '',
      credPassword: '',
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        name: broker?.name ?? '',
        addresses: broker?.addresses.join(', ') ?? '',
        saslMechanism: broker?.sasl.mechanism || '__none__',
        saslUsername: broker?.sasl.username ?? '',
        saslPassword: '',
        oauthTokenURL: broker?.sasl.oauthTokenURL ?? '',
        oauthClientId: broker?.sasl.oauthClientID ?? '',
        oauthScopes: broker?.sasl.oauthScopes?.join(' ') ?? '',
        tlsEnabled: broker?.tls.enabled ?? false,
        srUrl: broker?.schemaRegistry?.url ?? '',
        srUsername: broker?.schemaRegistry?.username ?? '',
        srPassword: '',
      })
      setTestResult(null)
      setAddingCred(false)
      credForm.reset()
    }
  }, [open, broker])

  const onSubmit = async (values: FormValues) => {
    const addresses = values.addresses.split(',').map((s) => s.trim()).filter(Boolean)
    const isOAuth = values.saslMechanism === 'OAUTHBEARER'
    const brokerData: Broker = {
      id: broker?.id ?? '',
      name: values.name,
      addresses,
      sasl: isOAuth
        ? {
            mechanism: 'OAUTHBEARER',
            username: '',
            oauthTokenURL: values.oauthTokenURL,
            oauthClientID: values.oauthClientId,
            oauthScopes: values.oauthScopes.split(' ').filter(Boolean),
          }
        : {
            mechanism: values.saslMechanism === '__none__' ? '' : values.saslMechanism,
            username: values.saslUsername,
            oauthTokenURL: '',
            oauthClientID: '',
            oauthScopes: [],
          },
      tls: {
        enabled: values.tlsEnabled,
        insecureSkipVerify: false,
        caCertPath: '',
        clientCertPath: '',
        clientKeyPath: '',
      },
      schemaRegistry: {
        url: values.srUrl.trim(),
        username: values.srUsername,
      },
      credentials: broker?.credentials,
      activeCredentialID: broker?.activeCredentialID,
    }

    try {
      let savedBroker: Broker
      if (isEdit) {
        await UpdateBroker(profileId, brokerData as unknown as profile.Broker)
        savedBroker = brokerData
      } else {
        savedBroker = await AddBroker(profileId, brokerData as unknown as profile.Broker) as unknown as Broker
      }

      if (values.saslPassword) {
        await SetBrokerPassword(profileId, savedBroker.id, values.saslPassword)
      }

      if (values.srPassword) {
        await SetSchemaRegistryPassword(profileId, savedBroker.id, values.srPassword)
      }

      const currentProfile = profiles.find((p) => p.id === profileId)
      if (currentProfile) {
        const brokers = isEdit
          ? currentProfile.brokers.map((b) => (b.id === savedBroker.id ? savedBroker : b))
          : [...currentProfile.brokers, savedBroker]
        upsertProfile({ ...currentProfile, brokers })
      }

      onOpenChange(false)
    } catch (err) {
      form.setError('root', { message: String(err) })
    }
  }

  const handleTest = async () => {
    if (!broker) return
    setTesting(true)
    setTestResult(null)
    try {
      await TestBrokerConnection(profileId, broker.id)
      setTestResult('✓ Connection successful')
    } catch (err) {
      setTestResult(`✗ ${String(err)}`)
    } finally {
      setTesting(false)
    }
  }

  const handleAddCredential = async (values: CredFormValues) => {
    if (!broker) return
    try {
      const newCred = await AddBrokerCredential(profileId, broker.id, {
        id: '',
        name: values.credName,
        sasl: {
          mechanism: values.credMechanism,
          username: values.credUsername,
          oauthTokenURL: '',
          oauthClientID: '',
          oauthScopes: [],
        },
      } as unknown as profile.NamedCredential) as unknown as NamedCredential

      if (values.credPassword) {
        await SetNamedCredentialPassword(profileId, broker.id, newCred.id, values.credPassword)
      }

      const currentProfile = profiles.find((p) => p.id === profileId)
      if (currentProfile) {
        const updatedBrokers = currentProfile.brokers.map((b) =>
          b.id === broker.id
            ? { ...b, credentials: [...(b.credentials ?? []), newCred] }
            : b
        )
        upsertProfile({ ...currentProfile, brokers: updatedBrokers })
      }

      credForm.reset()
      setAddingCred(false)
    } catch (err) {
      credForm.setError('root', { message: String(err) })
    }
  }

  const handleDeleteCredential = async (cred: NamedCredential) => {
    if (!broker) return
    await DeleteBrokerCredential(profileId, broker.id, cred.id)
    const currentProfile = profiles.find((p) => p.id === profileId)
    if (currentProfile) {
      const updatedBrokers = currentProfile.brokers.map((b) =>
        b.id === broker.id
          ? { ...b, credentials: (b.credentials ?? []).filter((c) => c.id !== cred.id) }
          : b
      )
      upsertProfile({ ...currentProfile, brokers: updatedBrokers })
    }
    setCredDeleteTarget(null)
  }

  const saslMechanism = form.watch('saslMechanism')
  const oauthTokenURL = form.watch('oauthTokenURL')
  const isOAuth = saslMechanism === 'OAUTHBEARER'
  const isClientCredentials = isOAuth && oauthTokenURL.trim() !== ''
  const credentials = broker?.credentials ?? []

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit Broker' : 'Add Broker'}</DialogTitle>
          </DialogHeader>

          {isEdit ? (
            <Tabs defaultValue="connection">
              <TabsList className="w-full">
                <TabsTrigger value="connection" className="flex-1">Connection</TabsTrigger>
                <TabsTrigger value="users" className="flex-1">
                  Users {credentials.length > 0 && <span className="ml-1 text-xs text-muted-foreground">({credentials.length})</span>}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="connection">
                <ConnectionForm
                  form={form}
                  isEdit={isEdit}
                  saslMechanism={saslMechanism}
                  isOAuth={isOAuth}
                  isClientCredentials={isClientCredentials}
                  testing={testing}
                  testResult={testResult}
                  onTest={handleTest}
                  onSubmit={onSubmit}
                />
              </TabsContent>

              <TabsContent value="users" className="space-y-3">
                {credentials.length === 0 && !addingCred && (
                  <p className="text-xs text-muted-foreground">No named credentials yet.</p>
                )}
                {credentials.map((cred) => (
                  <div
                    key={cred.id}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{cred.name}</p>
                      <p className="text-xs text-muted-foreground">{cred.sasl.mechanism} {cred.sasl.username && `· ${cred.sasl.username}`}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {broker?.activeCredentialID === cred.id && (
                        <UserCheck className="h-3.5 w-3.5 text-primary" aria-label="Active" />
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setCredDeleteTarget(cred)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}

                {addingCred ? (
                  <Form {...credForm}>
                    <form onSubmit={credForm.handleSubmit(handleAddCredential)} className="space-y-3 rounded-md border border-border p-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">New User</p>
                      <FormField
                        control={credForm.control}
                        name="credName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Name</FormLabel>
                            <FormControl>
                              <Input placeholder="admin" className="h-8 text-sm" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={credForm.control}
                        name="credMechanism"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Mechanism</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="PLAIN">PLAIN</SelectItem>
                                <SelectItem value="SCRAM-SHA-256">SCRAM-SHA-256</SelectItem>
                                <SelectItem value="SCRAM-SHA-512">SCRAM-SHA-512</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={credForm.control}
                        name="credUsername"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Username</FormLabel>
                            <FormControl>
                              <Input className="h-8 text-sm" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={credForm.control}
                        name="credPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Password <span className="text-muted-foreground">(stored in keychain)</span></FormLabel>
                            <FormControl>
                              <Input type="password" className="h-8 text-sm" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {credForm.formState.errors.root && (
                        <p className="text-xs text-destructive">{credForm.formState.errors.root.message}</p>
                      )}
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" disabled={credForm.formState.isSubmitting}>
                          {credForm.formState.isSubmitting && <Loader2 className="animate-spin" />}
                          Add
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => { setAddingCred(false); credForm.reset() }}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </Form>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-full text-xs"
                    onClick={() => setAddingCred(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add User
                  </Button>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <ConnectionFormFields
                  form={form}
                  saslMechanism={saslMechanism}
                  isOAuth={isOAuth}
                  isClientCredentials={isClientCredentials}
                />
                {form.formState.errors.root && (
                  <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
                )}
                <DialogFooter>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
                    Add Broker
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete credential confirmation */}
      <AlertDialog open={Boolean(credDeleteTarget)} onOpenChange={(v) => !v && setCredDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Delete user "{credDeleteTarget?.name}"? Their keychain password will also be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => credDeleteTarget && handleDeleteCredential(credDeleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface ConnectionFormProps {
  form: ReturnType<typeof useForm<FormValues>>
  isEdit: boolean
  saslMechanism: string
  isOAuth: boolean
  isClientCredentials: boolean
  testing: boolean
  testResult: string | null
  onTest: () => void
  onSubmit: (values: FormValues) => void
}

function ConnectionForm({ form, isEdit, saslMechanism, isOAuth, isClientCredentials, testing, testResult, onTest, onSubmit }: ConnectionFormProps) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
        <ConnectionFormFields
          form={form}
          saslMechanism={saslMechanism}
          isOAuth={isOAuth}
          isClientCredentials={isClientCredentials}
        />
        {form.formState.errors.root && (
          <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
        )}
        {testResult && (
          <p className={testResult.startsWith('✓') ? 'text-sm text-green-500' : 'text-sm text-destructive'}>
            {testResult}
          </p>
        )}
        <DialogFooter className="gap-2">
          {isEdit && (
            <Button type="button" variant="outline" size="sm" onClick={onTest} disabled={testing}>
              {testing && <Loader2 className="animate-spin" />}
              Test Connection
            </Button>
          )}
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
            {isEdit ? 'Save' : 'Add Broker'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}

interface ConnectionFormFieldsProps {
  form: ReturnType<typeof useForm<FormValues>>
  saslMechanism: string
  isOAuth: boolean
  isClientCredentials: boolean
}

function ConnectionFormFields({ form, saslMechanism, isOAuth, isClientCredentials }: ConnectionFormFieldsProps) {
  return (
    <>
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input placeholder="kafka-prod" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="addresses"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Bootstrap Servers</FormLabel>
            <FormControl>
              <Input placeholder="broker1:9092, broker2:9092" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <Separator />
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Authentication
      </p>

      <FormField
        control={form.control}
        name="saslMechanism"
        render={({ field }) => (
          <FormItem>
            <FormLabel>SASL Mechanism</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                <SelectItem value="PLAIN">PLAIN</SelectItem>
                <SelectItem value="SCRAM-SHA-256">SCRAM-SHA-256</SelectItem>
                <SelectItem value="SCRAM-SHA-512">SCRAM-SHA-512</SelectItem>
                <SelectItem value="OAUTHBEARER">OAUTHBEARER</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {saslMechanism !== '__none__' && !isOAuth && (
        <>
          <FormField
            control={form.control}
            name="saslUsername"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="saslPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Password{' '}
                  <span className="text-muted-foreground">(stored in keychain)</span>
                </FormLabel>
                <FormControl>
                  <Input type="password" placeholder="leave blank to keep existing" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}

      {isOAuth && (
        <>
          <FormField
            control={form.control}
            name="oauthTokenURL"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Token URL{' '}
                  <span className="text-muted-foreground">(optional — leave blank for static token)</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="https://auth.example.com/oauth/token" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {isClientCredentials && (
            <>
              <FormField
                control={form.control}
                name="oauthClientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client ID</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="oauthScopes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Scopes{' '}
                      <span className="text-muted-foreground">(space-separated, optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="kafka openid" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}
          <FormField
            control={form.control}
            name="saslPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {isClientCredentials ? 'Client Secret' : 'Bearer Token'}{' '}
                  <span className="text-muted-foreground">(stored in keychain)</span>
                </FormLabel>
                <FormControl>
                  <Input type="password" placeholder="leave blank to keep existing" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}

      <Separator />
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Schema Registry
      </p>

      <FormField
        control={form.control}
        name="srUrl"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              URL{' '}
              <span className="text-muted-foreground">(optional — enables Avro decoding)</span>
            </FormLabel>
            <FormControl>
              <Input placeholder="http://localhost:8081" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {form.watch('srUrl').trim() && (
        <>
          <FormField
            control={form.control}
            name="srUsername"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username <span className="text-muted-foreground">(optional)</span></FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="srPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Password{' '}
                  <span className="text-muted-foreground">(stored in keychain)</span>
                </FormLabel>
                <FormControl>
                  <Input type="password" placeholder="leave blank to keep existing" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}
    </>
  )
}
