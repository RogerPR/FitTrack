import { useState, useEffect, useMemo } from 'react'
import { getObjectives, addObjective, updateObjective, deleteObjective } from '../api/sheets'

const TERMS = [
  { id: 'short', label: 'Short term', sub: '2 weeks' },
  { id: 'mid', label: 'Mid term', sub: '3 months' },
]

// Local date formatting — the app-wide toISOString() idiom shifts a day in UTC+2 late at night,
// which would produce wrong due dates.
function fmt(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

function today() {
  return fmt(new Date())
}

function dueDate(term) {
  const d = new Date()
  if (term === 'short') d.setDate(d.getDate() + 14)
  else d.setMonth(d.getMonth() + 3)
  return fmt(d)
}

function daysUntil(dateStr) {
  const due = new Date(dateStr + 'T00:00:00')
  const now = new Date(today() + 'T00:00:00')
  return Math.round((due - now) / 86400000)
}

function isDone(o) {
  return String(o.Completed) === 'y'
}

// Cards sit *above* the group panel: lighter fill, light gray outline, drop shadow.
const CARD = 'bg-gray-800 rounded-xl p-4 border border-gray-400 border-l-4 shadow-lg shadow-black/40'

// Left accent bar colour — urgency at a glance.
function accent(o) {
  if (isDone(o)) return 'border-l-green-600'
  const left = daysUntil(o.Due_Date)
  if (left < 0) return 'border-l-red-500'
  if (left <= 3) return 'border-l-amber-500'
  return 'border-l-teal-500'
}

export default function Objectives({ onNavigate }) {
  const [objectives, setObjectives] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [openSections, setOpenSections] = useState({ short: false, mid: false })
  const [openCompleted, setOpenCompleted] = useState({ short: false, mid: false })
  const [addingTo, setAddingTo] = useState(null)
  const [newText, setNewText] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState({ Text: '', Start_Date: '', Due_Date: '' })
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  useEffect(() => {
    getObjectives()
      .then(data => setObjectives(data || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const byTerm = useMemo(() => {
    const groups = {}
    for (const term of ['short', 'mid']) {
      const rows = objectives.filter(o => o.Term === term)
      const sort = list => [...list].sort((a, b) => String(b.Start_Date).localeCompare(String(a.Start_Date)))
      groups[term] = {
        active: sort(rows.filter(o => !isDone(o))),
        completed: sort(rows.filter(isDone)),
      }
    }
    return groups
  }, [objectives])

  async function persist(next, apiCall, failMsg) {
    const prev = objectives
    setObjectives(next)
    try {
      await apiCall()
    } catch {
      setObjectives(prev)
      showToast(failMsg)
    }
  }

  function handleAdd(term) {
    const text = newText.trim()
    if (!text) return
    const objective = {
      Objective_ID: 'obj_' + Date.now(),
      Term: term,
      Text: text,
      Start_Date: today(),
      Due_Date: dueDate(term),
      Completed: '',
      Score: '',
    }
    setNewText('')
    setAddingTo(null)
    showToast('Objective added')
    persist([...objectives, objective], () => addObjective(objective), 'Failed to add. Try again.')
  }

  function handleScore(o, n) {
    const score = Number(o.Score) === n ? '' : n
    const next = objectives.map(x => (x.Objective_ID === o.Objective_ID ? { ...x, Score: score } : x))
    persist(next, () => updateObjective(o.Objective_ID, { Score: score }), 'Failed to save score. Try again.')
  }

  function toggleExpand(id) {
    setEditingId(null)
    setExpandedId(cur => (cur === id ? null : id))
  }

  function startEdit(o) {
    setEditingId(o.Objective_ID)
    setEditDraft({ Text: o.Text, Start_Date: String(o.Start_Date), Due_Date: String(o.Due_Date) })
  }

  function handleSaveEdit(o) {
    const fields = {
      Text: editDraft.Text.trim(),
      Start_Date: editDraft.Start_Date,
      Due_Date: editDraft.Due_Date,
    }
    if (!fields.Text || !fields.Start_Date || !fields.Due_Date) return
    setEditingId(null)
    const next = objectives.map(x => (x.Objective_ID === o.Objective_ID ? { ...x, ...fields } : x))
    showToast('Objective updated')
    persist(next, () => updateObjective(o.Objective_ID, fields), 'Failed to save changes. Try again.')
  }

  function handleFinish(o) {
    const next = objectives.map(x => (x.Objective_ID === o.Objective_ID ? { ...x, Completed: 'y' } : x))
    showToast('Marked as finished')
    persist(next, () => updateObjective(o.Objective_ID, { Completed: 'y' }), 'Failed to save. Try again.')
  }

  function handleRemove(o) {
    if (busy) return
    if (!confirm('Remove this objective?')) return
    setBusy(true)
    const next = objectives.filter(x => x.Objective_ID !== o.Objective_ID)
    showToast('Objective removed')
    persist(next, () => deleteObjective(o.Objective_ID), 'Failed to delete. Try again.').finally(() => setBusy(false))
  }

  function handleReadd(o) {
    const objective = {
      Objective_ID: 'obj_' + Date.now(),
      Term: o.Term,
      Text: o.Text,
      Start_Date: today(),
      Due_Date: dueDate(o.Term),
      Completed: '',
      Score: '',
    }
    showToast('Re-added')
    persist([...objectives, objective], () => addObjective(objective), 'Failed to re-add. Try again.')
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => onNavigate('dashboard')} className="text-teal-400 min-w-[48px] min-h-[48px] flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1 className="text-2xl font-bold">Objectives</h1>
      </div>

      {loading && <p className="text-gray-400">Loading objectives...</p>}
      {error && <p className="text-red-400">Error: {error}</p>}

      {!loading && !error && (
        <div className="space-y-3">
          {TERMS.map(term => {
            const open = openSections[term.id]
            const { active, completed } = byTerm[term.id]
            return (
              <div key={term.id} className="bg-gray-800 rounded-lg overflow-hidden">
                <button
                  onClick={() => setOpenSections(s => ({ ...s, [term.id]: !s[term.id] }))}
                  className="w-full text-left p-4 min-h-[48px]"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-lg">{term.label}</p>
                      <p className="text-sm text-gray-400 mt-1">{term.sub} &middot; {active.length} active</p>
                    </div>
                    <span className="text-gray-500 text-xl">{open ? '▲' : '▼'}</span>
                  </div>
                </button>

                {open && (
                  <div className="px-4 pb-4 border-t border-gray-700 pt-3 bg-gray-900">
                    {addingTo === term.id ? (
                      <div className="bg-gray-700 rounded-lg p-3 mb-3">
                        <input
                          type="text"
                          value={newText}
                          onChange={e => setNewText(e.target.value)}
                          placeholder="What do you want to achieve?"
                          autoFocus
                          className="w-full bg-gray-800 rounded-lg p-3 text-white placeholder-gray-500"
                        />
                        <p className="text-xs text-gray-400 mt-2">Due {dueDate(term.id)}</p>
                        <div className="grid grid-cols-2 gap-2 mt-3">
                          <button
                            onClick={() => { setAddingTo(null); setNewText('') }}
                            className="py-3 rounded-lg bg-gray-600 text-gray-200 font-semibold min-h-[48px]"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleAdd(term.id)}
                            disabled={!newText.trim()}
                            className="py-3 rounded-lg bg-teal-600 text-white font-semibold min-h-[48px] active:bg-teal-700 disabled:opacity-50"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setAddingTo(term.id); setNewText('') }}
                        className="w-full bg-teal-600 text-white py-3 rounded-lg font-semibold mb-3 min-h-[48px] active:bg-teal-700"
                      >
                        + Add objective
                      </button>
                    )}

                    {active.length === 0 && <p className="text-gray-400 text-sm mb-3">No active objectives.</p>}

                    <div className="space-y-3">
                      {active.map(o => {
                        const left = daysUntil(o.Due_Date)
                        if (editingId === o.Objective_ID) {
                          return (
                            <div key={o.Objective_ID} className={`${CARD} ${accent(o)}`}>
                              <input
                                type="text"
                                value={editDraft.Text}
                                onChange={e => setEditDraft(d => ({ ...d, Text: e.target.value }))}
                                autoFocus
                                className="w-full bg-gray-900 rounded-lg p-3 text-white placeholder-gray-500"
                              />
                              <div className="grid grid-cols-2 gap-2 mt-3">
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Start</p>
                                  <input
                                    type="date"
                                    value={editDraft.Start_Date}
                                    onChange={e => setEditDraft(d => ({ ...d, Start_Date: e.target.value }))}
                                    style={{ colorScheme: 'dark' }}
                                    className="w-full bg-gray-900 rounded-lg p-3 text-white min-h-[48px]"
                                  />
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Due</p>
                                  <input
                                    type="date"
                                    value={editDraft.Due_Date}
                                    onChange={e => setEditDraft(d => ({ ...d, Due_Date: e.target.value }))}
                                    style={{ colorScheme: 'dark' }}
                                    className="w-full bg-gray-900 rounded-lg p-3 text-white min-h-[48px]"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2 mt-3">
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="py-3 rounded-lg bg-gray-600 text-gray-200 font-semibold min-h-[48px]"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleSaveEdit(o)}
                                  disabled={!editDraft.Text.trim() || !editDraft.Start_Date || !editDraft.Due_Date}
                                  className="py-3 rounded-lg bg-teal-600 text-white font-semibold min-h-[48px] active:bg-teal-700 disabled:opacity-50"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          )
                        }
                        return (
                          <div key={o.Objective_ID} className={`${CARD} ${accent(o)}`}>
                            <button onClick={() => toggleExpand(o.Objective_ID)} className="w-full text-left flex justify-between items-start gap-3">
                              <div>
                                <p className="font-semibold text-lg leading-snug">{o.Text}</p>
                                <p className="text-sm text-gray-400 mt-1">
                                  {o.Start_Date} &rarr; {o.Due_Date} &middot;{' '}
                                  {left < 0
                                    ? <span className="text-red-400">Overdue by {Math.abs(left)} {Math.abs(left) === 1 ? 'day' : 'days'}</span>
                                    : <span>{left} {left === 1 ? 'day' : 'days'} left</span>}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {o.Score && <span className="text-sm text-teal-400">★ {o.Score}/5</span>}
                                <span className="text-gray-500">{expandedId === o.Objective_ID ? '▲' : '▼'}</span>
                              </div>
                            </button>

                            {expandedId === o.Objective_ID && (
                              <>
                                <p className="text-xs text-gray-500 mt-3 mb-1">Score</p>
                                <div className="grid grid-cols-5 gap-2">
                                  {[1, 2, 3, 4, 5].map(n => (
                                    <button
                                      key={n}
                                      onClick={() => handleScore(o, n)}
                                      className={`py-3 rounded-lg font-semibold min-h-[48px] ${
                                        Number(o.Score) === n ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-300 active:bg-gray-600'
                                      }`}
                                    >
                                      {n}
                                    </button>
                                  ))}
                                </div>

                                <button
                                  onClick={() => handleFinish(o)}
                                  className="w-full mt-3 bg-green-600 text-white py-3 rounded-lg font-semibold min-h-[48px] active:bg-green-700"
                                >
                                  Mark finished
                                </button>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                  <button
                                    onClick={() => startEdit(o)}
                                    className="text-gray-300 py-2 min-h-[44px] text-sm font-semibold"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleRemove(o)}
                                    className="text-red-400 py-2 min-h-[44px] text-sm font-semibold"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    <button
                      onClick={() => setOpenCompleted(s => ({ ...s, [term.id]: !s[term.id] }))}
                      className="w-full text-left mt-3 pt-3 border-t border-gray-700 min-h-[48px]"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300 font-semibold">Completed ({completed.length})</span>
                        <span className="text-gray-500 text-xl">{openCompleted[term.id] ? '▲' : '▼'}</span>
                      </div>
                    </button>

                    {openCompleted[term.id] && (
                      <div className="space-y-3 mt-3">
                        {completed.length === 0 && <p className="text-gray-400 text-sm">Nothing completed yet.</p>}
                        {completed.map(o => (
                          <div key={o.Objective_ID} className={`${CARD} ${accent(o)}`}>
                            <button onClick={() => toggleExpand(o.Objective_ID)} className="w-full text-left flex justify-between items-start gap-3">
                              <div>
                                <p className="font-semibold text-lg leading-snug">{o.Text}</p>
                                <p className="text-sm text-gray-400 mt-1">{o.Start_Date} &rarr; {o.Due_Date}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-sm text-teal-400 whitespace-nowrap">
                                  {o.Score ? '★ ' + o.Score + '/5' : 'Not rated'}
                                </span>
                                <span className="text-gray-500">{expandedId === o.Objective_ID ? '▲' : '▼'}</span>
                              </div>
                            </button>

                            {expandedId === o.Objective_ID && (
                              <div className="grid grid-cols-2 gap-2 mt-3">
                                <button
                                  onClick={() => handleReadd(o)}
                                  className="py-3 rounded-lg bg-gray-700 text-white font-semibold min-h-[48px] active:bg-gray-600"
                                >
                                  Re-add
                                </button>
                                <button
                                  onClick={() => handleRemove(o)}
                                  className="py-3 rounded-lg bg-gray-900 text-red-400 font-semibold min-h-[48px] active:bg-gray-700"
                                >
                                  Remove
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
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
