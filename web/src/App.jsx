import { useEffect, useState } from 'react';
import './styles.css';

function joinUrl(base, path) {
  const trimmedBase = (base || '').replace(/\/+$/, '');
  const trimmedPath = String(path || '').replace(/^\/+/, '');
  if (!trimmedBase) return `/${trimmedPath}`;
  return `${trimmedBase}/${trimmedPath}`;
}

export function App() {
  const [health, setHealth] = useState({ status: 'loading' });
  const [error, setError] = useState(null);

  const apiBase = process.env.API_BASE_URL || '';
  const healthUrl = joinUrl(apiBase, 'api/health/');

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const res = await fetch(healthUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setHealth(json);
      } catch (e) {
        if (!cancelled) setError(e);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="container">
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Beebol (React + Webpack)</h1>
        <div className="row">
          <span className="badge">Web: http://localhost:3000</span>
          <span className="badge">Health: {healthUrl}</span>
        </div>

        <hr style={{ border: 0, borderTop: '1px solid #e6e8ee', margin: '16px 0' }} />

        <h2 style={{ margin: '0 0 8px' }}>Backend Health</h2>
        {error ? (
          <div>
            <div>Failed to reach backend.</div>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{String(error.message || error)}</pre>
          </div>
        ) : (
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(health, null, 2)}</pre>
        )}
      </div>
    </div>
  );
}
