import { useEffect, useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Plus, X } from 'lucide-react'

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

import {
  AddBrokerCredential,
  SetNamedCredentialPassword,
  TestConnectionDirect,
  type profile,
} from '@shared/api'
import { useProfileStore, type NamedCredential } from '@entities/profile'

const schema = z.object({
  name: z.string().min(1, 'Required'),
  mechanism: z.string(),
  username: z.string(),
  password: z.string(),
  oauthTokenURL: z.string(),
  oauthClientId: z.string(),
  oauthScopes: z.string(),
  oauthExtensions: z.array(z.object({ key: z.string(), value: z.string() })),
})

type FormValues = z.infer<typeof schema>

interface Props {
  profileId: string
  brokerId: string
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function CredentialFormDialog({ profileId, brokerId, open, onOpenChange }: Props) {
  const { upsertProfile, profiles } = useProfileStore()
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [autoTesting, setAutoTesting] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      mechanism: 'PLAIN',
      username: '',
      password: '',
      oauthTokenURL: '',
      oauthClientId: '',
      oauthScopes: '',
      oauthExtensions: [],
    },
  })

  useEffect(() => {
    if (open) {
      form.reset()
      setTestResult(null)
      setAutoTesting(false)
    }
  }, [open])

  const mechanism = form.watch('mechanism')
  const isOAuth = mechanism === 'OAUTHBEARER'
  const oauthTokenURL = form.watch('oauthTokenURL')
  const isClientCreds = isOAuth && oauthTokenURL.trim() !== ''
  const { fields: extFields, append: appendExt, remove: removeExt } = useFieldArray({
    control: form.control,
    name: 'oauthExtensions',
  })

  const currentBroker = profiles
    .find((p) => p.id === profileId)
    ?.brokers.find((b) => b.id === brokerId)

  const buildSaslConfig = (values: FormValues) => {
    const extensions = Object.fromEntries(
      values.oauthExtensions.filter(e => e.key.trim()).map(e => [e.key.trim(), e.value])
    )
    return values.mechanism === 'OAUTHBEARER'
      ? {
          mechanism: 'OAUTHBEARER',
          username: '',
          oauthTokenURL: values.oauthTokenURL,
          oauthClientID: values.oauthClientId,
          oauthScopes: values.oauthScopes.split(' ').filter(Boolean),
          oauthExtensions: extensions,
        } as unknown as profile.SASLConfig
      : {
          mechanism: values.mechanism,
          username: values.username,
          oauthTokenURL: '',
          oauthClientID: '',
          oauthScopes: [],
          oauthExtensions: {},
        } as unknown as profile.SASLConfig
  }

  const handleTest = async () => {
    if (!currentBroker) return
    const values = form.getValues()
    setTesting(true)
    setTestResult(null)
    try {
      await TestConnectionDirect(
        currentBroker.addresses,
        currentBroker.tls as unknown as profile.TLSConfig,
        buildSaslConfig(values),
        values.password
      )
      setTestResult('Connection successful')
    } catch (err) {
      setTestResult(String(err))
    } finally {
      setTesting(false)
    }
  }

  const onSubmit = async (values: FormValues) => {
    if (!currentBroker) return

    const sasl = buildSaslConfig(values)

    // Auto-test before saving
    setAutoTesting(true)
    setTestResult(null)
    try {
      await TestConnectionDirect(
        currentBroker.addresses,
        currentBroker.tls as unknown as profile.TLSConfig,
        sasl,
        values.password
      )
    } catch (err) {
      setTestResult(String(err))
      setAutoTesting(false)
      return
    }
    setAutoTesting(false)

    try {
      const newCred = await AddBrokerCredential(profileId, brokerId, {
        id: '',
        name: values.name,
        sasl,
      } as unknown as profile.NamedCredential) as unknown as NamedCredential

      if (values.password) {
        await SetNamedCredentialPassword(profileId, brokerId, newCred.id, values.password)
      }

      const currentProfile = profiles.find((p) => p.id === profileId)
      if (currentProfile) {
        const updatedBrokers = currentProfile.brokers.map((b) =>
          b.id === brokerId
            ? { ...b, credentials: [...(b.credentials ?? []), newCred] }
            : b
        )
        upsertProfile({ ...currentProfile, brokers: updatedBrokers })
      }

      onOpenChange(false)
    } catch (err) {
      form.setError('root', { message: String(err) })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add User</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="admin" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="mechanism"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mechanism</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
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
            {!isOAuth && (
              <>
                <FormField
                  control={form.control}
                  name="username"
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
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password <span className="text-muted-foreground">(stored in keychain)</span></FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
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
                {isClientCreds && (
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
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          Extensions{' '}
                          <span className="text-muted-foreground font-normal">(optional)</span>
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => appendExt({ key: '', value: '' })}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add
                        </Button>
                      </div>
                      {extFields.map((ef, idx) => (
                        <div key={ef.id} className="flex gap-2 items-start">
                          <FormField
                            control={form.control}
                            name={`oauthExtensions.${idx}.key`}
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormControl>
                                  <Input placeholder="key" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`oauthExtensions.${idx}.value`}
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormControl>
                                  <Input placeholder="value" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => removeExt(idx)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {isClientCreds ? 'Client Secret' : 'Bearer Token'}{' '}
                        <span className="text-muted-foreground">(stored in keychain)</span>
                      </FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
            {form.formState.errors.root && (
              <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
            )}
            {testResult && (
              <p className={testResult === 'Connection successful' ? 'text-sm text-green-500' : 'text-sm text-destructive'}>
                {testResult}
              </p>
            )}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleTest} disabled={testing || !currentBroker}>
                {testing && <Loader2 className="animate-spin" />}
                Test Connection
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting || autoTesting}>
                {(form.formState.isSubmitting || autoTesting) && <Loader2 className="animate-spin" />}
                {autoTesting ? 'Testing...' : 'Add'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
