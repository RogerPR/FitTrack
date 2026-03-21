import { useState, useEffect } from 'react'
import { getDailyMeals, deleteDailyMeal, getDailyWorkout, getGoals } from '../api/sheets'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function Dashboard({ onNavigate, refreshKey }) {
  const [date, setDate] = useState(today())
  const [meals, setMeals] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [workout, setWorkout] = useState({})
  const [goals, setGoals] = useState(null)

  function loadData(d) {
    setLoading(true)
    setError(null)
    Promise.all([getDailyMeals(d), getDailyWorkout(d), getGoals()])
      .then(([mealsData, workoutData, goalsData]) => {
        setMeals(mealsData || {})
        setWorkout(workoutData || {})
        setGoals(goalsData)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData(date) }, [date, refreshKey])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  async function handleDelete(mealId) {
    if (deleting) return
    if (!confirm('Remove this meal?')) return
    setDeleting(mealId)

    // Optimistic: remove from UI immediately
    const prev = { ...meals }
    const next = { ...meals }
    delete next[mealId]
    setMeals(next)
    showToast('Meal removed')

    try {
      await deleteDailyMeal(date, mealId)
    } catch {
      // Revert on failure
      setMeals(prev)
      showToast('Failed to delete. Try again.')
    }
    setDeleting(null)
  }

  const mealEntries = Object.entries(meals)

  const totals = mealEntries.reduce((acc, [, rows]) => {
    for (const r of rows) {
      acc.calories += r.Calories || 0
      acc.protein += r.Protein || 0
      acc.carbs += r.Carbs || 0
      acc.fat += r.Fat || 0
    }
    return acc
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 })

  const isToday = date === today()

  return (
    <div className="p-4">
      {/* Date header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">{isToday ? 'Today' : formatDate(date)}</h1>
          {isToday && <p className="text-sm text-gray-400">{formatDate(date)}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData(date)}
            className="text-gray-400 min-w-[44px] min-h-[44px] flex items-center justify-center active:text-white"
            title="Refresh"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <polyline points="23 4 23 10 17 10"/>
              <polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="bg-gray-800 text-white rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Macro totals */}
      <div className="bg-gray-800 rounded-lg p-4 mb-4">
        <p className="text-4xl font-bold text-center mb-1">{Math.round(totals.calories)}</p>
        <p className="text-center text-gray-400 text-sm mb-1">calories{goals?.Calories ? ` / ${goals.Calories}` : ''}</p>
        {goals?.Calories > 0 && (
          <div className="w-2/3 mx-auto h-2 bg-gray-700 rounded-full mb-4">
            <div className="h-2 bg-green-500 rounded-full" style={{ width: `${Math.min(100, (totals.calories / goals.Calories) * 100)}%` }} />
          </div>
        )}
        {!goals?.Calories && <div className="mb-4" />}
        <div className="grid grid-cols-3 text-center">
          <div>
            <p className="text-2xl font-bold text-blue-400">{Math.round(totals.protein)}g</p>
            <p className="text-xs text-gray-400">Protein{goals?.Protein ? ` / ${goals.Protein}g` : ''}</p>
            {goals?.Protein > 0 && (
              <div className="h-2 bg-gray-700 rounded-full mt-1 mx-2">
                <div className="h-2 bg-blue-400 rounded-full" style={{ width: `${Math.min(100, (totals.protein / goals.Protein) * 100)}%` }} />
              </div>
            )}
          </div>
          <div>
            <p className="text-2xl font-bold text-yellow-400">{Math.round(totals.carbs)}g</p>
            <p className="text-xs text-gray-400">Carbs{goals?.Carbs ? ` / ${goals.Carbs}g` : ''}</p>
            {goals?.Carbs > 0 && (
              <div className="h-2 bg-gray-700 rounded-full mt-1 mx-2">
                <div className="h-2 bg-yellow-400 rounded-full" style={{ width: `${Math.min(100, (totals.carbs / goals.Carbs) * 100)}%` }} />
              </div>
            )}
          </div>
          <div>
            <p className="text-2xl font-bold text-red-400">{Math.round(totals.fat)}g</p>
            <p className="text-xs text-gray-400">Fat{goals?.Fat ? ` / ${goals.Fat}g` : ''}</p>
            {goals?.Fat > 0 && (
              <div className="h-2 bg-gray-700 rounded-full mt-1 mx-2">
                <div className="h-2 bg-red-400 rounded-full" style={{ width: `${Math.min(100, (totals.fat / goals.Fat) * 100)}%` }} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <button
          onClick={() => onNavigate('meal')}
          className="bg-blue-600 text-white py-3 rounded-lg font-semibold min-h-[48px] active:bg-blue-700"
        >
          Log Meal
        </button>
        <button
          onClick={() => onNavigate('workout')}
          className="bg-purple-600 text-white py-3 rounded-lg font-semibold min-h-[48px] active:bg-purple-700"
        >
          Log Workout
        </button>
      </div>

      {/* Today's meals */}
      <h2 className="text-lg font-semibold mb-3">
        {isToday ? "Today's Meals" : `Meals on ${formatDate(date)}`}
      </h2>

      {loading && <p className="text-gray-400">Loading...</p>}
      {error && <p className="text-red-400">Error: {error}</p>}

      {!loading && mealEntries.length === 0 && (
        <p className="text-gray-400">No meals logged{isToday ? ' yet today' : ''}.</p>
      )}

      <div className="space-y-3">
        {mealEntries.map(([mealId, rows]) => {
          const name = rows[0].Meal_Name
          const mealTotals = rows.reduce((acc, r) => ({
            calories: acc.calories + (r.Calories || 0),
            protein: acc.protein + (r.Protein || 0),
            carbs: acc.carbs + (r.Carbs || 0),
            fat: acc.fat + (r.Fat || 0),
          }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

          return (
            <div key={mealId} className="bg-gray-800 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{name}</p>
                  <p className="text-sm text-gray-400 mt-1">
                    {Math.round(mealTotals.calories)} cal &middot; {Math.round(mealTotals.protein)}g P &middot; {Math.round(mealTotals.carbs)}g C &middot; {Math.round(mealTotals.fat)}g F
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(mealId)}
                  className="text-red-400 min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Today's workout */}
      {(() => {
        const workoutEntries = Object.entries(workout)
        if (workoutEntries.length === 0 && !loading) return null
        return (
          <>
            <h2 className="text-lg font-semibold mb-3 mt-6">
              {isToday ? "Today's Workout" : `Workout on ${formatDate(date)}`}
            </h2>
            {workoutEntries.length === 0 && !loading && (
              <p className="text-gray-400">No workout logged.</p>
            )}
            {workoutEntries.map(([routineId, rows]) => {
              const name = rows[0].Routine_Name
              const byExercise = {}
              for (const r of rows) {
                if (!byExercise[r.Exercise]) byExercise[r.Exercise] = []
                byExercise[r.Exercise].push(r)
              }
              return (
                <div key={routineId} className="bg-gray-800 rounded-lg p-4 mb-3">
                  <p className="font-semibold text-purple-400 mb-2">{name}</p>
                  {Object.entries(byExercise).map(([exercise, sets]) => (
                    <div key={exercise} className="mb-2">
                      <p className="text-sm font-medium">{exercise}</p>
                      <p className="text-xs text-gray-400">
                        {sets.sort((a, b) => (a.Set_Num || 0) - (b.Set_Num || 0))
                          .map(s => `${s.Reps}x${s.Weight_kg}kg`)
                          .join(' · ')}
                      </p>
                    </div>
                  ))}
                </div>
              )
            })}
          </>
        )
      })()}

      {toast && (
        <div className="fixed bottom-24 left-4 right-4 bg-green-600 text-white text-center py-3 rounded-lg font-semibold">
          {toast}
        </div>
      )}
    </div>
  )
}
