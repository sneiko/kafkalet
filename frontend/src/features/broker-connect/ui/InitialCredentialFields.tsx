import { type UseFormReturn, useFieldArray } from 'react-hook-form'
import { Plus, X } from 'lucide-react'

import { Button } from '@/shared/ui/button'
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
  const { fields: extFields, append: appendExt, remove: removeExt } = useFieldArray({
    control: form.control,
    name: 'initialCredOAuthExtensions',
  })

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
                      name={`initialCredOAuthExtensions.${idx}.key`}
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
                      name={`initialCredOAuthExtensions.${idx}.value`}
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
