import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100%', background: '#0a0a0a', color: '#ececec',
          fontFamily: 'Inter, sans-serif', padding: '40px', flexDirection: 'column', gap: '16px'
        }}>
          <h2 style={{ margin: 0 }}>Something went wrong</h2>
          <pre style={{ color: '#ff6b6b', fontSize: '13px', maxWidth: '600px', overflow: 'auto' }}>
            {this.state.error?.message}
          </pre>
          <button onClick={() => window.location.reload()} style={{
            padding: '8px 20px', background: '#10a37f', color: 'white',
            border: 'none', borderRadius: '8px', cursor: 'pointer'
          }}>
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}