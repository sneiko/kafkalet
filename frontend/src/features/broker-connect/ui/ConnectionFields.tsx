import { type UseFormReturn } from 'react-hook-form'
import { FolderOpen, X } from 'lucide-react'

import { SelectCertificateFile } from '@shared/api'
import { Button } from '@/shared/ui/button'
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

      {form.watch('tlsEnabled') && (
        <div className="space-y-3 pl-3 border-l-2 border-muted">
          <CertPathField form={form} name="tlsCaCertPath" label="CA Certificate" />
          <CertPathField form={form} name="tlsClientCertPath" label="Client Certificate" />
          <CertPathField form={form} name="tlsClientKeyPath" label="Client Key" />

          <FormField
            control={form.control}
            name="tlsInsecureSkipVerify"
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
                <FormLabel className="!mt-0">Skip certificate verification</FormLabel>
              </FormItem>
            )}
          />
          {form.watch('tlsInsecureSkipVerify') && (
            <p className="text-xs text-amber-500">
              Warning: Disabling certificate verification is insecure and should only be used for development.
            </p>
          )}
        </div>
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

function CertPathField({
  form,
  name,
  label,
}: {
  form: UseFormReturn<FormValues>
  name: 'tlsCaCertPath' | 'tlsClientCertPath' | 'tlsClientKeyPath'
  label: string
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label} <span className="text-muted-foreground">(optional)</span>
          </FormLabel>
          <div className="flex gap-1">
            <FormControl>
              <Input
                readOnly
                placeholder="No file selected"
                value={field.value}
                className="flex-1 text-xs truncate"
              />
            </FormControl>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={async () => {
                const path = await SelectCertificateFile()
                if (path) field.onChange(path)
              }}
            >
              <FolderOpen className="h-4 w-4" />
            </Button>
            {field.value && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => field.onChange('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </FormItem>
      )}
    />
  )
}
