import { useState, useEffect } from 'react'
import Dashboard from './components/Dashboard'
import LogMeal from './components/LogMeal'
import LogWorkout from './components/LogWorkout'

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
]

export default function App() {
  const [active, setActive] = useState('dashboard')
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-20">
      {offline && (
        <div className="bg-yellow-600 text-white text-center py-2 text-sm font-medium">
          No internet connection
        </div>
      )}
      {active === 'dashboard' && <Dashboard onNavigate={setActive} />}
      {active === 'meal' && <LogMeal onNavigate={setActive} />}
      {active === 'workout' && <LogWorkout />}

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
