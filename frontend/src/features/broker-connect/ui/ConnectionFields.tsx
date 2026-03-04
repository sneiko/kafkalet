import { type UseFormReturn } from 'react-hook-form'

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/ui/form'
import { Input } from '@/shared/ui/input'
import { Separator } from '@/shared/ui/separator'

import { type FormValues } from '../lib/schemas'

interface ConnectionFieldsProps {
  form: UseFormReturn<FormValues>
}

export function ConnectionFields({ form }: ConnectionFieldsProps) {
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
        TLS
      </p>

      <FormField
        control={form.control}
        name="tlsEnabled"
        render={({ field }) => (
          <FormItem className="flex items-center gap-2">
            <FormControl>
              <input
                type="checkbox"
                checked={field.value}
                onChange={field.onChange}
                className="h-4 w-4 rounded border-border"
              />
            </FormControl>
            <FormLabel className="!mt-0">Enable TLS</FormLabel>
          </FormItem>
        )}
      />

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
