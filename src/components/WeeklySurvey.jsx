import { useState } from 'react'
import { saveWeeklySurvey } from '../api/sheets'

const TERM_LABEL = { short: 'Short term', mid: 'Mid term' }

export default function WeeklySurvey({ objectives, date, onClose, onSaved }) {
  const [scores, setScores] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const rated = objectives.filter(o => scores[o.Objective_ID]).length

  function pick(o, n) {
    setScores(s => ({ ...s, [o.Objective_ID]: s[o.Objective_ID] === n ? '' : n }))
  }

  // Not optimistic: writes are never retried by callApi, so a silent failure
  // would lose the whole survey.
  async function handleSave() {
    const rows = objectives.map(o => ({
      Date: date,
      Objective_ID: o.Objective_ID,
      Term: o.Term,
      Text: o.Text,
      Score: scores[o.Objective_ID],
    }))
    setSaving(true)
    setError(null)
    try {
      await saveWeeklySurvey(rows)
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    // pb clears the fixed save bar plus the fixed bottom nav beneath it
    <div className="p-4 pb-40">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onClose} className="text-teal-400 min-w-[48px] min-h-[48px] flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1 className="text-2xl font-bold flex-1">Weekly survey</h1>
      </div>

      {objectives.length === 0 ? (
        <p className="text-gray-400">No active short or mid term objectives to rate.</p>
      ) : (
        <>
          <p className="text-sm text-gray-400 mb-4">
            How well are you pursuing each one this week? 1 = not at all, 5 = fully on track.
          </p>

          <div className="space-y-3">
            {objectives.map(o => (
              <div key={o.Objective_ID} className="bg-gray-800 rounded-xl p-4">
                <p className="font-semibold">{o.Text}</p>
                <p className="text-xs text-gray-500 mt-1 mb-3">{TERM_LABEL[o.Term] || o.Term}</p>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => pick(o, n)}
                      className={`py-3 rounded-lg font-semibold min-h-[48px] ${
                        scores[o.Objective_ID] === n ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-300 active:bg-gray-600'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="fixed bottom-20 left-0 right-0 p-4 bg-gray-900 border-t border-gray-800">
            {error && <p className="text-red-400 text-sm mb-2">Error: {error}</p>}
            <button
              onClick={handleSave}
              disabled={saving || rated < objectives.length}
              className="w-full py-3 rounded-lg bg-teal-600 text-white font-semibold min-h-[48px] active:bg-teal-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : `Save survey (${rated}/${objectives.length} rated)`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
