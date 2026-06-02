import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app-container">
          <div className="glass-card" style={{ textAlign: 'center', padding: '2rem' }}>
            <h2 style={{ color: 'var(--accent-danger)', marginBottom: '1rem' }}>
              Something went wrong
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              {this.state.error.message}
            </p>
            <button className="btn" onClick={() => window.location.reload()}>
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
