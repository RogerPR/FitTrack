import { useState, useEffect } from 'react'
import Dashboard from './components/Dashboard'
import LogMeal from './components/LogMeal'
import LogWorkout from './components/LogWorkout'
import Settings from './components/Settings'

const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )},
  { id: 'meal', label: 'Log Meal', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
      <line x1="6" y1="1" x2="6" y2="4"/>
      <line x1="10" y1="1" x2="10" y2="4"/>
      <line x1="14" y1="1" x2="14" y2="4"/>
    </svg>
  )},
  { id: 'workout', label: 'Log Workout', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <path d="M6.5 6.5h11"/>
      <path d="M6.5 17.5h11"/>
      <rect x="2" y="4" width="4" height="16" rx="1"/>
      <rect x="18" y="4" width="4" height="16" rx="1"/>
      <line x1="12" y1="4" x2="12" y2="20"/>
    </svg>
  )},
  { id: 'more', label: 'More', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )},
]

const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD

function LockScreen({ onUnlock }) {
  const [pw, setPw] = useState('')
  const [error, setError] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (pw === APP_PASSWORD) {
      localStorage.setItem('fittrack_pw', pw)
      onUnlock()
    } else {
      setError(true)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-6">FitTrack</h1>
        <input
          type="password"
          placeholder="Password"
          value={pw}
          onChange={e => { setPw(e.target.value); setError(false) }}
          autoFocus
          className="w-full bg-gray-800 rounded-lg p-4 text-white placeholder-gray-500 text-lg"
        />
        <button
          type="submit"
          className="w-full mt-4 bg-blue-600 text-white py-3 rounded-lg font-semibold min-h-[48px] active:bg-blue-700"
        >
          Enter
        </button>
        {error && <p className="text-red-400 text-center mt-3">Wrong password</p>}
      </form>
    </div>
  )
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function App() {
  const [unlocked, setUnlocked] = useState(() => localStorage.getItem('fittrack_pw') === APP_PASSWORD)
  const [active, setActive] = useState('dashboard')
  const [offline, setOffline] = useState(!navigator.onLine)
  const [refreshKey, setRefreshKey] = useState(0)
  const [activeDate, setActiveDate] = useState(today())

  function navigateWithRefresh(tab) {
    setActive(tab)
    if (tab === 'dashboard') setRefreshKey(k => k + 1)
  }

  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  if (!unlocked) return <LockScreen onUnlock={() => setUnlocked(true)} />

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-20">
      {offline && (
        <div className="bg-yellow-600 text-white text-center py-2 text-sm font-medium">
          No internet connection
        </div>
      )}
      <div className={active === 'dashboard' ? '' : 'hidden'}><Dashboard onNavigate={setActive} refreshKey={refreshKey} date={activeDate} onDateChange={setActiveDate} /></div>
      <div className={active === 'meal' ? '' : 'hidden'}><LogMeal onNavigate={navigateWithRefresh} date={activeDate} /></div>
      <div className={active === 'workout' ? '' : 'hidden'}><LogWorkout date={activeDate} /></div>
      <div className={active === 'more' ? '' : 'hidden'}><Settings /></div>

      <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex justify-around">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`flex flex-col items-center py-3 px-4 min-h-[48px] min-w-[48px] ${
              active === tab.id ? 'text-blue-400' : 'text-gray-500'
            }`}
          >
            {tab.icon}
            <span className="text-xs mt-1">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
