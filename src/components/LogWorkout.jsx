import { useState, useEffect, useMemo } from 'react'
import exercisesData from '../data/exercises.json'
import { getSavedRoutines, saveRoutine, logWorkout, getLastWorkoutWeights } from '../api/sheets'

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function LogWorkout() {
  const [view, setView] = useState('list') // 'list', 'create', 'log'
  const [routines, setRoutines] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const [activeRoutine, setActiveRoutine] = useState(null) // { id, name, exercises }

  function loadRoutines() {
    setLoading(true)
    setError(null)
    getSavedRoutines()
      .then(data => setRoutines(data || {}))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadRoutines() }, [])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  function handleRoutineSaved() {
    showToast('Routine saved!')
    setView('list')
    loadRoutines()
  }

  function startLogging(routineId, rows) {
    const sorted = [...rows].sort((a, b) => (a.Order || 0) - (b.Order || 0))
    setActiveRoutine({
      id: routineId,
      name: rows[0].Routine_Name,
      exercises: sorted.map(r => r.Exercise),
    })
    setView('log')
  }

  if (view === 'create') {
    return <CreateRoutine onBack={() => setView('list')} onSaved={handleRoutineSaved} />
  }

  if (view === 'log' && activeRoutine) {
    return (
      <LogWorkoutSession
        routine={activeRoutine}
        onBack={() => { setView('list'); setActiveRoutine(null) }}
        onSaved={() => { showToast('Workout logged!'); setView('list'); setActiveRoutine(null) }}
      />
    )
  }

  const routineEntries = Object.entries(routines)

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Workouts</h1>

      <button
        onClick={() => setView('create')}
        className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold mb-4 min-h-[48px] active:bg-purple-700"
      >
        + Create New Routine
      </button>

      {loading && <p className="text-gray-400">Loading routines...</p>}
      {error && <p className="text-red-400">Error: {error}</p>}

      {!loading && routineEntries.length === 0 && (
        <p className="text-gray-400">No saved routines yet.</p>
      )}

      <div className="space-y-3">
        {routineEntries.map(([routineId, rows]) => {
          const name = rows[0].Routine_Name
          const sorted = [...rows].sort((a, b) => (a.Order || 0) - (b.Order || 0))
          return (
            <button
              key={routineId}
              onClick={() => startLogging(routineId, rows)}
              className="w-full text-left bg-gray-800 rounded-lg p-4 min-h-[48px] active:bg-gray-700"
            >
              <p className="font-semibold text-lg">{name}</p>
              <p className="text-sm text-gray-400 mt-1">
                {sorted.map(r => r.Exercise).join(' · ')}
              </p>
            </button>
          )
        })}
      </div>

      {toast && (
        <div className="fixed bottom-24 left-4 right-4 bg-green-600 text-white text-center py-3 rounded-lg font-semibold">
          {toast}
        </div>
      )}
    </div>
  )
}

// --- Create Routine ---

function CreateRoutine({ onBack, onSaved }) {
  const [selected, setSelected] = useState([]) // exercise names in order
  const [routineName, setRoutineName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const grouped = useMemo(() => {
    const g = {}
    for (const ex of exercisesData) {
      if (!g[ex.Category]) g[ex.Category] = []
      g[ex.Category].push(ex.Name)
    }
    return g
  }, [])

  function toggleExercise(name) {
    if (selected.includes(name)) {
      setSelected(selected.filter(n => n !== name))
    } else {
      setSelected([...selected, name])
    }
  }

  function moveUp(index) {
    if (index === 0) return
    const next = [...selected]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    setSelected(next)
  }

  function moveDown(index) {
    if (index === selected.length - 1) return
    const next = [...selected]
    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
    setSelected(next)
  }

  async function handleSave() {
    if (!routineName.trim() || selected.length === 0) return
    setSaving(true)
    setError(null)
    const routineId = Date.now().toString()
    const rows = selected.map((name, i) => ({
      Routine_ID: routineId,
      Routine_Name: routineName.trim(),
      Exercise: name,
      Order: i + 1,
    }))
    try {
      await saveRoutine(rows)
      onSaved()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const categories = Object.keys(grouped)

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="text-purple-400 min-w-[48px] min-h-[48px] flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1 className="text-2xl font-bold">Create Routine</h1>
      </div>

      {/* Selected exercises with reorder */}
      {selected.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm text-gray-400 mb-2">Selected ({selected.length})</h3>
          <div className="space-y-1">
            {selected.map((name, i) => (
              <div key={name} className="bg-purple-900/30 border border-purple-700 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm font-medium">{i + 1}. {name}</span>
                <div className="flex gap-1">
                  <button onClick={() => moveUp(i)} className="text-gray-400 min-w-[36px] min-h-[36px] flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><polyline points="18 15 12 9 6 15"/></svg>
                  </button>
                  <button onClick={() => moveDown(i)} className="text-gray-400 min-w-[36px] min-h-[36px] flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  <button onClick={() => toggleExercise(name)} className="text-red-400 min-w-[36px] min-h-[36px] flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exercise catalogue by category */}
      {categories.map(cat => (
        <div key={cat} className="mb-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase mb-2">{cat}</h3>
          <div className="space-y-1">
            {grouped[cat].map(name => {
              const isSelected = selected.includes(name)
              return (
                <button
                  key={name}
                  onClick={() => toggleExercise(name)}
                  className={`w-full text-left rounded-lg p-3 min-h-[48px] ${
                    isSelected ? 'bg-purple-600 text-white' : 'bg-gray-800 active:bg-gray-700'
                  }`}
                >
                  {name}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {/* Save bar */}
      {selected.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 bg-gray-900 border-t border-gray-800 p-4">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Routine name"
              value={routineName}
              onChange={e => setRoutineName(e.target.value)}
              className="flex-1 bg-gray-800 rounded-lg p-3 text-white placeholder-gray-500"
            />
            <button
              onClick={handleSave}
              disabled={saving || !routineName.trim()}
              className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold min-h-[48px] active:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
          {error && <p className="text-red-400 text-sm mt-2">Error: {error}. Tap Save to retry.</p>}
        </div>
      )}
    </div>
  )
}

// --- Log Workout Session ---

function LogWorkoutSession({ routine, onBack, onSaved }) {
  const [exercises, setExercises] = useState(
    routine.exercises.map(name => ({
      name,
      sets: [{ reps: '12', weight: '' }],
    }))
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [loadingWeights, setLoadingWeights] = useState(true)
  const [showAddExercise, setShowAddExercise] = useState(false)

  // Pre-fill weights from last session
  useEffect(() => {
    getLastWorkoutWeights(routine.id)
      .then(data => {
        if (!data || data.length === 0) return
        // Group last workout data by exercise
        const byExercise = {}
        for (const row of data) {
          if (!byExercise[row.Exercise]) byExercise[row.Exercise] = []
          byExercise[row.Exercise].push(row)
        }
        setExercises(prev => prev.map(ex => {
          const lastSets = byExercise[ex.name]
          if (!lastSets) return ex
          const sorted = lastSets.sort((a, b) => (a.Set_Num || 0) - (b.Set_Num || 0))
          return {
            ...ex,
            sets: sorted.map(s => ({
              reps: String(s.Reps || ''),
              weight: String(s.Weight_kg || ''),
            })),
          }
        }))
      })
      .catch(() => {})
      .finally(() => setLoadingWeights(false))
  }, [routine.id])

  function updateSet(exIndex, setIndex, field, value) {
    setExercises(prev => {
      const next = [...prev]
      const ex = { ...next[exIndex], sets: [...next[exIndex].sets] }
      ex.sets[setIndex] = { ...ex.sets[setIndex], [field]: value }
      next[exIndex] = ex
      return next
    })
  }

  function addSet(exIndex) {
    setExercises(prev => {
      const next = [...prev]
      const ex = { ...next[exIndex], sets: [...next[exIndex].sets] }
      const lastSet = ex.sets[ex.sets.length - 1]
      ex.sets.push({ reps: lastSet.reps, weight: lastSet.weight })
      next[exIndex] = ex
      return next
    })
  }

  function removeSet(exIndex, setIndex) {
    setExercises(prev => {
      const next = [...prev]
      const ex = { ...next[exIndex], sets: [...next[exIndex].sets] }
      if (ex.sets.length <= 1) return prev
      ex.sets.splice(setIndex, 1)
      next[exIndex] = ex
      return next
    })
  }

  function removeExercise(exIndex) {
    setExercises(prev => prev.filter((_, i) => i !== exIndex))
  }

  function addExercise(name) {
    setExercises(prev => [...prev, { name, sets: [{ reps: '12', weight: '' }] }])
    setShowAddExercise(false)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const date = today()
    const rows = []
    for (const ex of exercises) {
      for (let i = 0; i < ex.sets.length; i++) {
        const s = ex.sets[i]
        if (!s.reps && !s.weight) continue
        rows.push({
          Date: date,
          Routine_ID: routine.id,
          Routine_Name: routine.name,
          Exercise: ex.name,
          Set_Num: i + 1,
          Reps: parseInt(s.reps) || 0,
          Weight_kg: parseFloat(s.weight) || 0,
        })
      }
    }
    if (rows.length === 0) {
      setError('Add at least one set with reps or weight')
      setSaving(false)
      return
    }
    try {
      await logWorkout(rows)
      onSaved()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const grouped = useMemo(() => {
    const g = {}
    for (const ex of exercisesData) {
      if (!g[ex.Category]) g[ex.Category] = []
      g[ex.Category].push(ex.Name)
    }
    return g
  }, [])

  const currentExerciseNames = exercises.map(e => e.name)

  return (
    <div className="p-4 pb-32">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="text-purple-400 min-w-[48px] min-h-[48px] flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1 className="text-2xl font-bold">{routine.name}</h1>
      </div>

      {loadingWeights && <p className="text-gray-400 text-sm mb-4">Loading previous weights...</p>}

      <div className="space-y-4">
        {exercises.map((ex, exIndex) => (
          <div key={exIndex} className="bg-gray-800 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold">{ex.name}</h3>
              <button
                onClick={() => removeExercise(exIndex)}
                className="text-red-400 min-w-[36px] min-h-[36px] flex items-center justify-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Header row */}
            <div className="grid grid-cols-[40px_1fr_1fr_40px] gap-2 mb-1 text-xs text-gray-400">
              <span>Set</span>
              <span>Reps</span>
              <span>Weight (kg)</span>
              <span></span>
            </div>

            {ex.sets.map((s, setIndex) => (
              <div key={setIndex} className="grid grid-cols-[40px_1fr_1fr_40px] gap-2 mb-2 items-center">
                <span className="text-sm text-gray-400 text-center">{setIndex + 1}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={s.reps}
                  onChange={e => updateSet(exIndex, setIndex, 'reps', e.target.value)}
                  className="bg-gray-700 rounded p-2 text-white text-center"
                />
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  value={s.weight}
                  onChange={e => updateSet(exIndex, setIndex, 'weight', e.target.value)}
                  className="bg-gray-700 rounded p-2 text-white text-center"
                />
                <button
                  onClick={() => removeSet(exIndex, setIndex)}
                  className="text-gray-500 min-w-[36px] min-h-[36px] flex items-center justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </button>
              </div>
            ))}

            <button
              onClick={() => addSet(exIndex)}
              className="w-full text-sm text-purple-400 py-2 min-h-[40px] active:text-purple-300"
            >
              + Add Set
            </button>
          </div>
        ))}
      </div>

      {/* Add exercise button */}
      <button
        onClick={() => setShowAddExercise(true)}
        className="w-full mt-4 border border-dashed border-gray-600 text-gray-400 py-3 rounded-lg min-h-[48px] active:border-gray-500"
      >
        + Add Exercise
      </button>

      {/* Add exercise modal */}
      {showAddExercise && (
        <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto">
          <div className="min-h-screen p-4">
            <div className="bg-gray-800 rounded-lg p-4 max-w-sm mx-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Add Exercise</h3>
                <button
                  onClick={() => setShowAddExercise(false)}
                  className="text-gray-400 min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              {Object.entries(grouped).map(([cat, names]) => (
                <div key={cat} className="mb-3">
                  <p className="text-xs text-gray-400 uppercase mb-1">{cat}</p>
                  {names.filter(n => !currentExerciseNames.includes(n)).map(name => (
                    <button
                      key={name}
                      onClick={() => addExercise(name)}
                      className="w-full text-left bg-gray-700 rounded p-3 mb-1 min-h-[44px] active:bg-gray-600"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Save bar */}
      <div className="fixed bottom-16 left-0 right-0 bg-gray-900 border-t border-gray-800 p-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold min-h-[48px] active:bg-green-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Workout'}
        </button>
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      </div>
    </div>
  )
}
