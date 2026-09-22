import { useState, useEffect, useRef, useMemo } from 'react'
import { readCache, readTimings, getGoals, saveGoals, getBodyLog, logBody, deleteBodyLog } from '../api/sheets'

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function Settings({ active, focusKey }) {
  const seedGoals = readCache('getGoals')
  const [calories, setCalories] = useState(() => String(seedGoals?.Calories || ''))
  const [protein, setProtein] = useState(() => String(seedGoals?.Protein || ''))
  const [carbs, setCarbs] = useState(() => String(seedGoals?.Carbs || ''))
  const [fat, setFat] = useState(() => String(seedGoals?.Fat || ''))
  const [goalsSaving, setGoalsSaving] = useState(false)
  const [goalsToast, setGoalsToast] = useState(null)

  const [weight, setWeight] = useState('')
  const [fatPct, setFatPct] = useState('')
  const [bodySaving, setBodySaving] = useState(false)
  const [bodyLog, setBodyLog] = useState(() => readCache('getBodyLog') || [])
  const [loading, setLoading] = useState(() => !readCache('getBodyLog'))
  const loadedFor = useRef(null)
  const [toast, setToast] = useState(null)

  // Only fetched when the tab is actually shown, and again after a focus refresh.
  useEffect(() => {
    if (!active) return
    if (loadedFor.current === focusKey) return
    loadedFor.current = focusKey
    Promise.all([getGoals(), getBodyLog()])
      .then(([goalsData, bodyData]) => {
        if (goalsData) {
          setCalories(String(goalsData.Calories || ''))
          setProtein(String(goalsData.Protein || ''))
          setCarbs(String(goalsData.Carbs || ''))
          setFat(String(goalsData.Fat || ''))
        }
        setBodyLog(bodyData || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [active, focusKey])

  // Re-read whenever the tab is shown or a load finishes, so recent calls show up
  const timings = useMemo(() => active ? readTimings() : [], [active, focusKey, loading])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  async function handleSaveGoals() {
    setGoalsSaving(true)
    try {
      await saveGoals({
        Calories: parseFloat(calories) || 0,
        Protein: parseFloat(protein) || 0,
        Carbs: parseFloat(carbs) || 0,
        Fat: parseFloat(fat) || 0,
      })
      showToast('Goals saved!')
    } catch {
      showToast('Failed to save goals')
    }
    setGoalsSaving(false)
  }

  async function handleLogWeight() {
    if (!weight) return
    setBodySaving(true)
    const entry = {
      Date: today(),
      Weight_kg: parseFloat(weight) || 0,
      Fat_pct: parseFloat(fatPct) || 0,
    }
    setBodyLog(prev => [entry, ...prev])
    setWeight('')
    setFatPct('')
    showToast('Weight logged!')
    try {
      await logBody(entry)
    } catch {
      showToast('Failed to log weight')
    }
    setBodySaving(false)
  }

  async function handleDeleteEntry(entry, index) {
    if (!confirm('Delete this entry?')) return
    const prev = [...bodyLog]
    setBodyLog(bodyLog.filter((_, i) => i !== index))
    showToast('Entry removed')
    try {
      await deleteBodyLog(entry.Date, entry.Weight_kg, entry.Fat_pct)
    } catch {
      setBodyLog(prev)
      showToast('Failed to delete')
    }
  }

  const sortedLog = [...bodyLog].sort((a, b) => (b.Date || '').localeCompare(a.Date || ''))

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">More</h1>

      {/* Daily Macro Goals */}
      <div className="bg-gray-800 rounded-lg p-4 mb-4">
        <h2 className="text-lg font-semibold mb-3">Daily Macro Goals</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-gray-400">Calories</label>
            <input type="number" inputMode="numeric" value={calories} onChange={e => setCalories(e.target.value)}
              className="w-full bg-gray-700 rounded-lg p-3 mt-1 text-white" placeholder="0" />
          </div>
          <div>
            <label className="text-sm text-gray-400">Protein (g)</label>
            <input type="number" inputMode="decimal" value={protein} onChange={e => setProtein(e.target.value)}
              className="w-full bg-gray-700 rounded-lg p-3 mt-1 text-white" placeholder="0" />
          </div>
          <div>
            <label className="text-sm text-gray-400">Carbs (g)</label>
            <input type="number" inputMode="decimal" value={carbs} onChange={e => setCarbs(e.target.value)}
              className="w-full bg-gray-700 rounded-lg p-3 mt-1 text-white" placeholder="0" />
          </div>
          <div>
            <label className="text-sm text-gray-400">Fat (g)</label>
            <input type="number" inputMode="decimal" value={fat} onChange={e => setFat(e.target.value)}
              className="w-full bg-gray-700 rounded-lg p-3 mt-1 text-white" placeholder="0" />
          </div>
        </div>
        <button
          onClick={handleSaveGoals}
          disabled={goalsSaving}
          className="w-full mt-3 bg-green-600 text-white py-3 rounded-lg font-semibold min-h-[48px] active:bg-green-700 disabled:opacity-50"
        >
          {goalsSaving ? 'Saving...' : 'Save Goals'}
        </button>
      </div>

      {/* Body Weight Log */}
      <div className="bg-gray-800 rounded-lg p-4 mb-4">
        <h2 className="text-lg font-semibold mb-3">Body Weight Log</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-gray-400">Weight (kg)</label>
            <input type="number" inputMode="decimal" value={weight} onChange={e => setWeight(e.target.value)}
              className="w-full bg-gray-700 rounded-lg p-3 mt-1 text-white" placeholder="0" />
          </div>
          <div>
            <label className="text-sm text-gray-400">Fat % (optional)</label>
            <input type="number" inputMode="decimal" value={fatPct} onChange={e => setFatPct(e.target.value)}
              className="w-full bg-gray-700 rounded-lg p-3 mt-1 text-white" placeholder="0" />
          </div>
        </div>
        <button
          onClick={handleLogWeight}
          disabled={bodySaving || !weight}
          className="w-full mt-3 bg-green-600 text-white py-3 rounded-lg font-semibold min-h-[48px] active:bg-green-700 disabled:opacity-50"
        >
          {bodySaving ? 'Logging...' : 'Log Weight'}
        </button>
      </div>

      {/* Body Log History */}
      {loading && <p className="text-gray-400">Loading...</p>}
      {!loading && sortedLog.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold mb-2">History</h2>
          {sortedLog.map((entry, i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-3 flex justify-between items-center">
              <div>
                <p className="font-medium">{entry.Weight_kg} kg{entry.Fat_pct ? ` · ${entry.Fat_pct}% fat` : ''}</p>
                <p className="text-sm text-gray-400">{entry.Date}</p>
              </div>
              <button
                onClick={() => handleDeleteEntry(entry, i)}
                className="text-red-400 min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Recent API timings — confirms where the seconds go on the real phone */}
      {timings.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-2">Recent API calls</h2>
          <div className="bg-gray-800 rounded-lg p-3 text-xs font-mono space-y-1">
            {timings.map((t, i) => (
              <div key={i} className="flex justify-between gap-2">
                <span className="truncate">{t.action}</span>
                <span className={`whitespace-nowrap ${t.cached ? 'text-yellow-400' : t.ms > 2500 ? 'text-red-400' : 'text-gray-400'}`}>
                  {(t.ms / 1000).toFixed(1)}s{t.attempts > 1 ? ` · ${t.attempts} tries` : ''}{t.cached ? ' · cache' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-4 right-4 bg-green-600 text-white text-center py-3 rounded-lg font-semibold">
          {toast}
        </div>
      )}
    </div>
  )
}
