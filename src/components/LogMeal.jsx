import { useState, useEffect, useMemo } from 'react'
import { getIngredientsList, invalidateIngredientCache } from '../data/ingredientCache'
import { getSavedMeals, saveMeal, logMeal, getMealUsageCounts, analyzeFood, describeMeal, addIngredient } from '../api/sheets'

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function LogMeal({ onNavigate }) {
  const [view, setView] = useState('list') // 'list', 'create', 'custom', 'snap', or 'describe'
  const [savedMeals, setSavedMeals] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedMeal, setExpandedMeal] = useState(null)
  const [toast, setToast] = useState(null)
  const [usageCounts, setUsageCounts] = useState({})
  const [editingMeal, setEditingMeal] = useState(null)

  function loadSavedMeals() {
    setLoading(true)
    setError(null)
    Promise.all([getSavedMeals(), getMealUsageCounts().catch(() => ({}))])
      .then(([data, counts]) => {
        setSavedMeals(data || {})
        setUsageCounts(counts || {})
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadSavedMeals() }, [])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  function handleMealSaved() {
    showToast('Meal saved!')
    setView('list')
    loadSavedMeals()
  }

  async function handleLogToday(mealId, rows) {
    const date = today()
    const logRows = rows.map(r => ({
      Date: date,
      Meal_ID: r.Meal_ID,
      Meal_Name: r.Meal_Name,
      Ingredient: r.Ingredient,
      Qty_g: r.Qty_g,
      Calories: r.Calories,
      Protein: r.Protein,
      Carbs: r.Carbs,
      Fat: r.Fat,
      Fiber: r.Fiber,
    }))
    showToast('Logged to today!')
    onNavigate('dashboard')
    logMeal(logRows).catch(() => {})
  }

  if (view === 'create') {
    return <CreateMeal onBack={() => setView('list')} onSaved={handleMealSaved} />
  }

  function navigateAndReset(tab) {
    setView('list')
    onNavigate(tab)
  }

  if (view === 'ingredient') {
    return <LogIngredientForm onBack={() => setView('list')} onNavigate={navigateAndReset} />
  }

  if (view === 'custom') {
    return <CustomMealForm onBack={() => setView('list')} onNavigate={navigateAndReset} />
  }

  if (view === 'snap') {
    return <SnapMealForm onBack={() => setView('list')} onNavigate={navigateAndReset} />
  }

  if (view === 'describe') {
    return <DescribeMealForm onBack={() => setView('list')} onNavigate={navigateAndReset} />
  }

  const mealEntries = Object.entries(savedMeals)
    .sort((a, b) => (usageCounts[b[0]] || 0) - (usageCounts[a[0]] || 0))

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Meals</h1>

      <button
        onClick={() => setView('create')}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold mb-2 min-h-[48px] active:bg-blue-700"
      >
        + Create New Meal
      </button>
      <button
        onClick={() => setView('ingredient')}
        className="w-full bg-gray-700 text-white py-3 rounded-lg font-semibold mb-2 min-h-[48px] active:bg-gray-600"
      >
        Log Ingredient
      </button>
      <button
        onClick={() => setView('custom')}
        className="w-full bg-gray-700 text-white py-3 rounded-lg font-semibold mb-2 min-h-[48px] active:bg-gray-600"
      >
        Log Custom Meal / Ingredient
      </button>
      <button
        onClick={() => setView('snap')}
        className="w-full bg-amber-600 text-white py-3 rounded-lg font-semibold mb-2 min-h-[48px] active:bg-amber-700"
      >
        Snap Meal
      </button>
      <button
        onClick={() => setView('describe')}
        className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold mb-4 min-h-[48px] active:bg-purple-700"
      >
        Describe Meal
      </button>

      {loading && <p className="text-gray-400">Loading saved meals...</p>}
      {error && <p className="text-red-400">Error: {error}</p>}

      {!loading && mealEntries.length === 0 && (
        <p className="text-gray-400">No saved meals yet. Create your first one!</p>
      )}

      <div className="space-y-3">
        {mealEntries.map(([mealId, rows]) => {
          const name = rows[0].Meal_Name
          const totals = rows.reduce((acc, r) => ({
            calories: acc.calories + (r.Calories || 0),
            protein: acc.protein + (r.Protein || 0),
            carbs: acc.carbs + (r.Carbs || 0),
            fat: acc.fat + (r.Fat || 0),
          }), { calories: 0, protein: 0, carbs: 0, fat: 0 })
          const expanded = expandedMeal === mealId

          return (
            <div key={mealId} className="bg-gray-800 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedMeal(expanded ? null : mealId)}
                className="w-full text-left p-4 min-h-[48px]"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-lg">{name}</p>
                    <p className="text-sm text-gray-400 mt-1">
                      {Math.round(totals.calories)} cal &middot; {Math.round(totals.protein)}g P &middot; {Math.round(totals.carbs)}g C &middot; {Math.round(totals.fat)}g F
                    </p>
                  </div>
                  <span className="text-gray-500 text-xl">{expanded ? '\u25B2' : '\u25BC'}</span>
                </div>
              </button>

              {expanded && (
                <div className="px-4 pb-4 border-t border-gray-700">
                  {rows.map((r, i) => (
                    <div key={i} className="flex justify-between text-sm py-2 border-b border-gray-700 last:border-0">
                      <span className="text-gray-300">{r.Ingredient} ({r.Qty_g}g)</span>
                      <span className="text-gray-400">{Math.round(r.Calories)} cal</span>
                    </div>
                  ))}
                  <button
                    onClick={() => setEditingMeal({ mealId, rows: rows.map(r => ({ ...r })) })}
                    className="w-full mt-3 bg-green-600 text-white py-3 rounded-lg font-semibold min-h-[48px] active:bg-green-700"
                  >
                    Log to Today
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {editingMeal && (
        <EditQuantitiesModal
          mealId={editingMeal.mealId}
          rows={editingMeal.rows}
          onLog={(mealId, rows) => { setEditingMeal(null); handleLogToday(mealId, rows) }}
          onCancel={() => setEditingMeal(null)}
        />
      )}

      {toast && (
        <div className="fixed bottom-24 left-4 right-4 bg-green-600 text-white text-center py-3 rounded-lg font-semibold">
          {toast}
        </div>
      )}
    </div>
  )
}

function EditQuantitiesModal({ mealId, rows, onLog, onCancel }) {
  const [editRows, setEditRows] = useState(() =>
    rows.map(r => {
      const rate100 = r.Qty_g > 0 ? 100 / r.Qty_g : 0
      return {
        ...r,
        cal100: r.Calories * rate100,
        pro100: r.Protein * rate100,
        carb100: r.Carbs * rate100,
        fat100: r.Fat * rate100,
        fiber100: (r.Fiber || 0) * rate100,
        qtyStr: String(r.Qty_g),
      }
    })
  )

  function updateQty(index, val) {
    setEditRows(prev => prev.map((r, i) => {
      if (i !== index) return r
      const qty = parseFloat(val) || 0
      const f = qty / 100
      return {
        ...r,
        qtyStr: val,
        Qty_g: qty,
        Calories: +(r.cal100 * f).toFixed(1),
        Protein: +(r.pro100 * f).toFixed(1),
        Carbs: +(r.carb100 * f).toFixed(1),
        Fat: +(r.fat100 * f).toFixed(1),
        Fiber: +(r.fiber100 * f).toFixed(1),
      }
    }))
  }

  const totals = editRows.reduce((acc, r) => ({
    calories: acc.calories + (r.Calories || 0),
    protein: acc.protein + (r.Protein || 0),
    carbs: acc.carbs + (r.Carbs || 0),
    fat: acc.fat + (r.Fat || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50">
      <div className="bg-gray-900 rounded-t-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <p className="font-bold text-lg">{editRows[0]?.Meal_Name}</p>
          <p className="text-sm text-gray-400 mt-1">
            {Math.round(totals.calories)} cal &middot; {Math.round(totals.protein)}g P &middot; {Math.round(totals.carbs)}g C &middot; {Math.round(totals.fat)}g F
          </p>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {editRows.map((r, i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-3">
              <div className="flex justify-between items-center">
                <p className="font-medium">{r.Ingredient}</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={r.qtyStr}
                    onChange={e => updateQty(i, e.target.value)}
                    className="w-20 bg-gray-700 rounded p-2 text-right text-white"
                  />
                  <span className="text-gray-400 text-sm">g</span>
                </div>
              </div>
              <p className="text-sm text-gray-400 mt-1">
                {Math.round(r.Calories)} cal &middot; {Math.round(r.Protein)}g P &middot; {Math.round(r.Carbs)}g C &middot; {Math.round(r.Fat)}g F
              </p>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-800 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-lg bg-gray-700 text-gray-300 font-semibold min-h-[48px]"
          >
            Cancel
          </button>
          <button
            onClick={() => onLog(mealId, editRows)}
            className="flex-1 py-3 rounded-lg bg-green-600 text-white font-semibold min-h-[48px] active:bg-green-700"
          >
            Log
          </button>
        </div>
      </div>
    </div>
  )
}

function LogIngredientForm({ onBack, onNavigate }) {
  const [search, setSearch] = useState('')
  const [qtyInput, setQtyInput] = useState(null)
  const [qtyValue, setQtyValue] = useState('100')
  const [ingredients, setIngredients] = useState([])

  useEffect(() => { getIngredientsList().then(setIngredients) }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return ingredients
    const q = search.toLowerCase()
    return ingredients.filter(i => i.Name.toLowerCase().includes(q))
  }, [search, ingredients])

  function handleConfirm() {
    const qty = parseInt(qtyValue) || 0
    if (qty <= 0) return
    const factor = qty / 100
    const ing = qtyInput
    const mealId = 'ing_' + Date.now()
    const date = today()
    const rows = [{
      Date: date,
      Meal_ID: mealId,
      Meal_Name: ing.Name,
      Ingredient: ing.Name,
      Qty_g: qty,
      Calories: +(ing.Calories_100g * factor).toFixed(1),
      Protein: +(ing.Protein_100g * factor).toFixed(1),
      Carbs: +(ing.Carbs_100g * factor).toFixed(1),
      Fat: +(ing.Fat_100g * factor).toFixed(1),
      Fiber: +(ing.Fiber_100g * factor).toFixed(1),
    }]
    onNavigate('dashboard')
    logMeal(rows).catch(() => {})
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="text-blue-400 min-w-[48px] min-h-[48px] flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1 className="text-2xl font-bold">Log Ingredient</h1>
      </div>

      {qtyInput && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-1">{qtyInput.Name}</h3>
            <p className="text-sm text-gray-400 mb-4">
              Per 100g: {qtyInput.Calories_100g} cal &middot; {qtyInput.Protein_100g}g P &middot; {qtyInput.Carbs_100g}g C &middot; {qtyInput.Fat_100g}g F
            </p>
            <label className="text-sm text-gray-400">Quantity (grams)</label>
            <input
              type="number"
              inputMode="numeric"
              value={qtyValue}
              onChange={e => setQtyValue(e.target.value)}
              autoFocus
              className="w-full bg-gray-700 rounded-lg p-3 mt-1 mb-4 text-lg text-white"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setQtyInput(null); setQtyValue('100') }}
                className="flex-1 py-3 rounded-lg bg-gray-700 text-gray-300 min-h-[48px]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-3 rounded-lg bg-green-600 text-white font-semibold min-h-[48px] active:bg-green-700"
              >
                Log
              </button>
            </div>
          </div>
        </div>
      )}

      <input
        type="text"
        placeholder="Search ingredients..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full bg-gray-800 rounded-lg p-3 mb-3 text-white placeholder-gray-500"
      />

      <div className="space-y-1">
        {filtered.map(ing => (
          <button
            key={ing.Name}
            onClick={() => setQtyInput(ing)}
            className="w-full text-left bg-gray-800 rounded-lg p-3 min-h-[48px] active:bg-gray-700"
          >
            <p className="font-medium">{ing.Name}</p>
            <p className="text-sm text-gray-400">
              {ing.Calories_100g} cal &middot; {ing.Protein_100g}g P &middot; {ing.Carbs_100g}g C &middot; {ing.Fat_100g}g F
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}

function CustomMealForm({ onBack, onNavigate }) {
  const [name, setName] = useState('')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [saveAsIngredient, setSaveAsIngredient] = useState(false)
  const [servingSize, setServingSize] = useState('')

  const validServingSize = parseFloat(servingSize) > 0

  async function handleSave() {
    if (!name.trim() || !calories) return
    if (saveAsIngredient && !validServingSize) return
    setSaving(true)
    setError(null)
    const mealId = 'custom_' + Date.now()
    const date = today()
    const rows = [{
      Date: date,
      Meal_ID: mealId,
      Meal_Name: name.trim(),
      Ingredient: 'Custom entry',
      Qty_g: 0,
      Calories: parseFloat(calories) || 0,
      Protein: parseFloat(protein) || 0,
      Carbs: parseFloat(carbs) || 0,
      Fat: parseFloat(fat) || 0,
      Fiber: 0,
    }]
    try {
      onNavigate('dashboard')
      logMeal(rows).catch(() => {})
      if (saveAsIngredient) {
        const sz = parseFloat(servingSize)
        const toP100 = (v) => Math.round((parseFloat(v) || 0) * (100 / sz))
        addIngredient({
          Name: name.trim(),
          Calories_100g: toP100(calories),
          Protein_100g: toP100(protein),
          Carbs_100g: toP100(carbs),
          Fat_100g: toP100(fat),
          Fiber_100g: 0,
        }).then(() => invalidateIngredientCache()).catch(() => {})
      }
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="text-blue-400 min-w-[48px] min-h-[48px] flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1 className="text-2xl font-bold">Log Custom Meal / Ingredient</h1>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-sm text-gray-400">Meal Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Restaurant lunch"
            className="w-full bg-gray-800 rounded-lg p-3 mt-1 text-white placeholder-gray-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-gray-400">Calories</label>
            <input type="number" inputMode="numeric" value={calories} onChange={e => setCalories(e.target.value)}
              className="w-full bg-gray-800 rounded-lg p-3 mt-1 text-white" placeholder="0" />
          </div>
          <div>
            <label className="text-sm text-gray-400">Protein (g)</label>
            <input type="number" inputMode="decimal" value={protein} onChange={e => setProtein(e.target.value)}
              className="w-full bg-gray-800 rounded-lg p-3 mt-1 text-white" placeholder="0" />
          </div>
          <div>
            <label className="text-sm text-gray-400">Carbs (g)</label>
            <input type="number" inputMode="decimal" value={carbs} onChange={e => setCarbs(e.target.value)}
              className="w-full bg-gray-800 rounded-lg p-3 mt-1 text-white" placeholder="0" />
          </div>
          <div>
            <label className="text-sm text-gray-400">Fat (g)</label>
            <input type="number" inputMode="decimal" value={fat} onChange={e => setFat(e.target.value)}
              className="w-full bg-gray-800 rounded-lg p-3 mt-1 text-white" placeholder="0" />
          </div>
        </div>

        <div className="mt-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setSaveAsIngredient(!saveAsIngredient)}
              className={`relative w-11 h-6 rounded-full transition-colors ${saveAsIngredient ? 'bg-purple-600' : 'bg-gray-600'}`}
            >
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${saveAsIngredient ? 'translate-x-5' : ''}`} />
            </div>
            <span className="text-sm text-gray-300">Also save as ingredient</span>
          </label>
          {saveAsIngredient && (
            <div className="mt-2">
              <label className="text-sm text-gray-400">Serving size (g)</label>
              <input
                type="number"
                inputMode="numeric"
                value={servingSize}
                onChange={e => setServingSize(e.target.value)}
                placeholder="e.g. 350"
                className="w-full bg-gray-800 rounded-lg p-3 mt-1 text-white placeholder-gray-500"
              />
              <p className="text-xs text-gray-500 mt-1">Macros will be converted to per-100g values</p>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !name.trim() || !calories || (saveAsIngredient && !validServingSize)}
        className="w-full mt-6 bg-green-600 text-white py-3 rounded-lg font-semibold min-h-[48px] active:bg-green-700 disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Log to Today'}
      </button>

      {error && <p className="text-red-400 text-sm mt-2">Error: {error}</p>}
    </div>
  )
}

function compressImage(file) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const max = 1024
      let w = img.width, h = img.height
      if (w > max || h > max) {
        if (w > h) { h = Math.round(h * max / w); w = max }
        else { w = Math.round(w * max / h); h = max }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
      resolve(dataUrl.split(',')[1])
    }
    img.src = url
  })
}

function DescribeMealForm({ onBack, onNavigate }) {
  const [step, setStep] = useState('input') // 'input', 'analyzing', 'result', 'error'
  const [text, setText] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [name, setName] = useState('')
  const [items, setItems] = useState([])

  async function handleAnalyze() {
    if (!text.trim()) return
    setStep('analyzing')
    try {
      const data = await describeMeal(text.trim())
      setName(data.name || 'Described meal')
      setItems((data.foods || []).map(f => ({
        item: f.item,
        grams: f.grams || 100,
        gramsStr: String(f.grams || 100),
        cal100: f.calories_100g || 0,
        pro100: f.protein_100g || 0,
        carb100: f.carbs_100g || 0,
        fat100: f.fat_100g || 0,
      })))
      setStep('result')
    } catch (err) {
      setErrorMsg(err.message || 'Failed to analyze description')
      setStep('error')
    }
  }

  function updateGrams(index, val) {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item
      return { ...item, gramsStr: val, grams: parseFloat(val) || 0 }
    }))
  }

  function handleRetry() {
    setStep('input')
    setErrorMsg('')
    setItems([])
  }

  const totals = items.reduce((acc, f) => {
    const g = f.grams / 100
    return {
      calories: acc.calories + f.cal100 * g,
      protein: acc.protein + f.pro100 * g,
      carbs: acc.carbs + f.carb100 * g,
      fat: acc.fat + f.fat100 * g,
    }
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 })

  function handleLog() {
    if (!name.trim() || items.length === 0) return
    const mealId = 'desc_' + Date.now()
    const date = today()
    const rows = items.map(f => {
      const g = f.grams / 100
      return {
        Date: date,
        Meal_ID: mealId,
        Meal_Name: name.trim(),
        Ingredient: f.item,
        Qty_g: Math.round(f.grams),
        Calories: Math.round(f.cal100 * g),
        Protein: Math.round(f.pro100 * g),
        Carbs: Math.round(f.carb100 * g),
        Fat: Math.round(f.fat100 * g),
        Fiber: 0,
      }
    })
    onNavigate('dashboard')
    logMeal(rows).catch(() => {})
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="text-blue-400 min-w-[48px] min-h-[48px] flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1 className="text-2xl font-bold">Describe Meal</h1>
      </div>

      {step === 'input' && (
        <div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Describe your meal, e.g. 'Grilled chicken breast 200g with white rice 150g and a drizzle of olive oil'"
            rows={4}
            className="w-full bg-gray-800 rounded-lg p-3 text-white placeholder-gray-500 resize-none"
          />
          <button
            onClick={handleAnalyze}
            disabled={!text.trim()}
            className="w-full mt-3 bg-purple-600 text-white py-3 rounded-lg font-semibold min-h-[48px] active:bg-purple-700 disabled:opacity-50"
          >
            Analyze
          </button>
        </div>
      )}

      {step === 'analyzing' && (
        <div className="text-center">
          <div className="bg-gray-800 rounded-lg p-4 mb-4 text-left">
            <p className="text-gray-300 text-sm">{text}</p>
          </div>
          <p className="text-gray-400 animate-pulse text-lg">Analyzing your meal...</p>
        </div>
      )}

      {step === 'error' && (
        <div className="text-center">
          <p className="text-red-400 mb-4">{errorMsg}</p>
          <button onClick={handleRetry} className="w-full bg-gray-700 text-white py-3 rounded-lg font-semibold min-h-[48px]">
            Try Again
          </button>
        </div>
      )}

      {step === 'result' && (
        <div>
          <div>
            <label className="text-sm text-gray-400">Meal Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-gray-800 rounded-lg p-3 mt-1 mb-3 text-white" />
          </div>

          <div className="bg-gray-800 rounded-lg p-3 mb-3 grid grid-cols-4 text-center">
            <div>
              <p className="text-lg font-bold">{Math.round(totals.calories)}</p>
              <p className="text-xs text-gray-400">Cal</p>
            </div>
            <div>
              <p className="text-lg font-bold text-blue-400">{Math.round(totals.protein)}g</p>
              <p className="text-xs text-gray-400">Protein</p>
            </div>
            <div>
              <p className="text-lg font-bold text-yellow-400">{Math.round(totals.carbs)}g</p>
              <p className="text-xs text-gray-400">Carbs</p>
            </div>
            <div>
              <p className="text-lg font-bold text-red-400">{Math.round(totals.fat)}g</p>
              <p className="text-xs text-gray-400">Fat</p>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            {items.map((f, i) => {
              const g = f.grams / 100
              return (
                <div key={i} className="bg-gray-800 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <p className="font-medium">{f.item}</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        inputMode="numeric"
                        value={f.gramsStr}
                        onChange={e => updateGrams(i, e.target.value)}
                        className="w-20 bg-gray-700 rounded p-2 text-right text-white"
                      />
                      <span className="text-gray-400 text-sm">g</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">
                    {Math.round(f.cal100 * g)} cal &middot; {Math.round(f.pro100 * g)}g P &middot; {Math.round(f.carb100 * g)}g C &middot; {Math.round(f.fat100 * g)}g F
                  </p>
                </div>
              )
            })}
          </div>

          <button
            onClick={handleLog}
            disabled={!name.trim() || items.length === 0}
            className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold min-h-[48px] active:bg-green-700 disabled:opacity-50"
          >
            Log to Today
          </button>
          <button onClick={handleRetry} className="w-full mt-2 bg-gray-700 text-white py-3 rounded-lg font-semibold min-h-[48px]">
            Try Again
          </button>
        </div>
      )}
    </div>
  )
}

function SnapMealForm({ onBack, onNavigate }) {
  const [step, setStep] = useState('capture') // 'capture', 'analyzing', 'result', 'error'
  const [preview, setPreview] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [name, setName] = useState('')
  const [items, setItems] = useState([])

  async function handleCapture(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPreview(URL.createObjectURL(file))
    setStep('analyzing')
    try {
      const base64 = await compressImage(file)
      const data = await analyzeFood(base64)
      setName(data.name || 'Photo meal')
      setItems((data.foods || []).map(f => ({
        item: f.item,
        grams: f.grams || 100,
        gramsStr: String(f.grams || 100),
        cal100: f.calories_100g || 0,
        pro100: f.protein_100g || 0,
        carb100: f.carbs_100g || 0,
        fat100: f.fat_100g || 0,
      })))
      setStep('result')
    } catch (err) {
      setErrorMsg(err.message || 'Failed to analyze photo')
      setStep('error')
    }
  }

  function updateGrams(index, val) {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item
      return { ...item, gramsStr: val, grams: parseFloat(val) || 0 }
    }))
  }

  function handleRetake() {
    setStep('capture')
    setPreview(null)
    setErrorMsg('')
    setItems([])
  }

  const totals = items.reduce((acc, f) => {
    const g = f.grams / 100
    return {
      calories: acc.calories + f.cal100 * g,
      protein: acc.protein + f.pro100 * g,
      carbs: acc.carbs + f.carb100 * g,
      fat: acc.fat + f.fat100 * g,
    }
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 })

  function handleLog() {
    if (!name.trim() || items.length === 0) return
    const mealId = 'snap_' + Date.now()
    const date = today()
    const rows = items.map(f => {
      const g = f.grams / 100
      return {
        Date: date,
        Meal_ID: mealId,
        Meal_Name: name.trim(),
        Ingredient: f.item,
        Qty_g: Math.round(f.grams),
        Calories: Math.round(f.cal100 * g),
        Protein: Math.round(f.pro100 * g),
        Carbs: Math.round(f.carb100 * g),
        Fat: Math.round(f.fat100 * g),
        Fiber: 0,
      }
    })
    onNavigate('dashboard')
    logMeal(rows).catch(() => {})
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="text-blue-400 min-w-[48px] min-h-[48px] flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1 className="text-2xl font-bold">Snap Meal</h1>
      </div>

      {step === 'capture' && (
        <label className="block w-full bg-amber-600 text-white text-center py-8 rounded-lg font-semibold text-lg cursor-pointer active:bg-amber-700">
          Take Photo
          <input type="file" accept="image/*" capture="environment" onChange={handleCapture} className="hidden" />
        </label>
      )}

      {step === 'analyzing' && (
        <div className="text-center">
          {preview && <img src={preview} alt="Food" className="w-48 h-48 object-cover rounded-lg mx-auto mb-4" />}
          <p className="text-gray-400 animate-pulse text-lg">Analyzing your food...</p>
        </div>
      )}

      {step === 'error' && (
        <div className="text-center">
          {preview && <img src={preview} alt="Food" className="w-48 h-48 object-cover rounded-lg mx-auto mb-4" />}
          <p className="text-red-400 mb-4">{errorMsg}</p>
          <button onClick={handleRetake} className="w-full bg-gray-700 text-white py-3 rounded-lg font-semibold min-h-[48px]">
            Try Again
          </button>
        </div>
      )}

      {step === 'result' && (
        <div>
          {preview && <img src={preview} alt="Food" className="w-32 h-32 object-cover rounded-lg mx-auto mb-4" />}

          <div>
            <label className="text-sm text-gray-400">Meal Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-gray-800 rounded-lg p-3 mt-1 mb-3 text-white" />
          </div>

          <div className="bg-gray-800 rounded-lg p-3 mb-3 grid grid-cols-4 text-center">
            <div>
              <p className="text-lg font-bold">{Math.round(totals.calories)}</p>
              <p className="text-xs text-gray-400">Cal</p>
            </div>
            <div>
              <p className="text-lg font-bold text-blue-400">{Math.round(totals.protein)}g</p>
              <p className="text-xs text-gray-400">Protein</p>
            </div>
            <div>
              <p className="text-lg font-bold text-yellow-400">{Math.round(totals.carbs)}g</p>
              <p className="text-xs text-gray-400">Carbs</p>
            </div>
            <div>
              <p className="text-lg font-bold text-red-400">{Math.round(totals.fat)}g</p>
              <p className="text-xs text-gray-400">Fat</p>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            {items.map((f, i) => {
              const g = f.grams / 100
              return (
                <div key={i} className="bg-gray-800 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <p className="font-medium">{f.item}</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        inputMode="numeric"
                        value={f.gramsStr}
                        onChange={e => updateGrams(i, e.target.value)}
                        className="w-20 bg-gray-700 rounded p-2 text-right text-white"
                      />
                      <span className="text-gray-400 text-sm">g</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">
                    {Math.round(f.cal100 * g)} cal &middot; {Math.round(f.pro100 * g)}g P &middot; {Math.round(f.carb100 * g)}g C &middot; {Math.round(f.fat100 * g)}g F
                  </p>
                </div>
              )
            })}
          </div>

          <button
            onClick={handleLog}
            disabled={!name.trim() || items.length === 0}
            className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold min-h-[48px] active:bg-green-700 disabled:opacity-50"
          >
            Log to Today
          </button>
          <button onClick={handleRetake} className="w-full mt-2 bg-gray-700 text-white py-3 rounded-lg font-semibold min-h-[48px]">
            Retake
          </button>
        </div>
      )}
    </div>
  )
}

function CreateMeal({ onBack, onSaved }) {
  const [search, setSearch] = useState('')
  const [added, setAdded] = useState([])
  const [qtyInput, setQtyInput] = useState(null)
  const [qtyValue, setQtyValue] = useState('100')
  const [mealName, setMealName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [ingredients, setIngredients] = useState([])

  useEffect(() => { getIngredientsList().then(setIngredients) }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return ingredients
    const q = search.toLowerCase()
    return ingredients.filter(i => i.Name.toLowerCase().includes(q))
  }, [search, ingredients])

  function calcMacros(ingredient, qty) {
    const factor = qty / 100
    return {
      Calories: +(ingredient.Calories_100g * factor).toFixed(1),
      Protein: +(ingredient.Protein_100g * factor).toFixed(1),
      Carbs: +(ingredient.Carbs_100g * factor).toFixed(1),
      Fat: +(ingredient.Fat_100g * factor).toFixed(1),
      Fiber: +(ingredient.Fiber_100g * factor).toFixed(1),
    }
  }

  function confirmAdd() {
    const qty = parseInt(qtyValue) || 0
    if (qty <= 0) return
    const macros = calcMacros(qtyInput, qty)
    setAdded([...added, { ingredient: qtyInput.Name, qty, macros }])
    setQtyInput(null)
    setQtyValue('100')
    setSearch('')
  }

  function removeItem(index) {
    setAdded(added.filter((_, i) => i !== index))
  }

  const totals = added.reduce((acc, item) => ({
    calories: acc.calories + item.macros.Calories,
    protein: acc.protein + item.macros.Protein,
    carbs: acc.carbs + item.macros.Carbs,
    fat: acc.fat + item.macros.Fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

  async function handleSave() {
    if (!mealName.trim() || added.length === 0) return
    setSaving(true)
    setError(null)
    const mealId = Date.now().toString()
    const rows = added.map(item => ({
      Meal_ID: mealId,
      Meal_Name: mealName.trim(),
      Ingredient: item.ingredient,
      Qty_g: item.qty,
      Calories: item.macros.Calories,
      Protein: item.macros.Protein,
      Carbs: item.macros.Carbs,
      Fat: item.macros.Fat,
      Fiber: item.macros.Fiber,
    }))
    try {
      await saveMeal(rows)
      onSaved()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="text-blue-400 min-w-[48px] min-h-[48px] flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1 className="text-2xl font-bold">Create Meal</h1>
      </div>

      {/* Running totals */}
      <div className="bg-gray-800 rounded-lg p-3 mb-4 grid grid-cols-4 text-center">
        <div>
          <p className="text-xl font-bold">{Math.round(totals.calories)}</p>
          <p className="text-xs text-gray-400">Cal</p>
        </div>
        <div>
          <p className="text-xl font-bold text-blue-400">{Math.round(totals.protein)}g</p>
          <p className="text-xs text-gray-400">Protein</p>
        </div>
        <div>
          <p className="text-xl font-bold text-yellow-400">{Math.round(totals.carbs)}g</p>
          <p className="text-xs text-gray-400">Carbs</p>
        </div>
        <div>
          <p className="text-xl font-bold text-red-400">{Math.round(totals.fat)}g</p>
          <p className="text-xs text-gray-400">Fat</p>
        </div>
      </div>

      {/* Added ingredients */}
      {added.length > 0 && (
        <div className="mb-4 space-y-2">
          {added.map((item, i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-3 flex justify-between items-center">
              <div>
                <p className="font-medium">{item.ingredient}</p>
                <p className="text-sm text-gray-400">{item.qty}g &middot; {Math.round(item.macros.Calories)} cal &middot; {Math.round(item.macros.Protein)}g P</p>
              </div>
              <button
                onClick={() => removeItem(i)}
                className="text-red-400 min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Quantity input modal */}
      {qtyInput && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-1">{qtyInput.Name}</h3>
            <p className="text-sm text-gray-400 mb-4">
              Per 100g: {qtyInput.Calories_100g} cal &middot; {qtyInput.Protein_100g}g P &middot; {qtyInput.Carbs_100g}g C &middot; {qtyInput.Fat_100g}g F
            </p>
            <label className="text-sm text-gray-400">Quantity (grams)</label>
            <input
              type="number"
              inputMode="numeric"
              value={qtyValue}
              onChange={e => setQtyValue(e.target.value)}
              autoFocus
              className="w-full bg-gray-700 rounded-lg p-3 mt-1 mb-4 text-lg text-white"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setQtyInput(null); setQtyValue('100') }}
                className="flex-1 py-3 rounded-lg bg-gray-700 text-gray-300 min-h-[48px]"
              >
                Cancel
              </button>
              <button
                onClick={confirmAdd}
                className="flex-1 py-3 rounded-lg bg-blue-600 text-white font-semibold min-h-[48px] active:bg-blue-700"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search ingredients */}
      <input
        type="text"
        placeholder="Search ingredients..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full bg-gray-800 rounded-lg p-3 mb-3 text-white placeholder-gray-500"
      />

      <div className="space-y-1 mb-24">
        {filtered.map(ing => (
          <button
            key={ing.Name}
            onClick={() => setQtyInput(ing)}
            className="w-full text-left bg-gray-800 rounded-lg p-3 min-h-[48px] active:bg-gray-700"
          >
            <p className="font-medium">{ing.Name}</p>
            <p className="text-sm text-gray-400">
              {ing.Calories_100g} cal &middot; {ing.Protein_100g}g P &middot; {ing.Carbs_100g}g C &middot; {ing.Fat_100g}g F
            </p>
          </button>
        ))}
      </div>

      {/* Save bar */}
      {added.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 bg-gray-900 border-t border-gray-800 p-4">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Meal name"
              value={mealName}
              onChange={e => setMealName(e.target.value)}
              className="flex-1 bg-gray-800 rounded-lg p-3 text-white placeholder-gray-500"
            />
            <button
              onClick={handleSave}
              disabled={saving || !mealName.trim()}
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
