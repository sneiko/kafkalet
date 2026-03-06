import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'

import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Form } from '@/shared/ui/form'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/ui/tabs'

import {
  AddBroker,
  UpdateBroker,
  SetSchemaRegistryPassword,
  TestBrokerConnection,
  TestConnectionDirect,
  AddBrokerCredential,
  SetNamedCredentialPassword,
  SwitchBrokerCredential,
  type profile,
} from '@shared/api'
import { useProfileStore, type Broker, type NamedCredential } from '@entities/profile'

import { buildSchema, buildTestParams, type FormValues } from '../lib/schemas'
import { useConnectionTest } from '../lib/use-connection-test'
import { ConnectionFields } from './ConnectionFields'
import { InitialCredentialFields } from './InitialCredentialFields'
import { UsersTab } from './UsersTab'

interface Props {
  profileId: string
  broker?: Broker
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function BrokerFormDialog({ profileId, broker, open, onOpenChange }: Props) {
  const isEdit = Boolean(broker)
  const [autoTesting, setAutoTesting] = useState(false)
  const editTest = useConnectionTest()
  const addTest = useConnectionTest()
  const { upsertProfile, profiles } = useProfileStore()

  const form = useForm<FormValues>({
    resolver: zodResolver(buildSchema(isEdit)),
    defaultValues: {
      name: broker?.name ?? '',
      addresses: broker?.addresses.join(', ') ?? '',
      tlsEnabled: broker?.tls.enabled ?? false,
      srUrl: broker?.schemaRegistry?.url ?? '',
      srUsername: broker?.schemaRegistry?.username ?? '',
      srPassword: '',
      initialCredName: '',
      initialCredMechanism: 'PLAIN',
      initialCredUsername: '',
      initialCredPassword: '',
      initialCredOAuthTokenURL: '',
      initialCredOAuthClientId: '',
      initialCredOAuthScopes: '',
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        name: broker?.name ?? '',
        addresses: broker?.addresses.join(', ') ?? '',
        tlsEnabled: broker?.tls.enabled ?? false,
        srUrl: broker?.schemaRegistry?.url ?? '',
        srUsername: broker?.schemaRegistry?.username ?? '',
        srPassword: '',
        initialCredName: '',
        initialCredMechanism: 'PLAIN',
        initialCredUsername: '',
        initialCredPassword: '',
        initialCredOAuthTokenURL: '',
        initialCredOAuthClientId: '',
        initialCredOAuthScopes: '',
      })
      editTest.resetResult()
      addTest.resetResult()
      setAutoTesting(false)
    }
  }, [open, broker])

  const onSubmit = async (values: FormValues) => {
    // Auto-test connection before saving in add mode
    if (!isEdit) {
      setAutoTesting(true)
      const params = buildTestParams(values)
      const ok = await addTest.runTest(() =>
        TestConnectionDirect(params.addresses, params.tls, params.sasl, params.password)
      )
      setAutoTesting(false)
      if (!ok) return
    }

    const addresses = values.addresses.split(',').map((s) => s.trim()).filter(Boolean)
    const brokerData: Broker = {
      id: broker?.id ?? '',
      name: values.name,
      addresses,
      sasl: { mechanism: '', username: '' },
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

      if (values.srPassword) {
        await SetSchemaRegistryPassword(profileId, savedBroker.id, values.srPassword)
      }

      // Add initial credential for new brokers
      if (!isEdit && values.initialCredName.trim()) {
        const mechanism = values.initialCredMechanism
        const isOAuth = mechanism === 'OAUTHBEARER'
        const newCred = await AddBrokerCredential(profileId, savedBroker.id, {
          id: '',
          name: values.initialCredName.trim(),
          sasl: isOAuth
            ? {
                mechanism: 'OAUTHBEARER',
                username: '',
                oauthTokenURL: values.initialCredOAuthTokenURL,
                oauthClientID: values.initialCredOAuthClientId,
                oauthScopes: values.initialCredOAuthScopes.split(' ').filter(Boolean),
              }
            : {
                mechanism,
                username: values.initialCredUsername,
                oauthTokenURL: '',
                oauthClientID: '',
                oauthScopes: [],
              },
        } as unknown as profile.NamedCredential) as unknown as NamedCredential

        if (values.initialCredPassword) {
          await SetNamedCredentialPassword(profileId, savedBroker.id, newCred.id, values.initialCredPassword)
        }

        await SwitchBrokerCredential(profileId, savedBroker.id, newCred.id)
        savedBroker = { ...savedBroker, credentials: [newCred], activeCredentialID: newCred.id }
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
    await editTest.runTest(() => TestBrokerConnection(profileId, broker.id))
  }

  const handleTestDirect = async () => {
    const values = form.getValues()
    const params = buildTestParams(values)
    if (params.addresses.length === 0) return
    await addTest.runTest(() => TestConnectionDirect(params.addresses, params.tls, params.sasl, params.password))
  }

  const storeProfile = profiles.find((p) => p.id === profileId)
  const storeBroker = storeProfile?.brokers.find((b) => b.id === broker?.id)
  const credentials = storeBroker?.credentials ?? broker?.credentials ?? []
  const activeCredentialID = storeBroker?.activeCredentialID ?? broker?.activeCredentialID

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Broker' : 'Add Broker'}</DialogTitle>
        </DialogHeader>

        {isEdit ? (
          <Tabs defaultValue="connection" className="flex flex-col flex-1 min-h-0">
            <TabsList className="w-full shrink-0">
              <TabsTrigger value="connection" className="flex-1">Connection</TabsTrigger>
              <TabsTrigger value="users" className="flex-1">
                Users {credentials.length > 0 && <span className="ml-1 text-xs text-muted-foreground">({credentials.length})</span>}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="connection" className="flex-1 overflow-y-auto min-h-0 mt-2">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <ConnectionFields form={form} />
                  {form.formState.errors.root && (
                    <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
                  )}
                  {editTest.testResult && (
                    <p className={editTest.testResult.startsWith('Connection') ? 'text-sm text-green-500' : 'text-sm text-destructive'}>
                      {editTest.testResult}
                    </p>
                  )}
                  <DialogFooter className="gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={handleTest} disabled={editTest.testing}>
                      {editTest.testing && <Loader2 className="animate-spin" />}
                      Test Connection
                    </Button>
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                      {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
                      Save
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="users" className="flex-1 overflow-y-auto min-h-0 mt-2">
              <UsersTab
                profileId={profileId}
                broker={broker!}
                credentials={credentials}
                activeCredentialID={activeCredentialID}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto space-y-4 px-1 min-h-0">
                <ConnectionFields form={form} />
                <InitialCredentialFields form={form} />

                {form.formState.errors.root && (
                  <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
                )}
                {addTest.testResult && (
                  <p className={addTest.testResult === 'Connection successful' ? 'text-sm text-green-500' : 'text-sm text-destructive'}>
                    {addTest.testResult}
                  </p>
                )}
              </div>
              <DialogFooter className="gap-2 pt-4 shrink-0">
                <Button type="button" variant="outline" size="sm" onClick={handleTestDirect} disabled={addTest.testing}>
                  {addTest.testing && <Loader2 className="animate-spin" />}
                  Test Connection
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting || autoTesting}>
                  {(form.formState.isSubmitting || autoTesting) && <Loader2 className="animate-spin" />}
                  {autoTesting ? 'Testing...' : 'Add Broker'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
