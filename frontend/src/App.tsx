import { ErrorBoundary } from './app/error-boundary'
import { Providers } from './app/providers'
import { Router } from './app/router'

export default function App() {
  return (
    <ErrorBoundary>
      <div className="flex flex-1 flex-col min-h-0">
        <Providers>
          <Router />
        </Providers>
      </div>
    </ErrorBoundary>
  )
}
