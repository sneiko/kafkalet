import { type UseFormReturn } from 'react-hook-form'

import {
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

import { type FormValues } from '../lib/schemas'

interface InitialCredentialFieldsProps {
  form: UseFormReturn<FormValues>
}

export function InitialCredentialFields({ form }: InitialCredentialFieldsProps) {
  const mechanism = form.watch('initialCredMechanism')
  const isOAuth = mechanism === 'OAUTHBEARER'
  const oauthTokenURL = form.watch('initialCredOAuthTokenURL')
  const isClientCreds = isOAuth && oauthTokenURL.trim() !== ''

  return (
    <>
      <Separator />
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        User
      </p>

      <FormField
        control={form.control}
        name="initialCredName"
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
        name="initialCredMechanism"
        render={({ field }) => (
          <FormItem>
            <FormLabel>SASL Mechanism</FormLabel>
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
            name="initialCredUsername"
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
            name="initialCredPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Password{' '}
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

      {isOAuth && (
        <>
          <FormField
            control={form.control}
            name="initialCredOAuthTokenURL"
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
                name="initialCredOAuthClientId"
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
                name="initialCredOAuthScopes"
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
            name="initialCredPassword"
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
    </>
  )
}
