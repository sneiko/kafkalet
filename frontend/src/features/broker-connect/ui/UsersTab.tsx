import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Trash2, Plus, UserCheck } from 'lucide-react'

import { Button } from '@/shared/ui/button'
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
  AddBrokerCredential,
  DeleteBrokerCredential,
  SetNamedCredentialPassword,
  TestConnectionDirect,
  type profile,
} from '@shared/api'
import { useProfileStore, type Broker, type NamedCredential } from '@entities/profile'
import { credSchema, type CredFormValues } from '../lib/schemas'
import { useConnectionTest } from '../lib/use-connection-test'

interface UsersTabProps {
  profileId: string
  broker: Broker
  credentials: NamedCredential[]
  activeCredentialID?: string
}

export function UsersTab({ profileId, broker, credentials, activeCredentialID }: UsersTabProps) {
  const [addingCred, setAddingCred] = useState(false)
  const [credDeleteTarget, setCredDeleteTarget] = useState<NamedCredential | null>(null)
  const { upsertProfile, profiles } = useProfileStore()
  const credTest = useConnectionTest()

  const credForm = useForm<CredFormValues>({
    resolver: zodResolver(credSchema),
    defaultValues: {
      credName: '',
      credMechanism: 'PLAIN',
      credUsername: '',
      credPassword: '',
    },
  })

  const handleCredTest = async () => {
    const values = credForm.getValues()
    await credTest.runTest(() =>
      TestConnectionDirect(
        broker.addresses,
        broker.tls as unknown as profile.TLSConfig,
        { mechanism: values.credMechanism, username: values.credUsername, oauthTokenURL: '', oauthClientID: '', oauthScopes: [] } as unknown as profile.SASLConfig,
        values.credPassword
      )
    )
  }

  const handleAddCredential = async (values: CredFormValues) => {
    // Auto-test before saving
    const ok = await credTest.runTest(() =>
      TestConnectionDirect(
        broker.addresses,
        broker.tls as unknown as profile.TLSConfig,
        { mechanism: values.credMechanism, username: values.credUsername, oauthTokenURL: '', oauthClientID: '', oauthScopes: [] } as unknown as profile.SASLConfig,
        values.credPassword
      )
    )
    if (!ok) return

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
      credTest.resetResult()
    } catch (err) {
      credForm.setError('root', { message: String(err) })
    }
  }

  const handleDeleteCredential = async (cred: NamedCredential) => {
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

  return (
    <>
      <div className="space-y-3">
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
              {activeCredentialID === cred.id && (
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
              {credTest.testResult && (
                <p className={credTest.testResult === 'Connection successful' ? 'text-xs text-green-500' : 'text-xs text-destructive'}>
                  {credTest.testResult}
                </p>
              )}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={credForm.formState.isSubmitting || credTest.testing}>
                  {(credForm.formState.isSubmitting || credTest.testing) && <Loader2 className="animate-spin" />}
                  {credTest.testing ? 'Testing...' : 'Add'}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleCredTest} disabled={credTest.testing}>
                  Test
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setAddingCred(false); credForm.reset(); credTest.resetResult() }}>
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
      </div>

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
