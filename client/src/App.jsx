import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/* --- Modern Vector SVG Icons --- */
const BrandLogoIcon = () => (
  <svg className="logo-svg" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const IssueIcon = () => (
  <svg className="icon-badge-svg" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="2.5" />
  </svg>
);

const PRIcon = () => (
  <svg className="icon-badge-svg" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <circle cx="18" cy="18" r="3" />
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M18 15V9a4 4 0 00-4-4H9M6 9v6" />
  </svg>
);

const WebhookIcon = () => (
  <svg className="icon-badge-svg" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 5h10a2 2 0 012 2v10a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2z" />
  </svg>
);

const CopyIcon = () => (
  <svg className="copy-btn-svg" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 002-2h2a2 2 0 002 2m0 0h2a2 2 0 012 2v3" />
  </svg>
);

const CheckIcon = () => (
  <svg className="copy-btn-svg" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const CloseIcon = () => (
  <svg className="drawer-close-svg" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const EmptyStateIcon = () => (
  <svg className="empty-icon-svg" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
  </svg>
);

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [repos, setRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollIntervalRef = useRef(null);

  // 1. Detect URL Query Tokens (OAuth callback redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token');
    
    if (tokenFromUrl) {
      localStorage.setItem('token', tokenFromUrl);
      setToken(tokenFromUrl);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Reset copy state when active event swaps
  useEffect(() => {
    setCopied(false);
  }, [selectedEvent]);

  // 2. Decode user JWT payload
  useEffect(() => {
    if (token) {
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        setUser(JSON.parse(jsonPayload));
      } catch (err) {
        console.error('Invalid JWT token:', err);
        handleLogout();
      }
    }
  }, [token]);

  // 3. Fetch logs from backend database
  const fetchEventsList = async (showSpinner = false, targetRepo = selectedRepo) => {
    if (!token) return;
    if (showSpinner) setFetching(true);
    
    try {
      const url = targetRepo
        ? `${API_URL}/api/events?repo=${encodeURIComponent(targetRepo)}`
        : `${API_URL}/api/events`;

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setEvents(response.data);

      // Populate dropdown from database full names on initial load (or when filter is reset)
      if (!targetRepo) {
        const uniqueRepos = [...new Set(response.data.map((event) => event.repo_name))].filter(Boolean);
        setRepos(uniqueRepos);
      }
    } catch (err) {
      console.error('Failed to retrieve event logs:', err.message);
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleLogout();
      }
    } finally {
      if (showSpinner) setFetching(false);
    }
  };

  // 4. Setup polling mechanism
  useEffect(() => {
    if (token) {
      fetchEventsList(true);

      pollIntervalRef.current = setInterval(() => {
        fetchEventsList(false);
      }, 5000);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [token, selectedRepo]);

  const handleRepoChange = (e) => {
    const nextRepo = e.target.value;
    setSelectedRepo(nextRepo);
    fetchEventsList(true, nextRepo);
  };

  const handleLogin = () => {
    setLoading(true);
    window.location.href = `${API_URL}/auth/github`;
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setEvents([]);
    setSelectedEvent(null);
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
  };

  // Copy to clipboard utility
  const handleCopyPayload = () => {
    if (!selectedEvent) return;
    try {
      const rawText = typeof selectedEvent.payload === 'string'
        ? selectedEvent.payload
        : JSON.stringify(selectedEvent.payload, null, 2);
      navigator.clipboard.writeText(rawText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failure:', err);
    }
  };

  // Parse helper for payload summary info
  const parsePayloadInfo = (event) => {
    let repo = 'N/A';
    let summary = event.activitySummary || 'Webhook activity logged';
    
    try {
      const parsed = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload;
      repo = parsed.repository?.full_name || 'N/A';
      
      if (!event.activitySummary) {
        if (event.event_type === 'issues') {
          summary = `${parsed.action || 'updated'} issue: "${parsed.issue?.title || ''}"`;
        } else if (event.event_type === 'pull_request') {
          summary = `${parsed.action || 'updated'} PR: "${parsed.pull_request?.title || ''}"`;
        } else {
          summary = `${event.event_type} event triggered`;
        }
      }
    } catch (e) {
      if (!event.activitySummary) summary = 'Invalid JSON body';
    }

    return { repo, summary };
  };

  // Stats helpers
  const totalCount = events.length;
  const processedCount = events.filter((e) => e.status === 'processed').length;
  const failedCount = events.filter((e) => e.status === 'failed').length;

  const formatTime = (isoString) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="app-container">
      {token && user ? (
        /* Authenticated Dashboard View */
        <>
          <nav className="navbar">
            <div className="brand-section">
              <div className="logo-container">
                <BrandLogoIcon />
              </div>
              <span className="brand-title">gitsync</span>
            </div>
            <div className="user-badge">
              <span className="username-display">@{user.username}</span>
              <button className="btn-secondary" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </nav>

          <main className="dashboard-content">
            <div>
              <h2 className="section-title" style={{ marginBottom: '6px' }}>Integrations Dashboard</h2>
              <p style={{ color: 'var(--primary-muted)', fontSize: '0.85rem' }}>
                Monitor repository webhook dispatches, review AI-triaged categories, and verify delivery logs.
              </p>
            </div>

            {/* Statistics Grid */}
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-header">Total Deliveries</span>
                <span className="stat-number">{totalCount}</span>
              </div>
              <div className="stat-card" style={{ borderColor: 'rgba(48, 209, 88, 0.12)' }}>
                <span className="stat-header" style={{ color: 'var(--status-processed-text)' }}>Processed</span>
                <span className="stat-number" style={{ color: 'var(--status-processed-text)' }}>{processedCount}</span>
              </div>
              <div className="stat-card" style={{ borderColor: 'rgba(255, 69, 58, 0.12)' }}>
                <span className="stat-header" style={{ color: 'var(--status-failed-text)' }}>Failed</span>
                <span className="stat-number" style={{ color: 'var(--status-failed-text)' }}>{failedCount}</span>
              </div>
            </div>

            {/* Webhook Deliveries Table Panel */}
            <div className="table-panel">
              <div className="table-header-bar">
                <span className="table-title">Webhook Logs</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <select
                    className="select-filter"
                    value={selectedRepo}
                    onChange={handleRepoChange}
                    disabled={fetching}
                  >
                    <option value="">All Repositories</option>
                    {repos.map((repo) => (
                      <option key={repo} value={repo}>
                        {repo}
                      </option>
                    ))}
                  </select>
                  <button className="refresh-button" onClick={() => fetchEventsList(true)} disabled={fetching}>
                    {fetching ? 'Syncing...' : 'Sync Feed'}
                  </button>
                </div>
              </div>

              {events.length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Event Type</th>
                      <th>Repository</th>
                      <th>Activity Summary</th>
                      <th>Delivery ID</th>
                      <th>Status</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((event) => {
                      const { repo, summary } = parsePayloadInfo(event);
                      
                      const isIssue = event.event_type === 'issues';
                      const isPr = event.event_type === 'pull_request';

                      return (
                        <tr key={event.id} onClick={() => setSelectedEvent(event)}>
                          <td>
                            <div className="event-type-container">
                              <span className={`icon-svg-badge icon-${isIssue ? 'issues' : isPr ? 'pr' : 'other'}`}>
                                {isIssue ? <IssueIcon /> : isPr ? <PRIcon /> : <WebhookIcon />}
                                {event.event_type}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontWeight: '500', color: '#ffffff' }}>{repo}</span>
                          </td>
                          <td style={{ color: 'var(--primary-muted)' }}>{summary}</td>
                          <td>
                            <span className="id-pill">{event.github_delivery_id.slice(0, 8)}</span>
                          </td>
                          <td>
                            <span className={`status-badge status-${event.status}`}>
                              {event.status}
                            </span>
                          </td>
                          <td>
                            <span className="timestamp">{formatTime(event.created_at)}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state">
                  <EmptyStateIcon />
                  No Webhook deliveries logged yet. Configure your repository hooks to begin.
                </div>
              )}
            </div>
          </main>

          {/* Payload Inspector Side Drawer */}
          {selectedEvent && (
            <div className="drawer-overlay" onClick={() => setSelectedEvent(null)}>
              <div className="drawer" onClick={(e) => e.stopPropagation()}>
                <div className="drawer-header">
                  <span className="drawer-title">Webhook Payload Inspector</span>
                  <button className="drawer-close" onClick={() => setSelectedEvent(null)}>
                    <CloseIcon />
                  </button>
                </div>
                <div className="drawer-body">
                  <div className="drawer-meta-grid">
                    <span className="drawer-meta-label">Event Type:</span>
                    <span>
                      <span className={`icon-svg-badge icon-${selectedEvent.event_type === 'issues' ? 'issues' : selectedEvent.event_type === 'pull_request' ? 'pr' : 'other'}`}>
                        {selectedEvent.event_type === 'issues' ? <IssueIcon /> : selectedEvent.event_type === 'pull_request' ? <PRIcon /> : <WebhookIcon />}
                        {selectedEvent.event_type}
                      </span>
                    </span>

                    <span className="drawer-meta-label">Delivery ID:</span>
                    <span className="monospace drawer-meta-value">{selectedEvent.github_delivery_id}</span>

                    <span className="drawer-meta-label">Logged At:</span>
                    <span className="monospace drawer-meta-value">{new Date(selectedEvent.created_at).toLocaleString()}</span>

                    <span className="drawer-meta-label">Status:</span>
                    <span>
                      <span className={`status-badge status-${selectedEvent.status}`}>
                        {selectedEvent.status}
                      </span>
                    </span>
                  </div>

                  <div className="payload-section-header">
                    <span className="drawer-meta-label">Raw JSON Payload:</span>
                    <button className="copy-btn" onClick={handleCopyPayload}>
                      {copied ? <CheckIcon /> : <CopyIcon />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  
                  <div className="payload-container">
                    <pre>
                      <code>
                        {(() => {
                          try {
                            const parsed = typeof selectedEvent.payload === 'string'
                              ? JSON.parse(selectedEvent.payload)
                              : selectedEvent.payload;
                            return JSON.stringify(parsed, null, 2);
                          } catch (e) {
                            return typeof selectedEvent.payload === 'string'
                              ? selectedEvent.payload
                              : JSON.stringify(selectedEvent.payload, null, 2);
                          }
                        })()}
                      </code>
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Guest / Login View */
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', margin: '0 auto' }}>
          <div className="login-card">
            <div className="login-logo-container">
              <svg className="login-logo-svg" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="brand-title" style={{ fontSize: '1.45rem', marginBottom: '8px', color: '#ffffff' }}>gitsync</h1>
            <p style={{ color: 'var(--primary-muted)', fontSize: '0.85rem', marginBottom: '28px', lineHeight: '1.5' }}>
              Connect GitHub hooks, automatically analyze and triage issues, and dispatch alerts to Slack.
            </p>
            <button 
              className="btn-github" 
              onClick={handleLogin} 
              disabled={loading}
            >
              {loading ? 'Connecting...' : 'Login with GitHub'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
