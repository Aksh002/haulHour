import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@mui/material'

interface Props {
  children: ReactNode
}
interface State {
  failed: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('HaulHour interface error', { message: error.message, componentStack: info.componentStack })
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="fatal-error" role="alert">
          <span className="eyebrow">Something went wrong</span>
          <h1>The planner interface could not continue.</h1>
          <p>Your trip has not been submitted again. Reload the page to start from a clean state.</p>
          <Button variant="contained" onClick={() => window.location.reload()}>
            Reload HaulHour
          </Button>
        </main>
      )
    }
    return this.props.children
  }
}
