import React from 'react'

interface State { error: Error | null }

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen items-center justify-center p-8 text-center">
          <div>
            <p className="text-sm font-medium text-destructive">Something went wrong</p>
            <p className="mt-1 text-xs text-muted-foreground">{this.state.error.message}</p>
            <button
              className="mt-4 text-xs underline text-muted-foreground"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
