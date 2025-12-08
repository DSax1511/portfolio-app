import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-page)',
          color: 'var(--text-primary)',
          padding: '2rem'
        }}>
          <div style={{
            maxWidth: '600px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '2rem',
            boxShadow: 'var(--shadow-lg)',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '3rem',
              marginBottom: '1rem'
            }}>⚠️</div>
            <h1 style={{
              margin: '0 0 1rem',
              fontSize: '1.5rem',
              fontWeight: '700'
            }}>Something went wrong</h1>
            <p style={{
              margin: '0 0 1.5rem',
              color: 'var(--text-secondary)',
              lineHeight: '1.6'
            }}>
              An unexpected error occurred in Saxton PI. This has been logged and will be investigated.
            </p>
            {this.state.error && (
              <details style={{
                marginBottom: '1.5rem',
                textAlign: 'left',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem'
              }}>
                <summary style={{
                  cursor: 'pointer',
                  fontWeight: '600',
                  marginBottom: '0.5rem',
                  color: 'var(--accent-red)'
                }}>Error details</summary>
                <pre style={{
                  margin: '0.5rem 0 0',
                  fontSize: '0.85rem',
                  overflow: 'auto',
                  color: 'var(--text-secondary)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
            <button
              onClick={this.handleReload}
              className="btn btn-primary"
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '1rem'
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
