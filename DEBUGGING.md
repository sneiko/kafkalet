# Wails App Debugging Guide

## Quick Start

### Development Mode (Recommended)
```bash
# Windows PowerShell
$env:PATH = "C:\Program Files\Go\bin;" + $env:PATH
wails dev
```

This starts:
- **Wails dev server** on `http://localhost:34115` (for Go-RPC calls from browser)
- **Vite dev server** on `http://localhost:5173` (for frontend)
- Hot reload on file changes

## Debugging Tools

### 1. Browser DevTools (Frontend)

When running `wails dev`, open browser DevTools:
- **F12** or **Ctrl+Shift+I**
- Navigate to `http://localhost:34115`

**Features:**
- Console logs from React components
- Network tab for RPC calls to Go
- React DevTools for component state inspection
- Source maps for TypeScript debugging

**Install React DevTools:**
- Chrome: https://chrome.google.com/webstore (search "React Developer Tools")
- Edge: Same as Chrome (Chromium-based)

### 2. Go Debugger (Backend)

**Using IntelliJ IDEA / GoLand:**
1. Open project in IDE
2. Set breakpoints in `.go` files
3. Run "Debug" configuration for `main.go`
4. Or attach to running process

**Using VS Code:**
1. Install "Go" extension (golang.go)
2. Set breakpoints in `.go` files
3. Press F5 to start debugging
4. Use `launch.json` configuration:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch Wails Dev",
      "type": "go",
      "request": "launch",
      "mode": "debug",
      "program": "${workspaceFolder}",
      "args": ["dev"]
    }
  ]
}
```

### 3. Wails Logger

Add logging in Go code:
```go
import "log/slog"

func (a *App) SomeMethod() {
  slog.Info("method called", "param", value)
  // ...
}
```

Logs appear in:
- Console where `wails dev` is running
- Windows Event Viewer (for production builds)

### 4. Runtime Events

Wails events for frontend-backend communication:
```javascript
// Frontend - listen for events
import { EventsOn, EventsOff } from '@wails/runtime/runtime'

useEffect(() => {
  EventsOn('broker:credential-switched', (data) => {
    console.log('Credential switched:', data)
  })
  
  return () => {
    EventsOff('broker:credential-switched')
  }
}, [])
```

```go
// Backend - emit events
runtime.EventsEmit(a.ctx, "broker:credential-switched", data)
```

### 5. Console Logging

**Frontend (React/TypeScript):**
```typescript
console.log('Debug info:', variable)
console.error('Error:', error)
console.trace('Stack trace')
```

**Backend (Go):**
```go
import "log/slog"

slog.Debug("debug message", "key", value)
slog.Info("info message")
slog.Error("error", "err", err)
slog.Warn("warning")
```

## Common Issues

### TLS/Truststore Issues

**Problem:** Connection fails with TLS error

**Debug steps:**
1. Check if Java/keytool or OpenSSL is installed:
   ```bash
   keytool -version
   openssl version
   ```

2. Verify truststore file path is correct

3. Check truststore password

4. Look at Go logs for conversion errors:
   ```
   convert truststore: keytool list: exit status 1
   ```

### SASL Authentication Issues

**Problem:** SCRAM-SHA-512 authentication fails

**Debug steps:**
1. Verify username/password in keychain
2. Check SASL mechanism name matches exactly: `SCRAM-SHA-512`
3. Test connection with Offset Explorer using same credentials
4. Check broker logs for authentication errors

### Frontend Form Errors

**Problem:** `useFormField should be used within <FormField>`

**Solution:**
- Ensure all form inputs are wrapped in `<FormField>` component
- Don't use `<FormControl>` outside of `<FormField>`
- Use `form.watch()` for read-only fields

**Example:**
```tsx
// ❌ Wrong
<FormControl>
  <Input value={form.watch('field')} />
</FormControl>

// ✅ Correct
<Input value={form.watch('field')} />

// ✅ Correct with FormField
<FormField
  control={form.control}
  name="field"
  render={({ field }) => (
    <FormItem>
      <FormControl>
        <Input {...field} />
      </FormControl>
    </FormItem>
  )}
/>
```

## Performance Profiling

### Frontend

1. Open Chrome DevTools → Performance tab
2. Click "Record"
3. Perform action in app
4. Stop recording
5. Analyze flame chart for bottlenecks

### Backend

```bash
# Enable Go profiler
go tool pprof http://localhost:6060/debug/pprof/profile
```

## Production Debugging

For production builds, enable verbose logging:

```bash
wails build -ldflags "-X main.debug=true"
```

Then check logs in:
- **Windows:** Event Viewer → Applications and Services Logs
- **macOS:** Console.app
- **Linux:** `journalctl` or `/var/log/syslog`

## Useful Commands

```bash
# Check Go version
go version

# Check Wails version
wails version

# Clean build
wails build -clean

# Development with verbose output
wails dev -v

# Regenerate TypeScript bindings
wails generate module

# Run frontend tests
cd frontend && npm test

# TypeScript type checking
cd frontend && npx tsc --noEmit
```

## Resources

- **Wails Docs:** https://wails.io/docs/
- **React Hook Form:** https://reacthookform.com/
- **franz-go (Kafka client):** https://github.com/twmb/franz-go
- **Go Debugging:** https://go.dev/doc/debug