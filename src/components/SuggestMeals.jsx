import { useState, useMemo } from 'react'
import ingredientsData from '../data/ingredients.json'
import mealTemplates from '../data/mealTemplates.json'
import { logMeal } from '../api/sheets'

function today() {
  return new Date().toISOString().slice(0, 10)
}

const ingMap = {}
for (const ing of ingredientsData) {
  ingMap[ing.Name] = ing
}

function computeMacros(template) {
  let calories = 0, protein = 0, carbs = 0, fat = 0, fiber = 0
  for (const item of template.ingredients) {
    const ing = ingMap[item.name]
    if (!ing) continue
    const f = item.qty_g / 100
    calories += ing.Calories_100g * f
    protein += ing.Protein_100g * f
    carbs += ing.Carbs_100g * f
    fat += ing.Fat_100g * f
    fiber += (ing.Fiber_100g || 0) * f
  }
  return { calories, protein, carbs, fat, fiber }
}

const CATEGORIES = ['breakfast', 'lunch', 'dinner', 'snack']
const CATEGORY_COLORS = {
  breakfast: 'text-yellow-400',
  lunch: 'text-blue-400',
  dinner: 'text-purple-400',
  snack: 'text-green-400',
}

function suggestMeals(goals, todayTotals) {
  const remaining = {
    calories: Math.max(0, (goals.Calories || 0) - todayTotals.calories),
    protein: Math.max(0, (goals.Protein || 0) - todayTotals.protein),
    carbs: Math.max(0, (goals.Carbs || 0) - todayTotals.carbs),
    fat: Math.max(0, (goals.Fat || 0) - todayTotals.fat),
  }

  const templatesWithMacros = mealTemplates.map(t => ({ ...t, macros: computeMacros(t) }))
  const byCategory = {}
  for (const t of templatesWithMacros) {
    if (!byCategory[t.category]) byCategory[t.category] = []
    byCategory[t.category].push(t)
  }

  const picks = []
  let rem = { ...remaining }
  let slotsLeft = CATEGORIES.length

  for (const cat of CATEGORIES) {
    const candidates = byCategory[cat] || []
    if (candidates.length === 0) { slotsLeft--; continue }

    const idealCal = rem.calories / slotsLeft
    const idealPro = rem.protein / slotsLeft
    const idealCarb = rem.carbs / slotsLeft
    const idealFat = rem.fat / slotsLeft

    let best = null
    let bestScore = Infinity

    for (const c of candidates) {
      const m = c.macros
      let score = 0
      if (goals.Calories > 0) score += 2.0 * ((m.calories - idealCal) / goals.Calories) ** 2
      if (goals.Protein > 0) score += 1.5 * ((m.protein - idealPro) / goals.Protein) ** 2
      if (goals.Carbs > 0) score += 1.0 * ((m.carbs - idealCarb) / goals.Carbs) ** 2
      if (goals.Fat > 0) score += 1.0 * ((m.fat - idealFat) / goals.Fat) ** 2

      if (m.calories > rem.calories * 1.2) score *= 3
      if (m.protein > rem.protein * 1.2 && rem.protein > 0) score *= 2

      if (score < bestScore) {
        bestScore = score
        best = c
      }
    }

    if (best) {
      picks.push(best)
      rem.calories = Math.max(0, rem.calories - best.macros.calories)
      rem.protein = Math.max(0, rem.protein - best.macros.protein)
      rem.carbs = Math.max(0, rem.carbs - best.macros.carbs)
      rem.fat = Math.max(0, rem.fat - best.macros.fat)
    }
    slotsLeft--
  }

  return picks
}

export default function SuggestMeals({ goals, todayTotals, onClose }) {
  const suggestions = useMemo(() => suggestMeals(goals, todayTotals), [goals, todayTotals])
  const [status, setStatus] = useState({}) // id -> 'logged' | 'skipped'
  const [toast, setToast] = useState(null)

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const suggestedTotal = suggestions.reduce((acc, s) => ({
    calories: acc.calories + s.macros.calories,
    protein: acc.protein + s.macros.protein,
    carbs: acc.carbs + s.macros.carbs,
    fat: acc.fat + s.macros.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

  async function handleLog(template) {
    const date = today()
    const mealId = 'suggest_' + Date.now()
    const rows = template.ingredients.map(item => {
      const ing = ingMap[item.name]
      const f = item.qty_g / 100
      return {
        Date: date,
        Meal_ID: mealId,
        Meal_Name: template.name,
        Ingredient: item.name,
        Qty_g: item.qty_g,
        Calories: +(ing.Calories_100g * f).toFixed(1),
        Protein: +(ing.Protein_100g * f).toFixed(1),
        Carbs: +(ing.Carbs_100g * f).toFixed(1),
        Fat: +(ing.Fat_100g * f).toFixed(1),
        Fiber: +((ing.Fiber_100g || 0) * f).toFixed(1),
      }
    })
    setStatus(prev => ({ ...prev, [template.id]: 'logged' }))
    showToast(`${template.name} logged!`)
    logMeal(rows).catch(() => showToast('Failed to log. Try again.'))
  }

  function handleSkip(template) {
    setStatus(prev => ({ ...prev, [template.id]: 'skipped' }))
  }

  async function handleLogAll() {
    const toLog = suggestions.filter(s => !status[s.id])
    for (const template of toLog) {
      await handleLog(template)
      await new Promise(r => setTimeout(r, 100))
    }
  }

  const undecided = suggestions.filter(s => !status[s.id])
  const allDone = undecided.length === 0

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onClose} className="text-blue-400 min-w-[48px] min-h-[48px] flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1 className="text-2xl font-bold">Suggested Meals</h1>
      </div>

      {/* Summary bar */}
      <div className="bg-gray-800 rounded-lg p-3 mb-4 text-center">
        <p className="text-sm text-gray-400 mb-1">Suggested total</p>
        <p className="text-lg font-bold">
          {Math.round(suggestedTotal.calories)} cal
          <span className="text-gray-400 text-sm font-normal"> / {goals.Calories || 0} goal</span>
        </p>
        <p className="text-sm text-gray-400">
          {Math.round(suggestedTotal.protein)}g P &middot; {Math.round(suggestedTotal.carbs)}g C &middot; {Math.round(suggestedTotal.fat)}g F
        </p>
      </div>

      {/* Meal cards */}
      <div className="space-y-3 mb-4">
        {suggestions.map(s => {
          const st = status[s.id]
          return (
            <div key={s.id} className={`bg-gray-800 rounded-lg p-4 ${st ? 'opacity-50' : ''}`}>
              <p className={`text-xs font-semibold uppercase mb-1 ${CATEGORY_COLORS[s.category]}`}>
                {s.category}
              </p>
              <p className="font-semibold text-lg">{s.name}</p>
              <div className="mt-2 space-y-1">
                {s.ingredients.map((item, i) => (
                  <p key={i} className="text-sm text-gray-400">{item.name} — {item.qty_g}g</p>
                ))}
              </div>
              <p className="text-sm mt-2">
                {Math.round(s.macros.calories)} cal &middot; {Math.round(s.macros.protein)}g P &middot; {Math.round(s.macros.carbs)}g C &middot; {Math.round(s.macros.fat)}g F
              </p>
              {!st && (
                <div className="flex gap-3 mt-3">
                  <button
                    onClick={() => handleSkip(s)}
                    className="flex-1 py-3 rounded-lg bg-gray-700 text-gray-300 font-semibold min-h-[48px] active:bg-gray-600"
                  >
                    Skip
                  </button>
                  <button
                    onClick={() => handleLog(s)}
                    className="flex-1 py-3 rounded-lg bg-green-600 text-white font-semibold min-h-[48px] active:bg-green-700"
                  >
                    Log
                  </button>
                </div>
              )}
              {st === 'logged' && <p className="text-green-400 text-sm mt-2 font-semibold">Logged</p>}
              {st === 'skipped' && <p className="text-gray-500 text-sm mt-2">Skipped</p>}
            </div>
          )
        })}
      </div>

      {/* Bottom actions */}
      {!allDone && undecided.length > 0 && (
        <button
          onClick={handleLogAll}
          className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold min-h-[48px] active:bg-green-700 mb-3"
        >
          Log All ({undecided.length})
        </button>
      )}

      {allDone && (
        <button
          onClick={onClose}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold min-h-[48px] active:bg-blue-700"
        >
          Done
        </button>
      )}

      {toast && (
        <div className="fixed bottom-24 left-4 right-4 bg-green-600 text-white text-center py-3 rounded-lg font-semibold">
          {toast}
        </div>
      )}
    </div>
  )
}
