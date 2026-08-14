import { useState, useEffect } from 'react'
import './index.css'
import AskSangamChat from './components/home.jsx'
import AskSangamHistory from './components/history.jsx'
import AskSangamProfile from './components/profile.jsx'
import { MessageCircle, History, User, Sparkles, LogOut } from 'lucide-react'

const TABS = [
  { key: 'chat',    label: 'Chat',    icon: MessageCircle },
  { key: 'history', label: 'History', icon: History },
  { key: 'profile', label: 'Profile', icon: User },
]

const c = {
  bg:             '#09090b',
  surfaceC:       '#121215',
  surfaceCHigh:   '#18181b',
  outlineVar:     '#27272a',
  onSurface:      '#fafafa',
  onSurfaceVar:   '#a1a1aa',
  primary:        '#a78bfa',
  secondary:      '#71717a',
}

export default function App() {
  const [activeTab, setActiveTab] = useState('chat')
  const [token, setToken] = useState(() => localStorage.getItem('authToken') || '')
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })
  const [activeSessionId, setActiveSessionId] = useState(null)

  useEffect(() => {
    if (token) {
      localStorage.setItem('authToken', token)
    } else {
      localStorage.removeItem('authToken')
    }
  }, [token])

  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user))
    } else {
      localStorage.removeItem('user')
    }
  }, [user])

  const handleLoginSuccess = (newToken, newUser) => {
    setToken(newToken)
    setUser(newUser)
    setActiveTab('chat')
  }

  const handleLogout = () => {
    setToken('')
    setUser(null)
    setActiveSessionId(null)
    localStorage.removeItem('authToken')
    localStorage.removeItem('user')
  }

  const handleSelectSession = (sessionId) => {
    setActiveSessionId(sessionId)
    setActiveTab('chat')
  }

  const handleNewSession = () => {
    setActiveSessionId(null)
    setActiveTab('chat')
  }

  return (
    <div className="app-shell">
      {/* ── Desktop Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Sparkles size={22} style={{ color: c.primary }} />
          Ask Sangam
        </div>

        {user && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              backgroundColor: c.surfaceCHigh,
              marginBottom: '12px',
              fontSize: '12px',
            }}
          >
            <div style={{ fontWeight: 600, color: c.onSurface }}>{user.username}</div>
            <div style={{ color: c.primary, textTransform: 'capitalize', fontSize: '11px', fontWeight: 600 }}>
              Role: {user.role}
            </div>
          </div>
        )}

        {TABS.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`sidebar-btn${active ? ' active' : ''}`}
            >
              <Icon size={20} style={{ color: active ? c.primary : c.onSurfaceVar }} />
              {label}
            </button>
          )
        })}

        {user && (
          <button
            onClick={handleLogout}
            className="sidebar-btn"
            style={{ marginTop: 'auto', color: '#ef4444' }}
          >
            <LogOut size={20} />
            Sign Out
          </button>
        )}
      </aside>

      {/* ── Main Content Area ── */}
      <div className="main-content-area">
        <div key={activeTab} className="page page-enter" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {activeTab === 'chat' && (
            <AskSangamChat
              token={token}
              activeSessionId={activeSessionId}
              setActiveSessionId={setActiveSessionId}
              onNewSession={handleNewSession}
            />
          )}
          {activeTab === 'history' && (
            <AskSangamHistory
              token={token}
              activeSessionId={activeSessionId}
              onSelectSession={handleSelectSession}
              onNewSession={handleNewSession}
            />
          )}
          {activeTab === 'profile' && (
            <AskSangamProfile
              user={user}
              token={token}
              onLoginSuccess={handleLoginSuccess}
              onLogout={handleLogout}
            />
          )}
        </div>

        {/* ── Mobile Bottom Nav ── */}
        <nav className="bottom-nav">
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = activeTab === key
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className="bottom-nav-btn"
                style={{ color: active ? c.primary : c.secondary }}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
              >
                <div
                  className="bottom-nav-pill"
                  style={{ background: active ? 'rgba(167,139,250,0.12)' : 'transparent' }}
                >
                  <Icon size={22} fill={active ? c.primary : 'none'} />
                </div>
                <span className="bottom-nav-label">{label}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
