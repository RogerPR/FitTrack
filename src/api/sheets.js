import { API_URL } from '../config.js'

// Apps Script answers a POST with a 302 to script.googleusercontent.com, and that
// second hop intermittently 404s. Reads are retried (first retry immediately, the
// 404 is instant rather than a timeout) and every successful read is cached in
// localStorage; when retries are exhausted the last good copy is served instead.
//
// Writes are not retried in place: by the time the redirect is issued the script has
// already run, so a blind retry could duplicate the row. Log writes carry a Log_ID the
// server dedupes on, which makes them safe to replay, so logMeal/logWorkout go through
// an outbox (see below) and are replayed until the server acknowledges them. Other
// writes surface the error for a manual retry.
const MAX_ATTEMPTS = 5
const RETRY_DELAYS = [0, 500, 1000, 2000]
const OUTBOX_KEY = 'fittrack_outbox'
const OUTBOX_ACTIONS = new Set(['logMeal', 'logWorkout'])
const TIMINGS_KEY = 'fittrack_timings'
const TIMINGS_MAX = 20

function cacheKey(action, params) {
  return `fittrack_cache:${action}:${JSON.stringify(params)}`
}

export function readCache(action, params = {}) {
  try {
    const raw = localStorage.getItem(cacheKey(action, params))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function writeCache(action, params, data) {
  try {
    localStorage.setItem(cacheKey(action, params), JSON.stringify(data))
  } catch {
    // Quota exceeded or storage blocked — the cache is a best-effort extra
  }
}

// One id per logging event, stamped on every row of it. The server skips a write
// whose Log_ID it already has, so the same request can be sent twice safely.
export function newLogId() {
  return 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
}

// Log writes can be replayed from the outbox, so a caller that forgot the Log_ID
// would otherwise get a duplicate on every replay.
function withLogId(rows) {
  if (!rows?.length || rows[0].Log_ID) return rows
  const id = newLogId()
  return rows.map(r => ({ ...r, Log_ID: id }))
}

// --- Timings ring buffer (shown under Settings) ---

function recordTiming(action, ms, attempts, cached) {
  try {
    const list = JSON.parse(localStorage.getItem(TIMINGS_KEY) || '[]')
    list.unshift({ action, ms: Math.round(ms), attempts, cached, at: Date.now() })
    localStorage.setItem(TIMINGS_KEY, JSON.stringify(list.slice(0, TIMINGS_MAX)))
  } catch {
    // best effort
  }
}

export function readTimings() {
  try {
    return JSON.parse(localStorage.getItem(TIMINGS_KEY) || '[]')
  } catch {
    return []
  }
}

// --- Outbox ---
//
// Every log write lives here from the moment it is requested until a server read has
// returned it, so the dashboard can show it at once and keep showing it while the
// (slow) write and the following read complete. Entry states, keyed by Log_ID:
//   pending — being sent right now (no flag)
//   failed  — transport failure or server rejection (`error` set); replayed by
//             flushOutbox() / the Retry bar. Never dropped automatically: the user can
//             delete it from the dashboard.
//   sent    — acknowledged by the server; dropped by markOutboxConfirmed() once a read
//             for its date includes it.

export function readOutbox() {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]')
  } catch {
    return []
  }
}

function writeOutbox(list) {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(list))
  } catch {
    // best effort
  }
  window.dispatchEvent(new Event('fittrack-outbox'))
}

export function outboxId(entry) {
  return entry.params?.rows?.[0]?.Log_ID
}

export function outboxDate(entry) {
  return entry.params?.rows?.[0]?.Date
}

function enqueue(action, params) {
  const id = params.rows?.[0]?.Log_ID
  const list = readOutbox()
  if (list.some(e => outboxId(e) === id)) return
  writeOutbox([...list, { action, params, ts: Date.now() }])
}

function patchOutbox(id, patch) {
  writeOutbox(readOutbox().map(e => outboxId(e) === id ? { ...e, ...patch } : e))
}

export function removeOutboxWhere(pred) {
  writeOutbox(readOutbox().filter(e => !pred(e)))
}

// Drops acknowledged entries for `date` that the server now returns. `presentIds` is
// the set of Log_IDs in the fresh read; null means the server doesn't return Log_IDs
// (stale deployment), in which case every acknowledged entry for the date is dropped.
export function markOutboxConfirmed(date, presentIds) {
  removeOutboxWhere(e => e.sent && outboxDate(e) === date && (!presentIds || presentIds.has(outboxId(e))))
}

const inFlight = new Set()

async function sendLogged(action, params) {
  const id = params.rows?.[0]?.Log_ID
  enqueue(action, params)
  // A replay starts out as pending again, so the dashboard tag and the Retry bar
  // reflect the attempt in progress rather than the previous failure
  patchOutbox(id, { failed: false, error: undefined })
  inFlight.add(id)
  const t0 = performance.now()
  try {
    const data = await rawRequest(action, params)
    patchOutbox(id, { sent: true, failed: false, error: undefined })
    recordTiming(action, performance.now() - t0, 1, false)
    return data
  } catch (err) {
    patchOutbox(id, { failed: true, error: err.final ? err.message : undefined })
    recordTiming(action, performance.now() - t0, 1, false)
    // A transport failure will be replayed, so from the caller's side it is saved.
    // A server rejection stays visible as unsent and is reported to the caller.
    if (!err.final) err.queued = true
    throw err
  } finally {
    inFlight.delete(id)
  }
}

let flushing = false

// Replays unacknowledged entries oldest first. A transport failure stops the pass (the
// network is down, later entries would fail too); a server rejection moves on.
export async function flushOutbox() {
  if (flushing || !navigator.onLine) return
  flushing = true
  try {
    for (const entry of readOutbox()) {
      if (entry.sent || inFlight.has(outboxId(entry))) continue
      try {
        await sendLogged(entry.action, entry.params)
      } catch (err) {
        if (!err.final) break
      }
    }
  } finally {
    flushing = false
  }
}

// --- Cold-open staggering ---
// Other screens hold their first read until the dashboard's has finished (or 3s pass),
// so the first Apps Script call isn't competing with six others.

let dashboardLoaded = false

// Called before a focus refresh so the other screens queue behind the dashboard again.
export function resetDashboardGate() {
  dashboardLoaded = false
}

export function markDashboardLoaded() {
  dashboardLoaded = true
  window.dispatchEvent(new Event('fittrack-dashboard-loaded'))
}

export function afterDashboard(fn) {
  if (dashboardLoaded) return fn()
  let done = false
  const run = () => {
    if (done) return
    done = true
    window.removeEventListener('fittrack-dashboard-loaded', run)
    fn()
  }
  window.addEventListener('fittrack-dashboard-loaded', run)
  setTimeout(run, 3000)
}

// --- Transport ---

async function rawRequest(action, params) {
  const body = JSON.stringify({ action, key: localStorage.getItem('fittrack_pw') || '', ...params })
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (!json.success) throw Object.assign(new Error(json.error || 'Unknown error'), { final: true })
  return json.data
}

async function callApi(action, params = {}) {
  if (OUTBOX_ACTIONS.has(action)) return sendLogged(action, params)
  const isRead = action.startsWith('get')
  const t0 = performance.now()

  for (let attempt = 0; ; attempt++) {
    try {
      const data = await rawRequest(action, params)
      if (isRead) {
        writeCache(action, params, data)
        window.dispatchEvent(new Event('fittrack-fresh'))
      }
      recordTiming(action, performance.now() - t0, attempt + 1, false)
      return data
    } catch (err) {
      if (err.final) {
        recordTiming(action, performance.now() - t0, attempt + 1, false)
        throw err
      }
      if (!isRead) {
        recordTiming(action, performance.now() - t0, attempt + 1, false)
        throw err
      }
      if (attempt < MAX_ATTEMPTS - 1) {
        const delay = RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)]
        if (delay) await new Promise(r => setTimeout(r, delay))
        continue
      }
      const cached = readCache(action, params)
      recordTiming(action, performance.now() - t0, attempt + 1, cached !== null)
      if (cached === null) throw err
      window.dispatchEvent(new Event('fittrack-stale'))
      return cached
    }
  }
}

export const getDashboard = (date) => callApi('getDashboard', { date })
export const getObjectivesBundle = () => callApi('getObjectivesBundle')
export const getMealsBundle = () => callApi('getMealsBundle')
export const getIngredients = () => callApi('getIngredients')
export const getSavedMeals = () => callApi('getSavedMeals')
export const saveMeal = (rows) => callApi('saveMeal', { rows })
export const logMeal = (rows) => callApi('logMeal', { rows: withLogId(rows) })
export const getDailyMeals = (date) => callApi('getDailyMeals', { date })
export const deleteDailyMeal = (date, mealId, logId) => callApi('deleteDailyMeal', { date, mealId, logId })
export const getExercises = () => callApi('getExercises')
export const getSavedRoutines = () => callApi('getSavedRoutines')
export const saveRoutine = (rows) => callApi('saveRoutine', { rows })
export const logWorkout = (rows) => callApi('logWorkout', { rows: withLogId(rows) })
export const getDailyWorkout = (date) => callApi('getDailyWorkout', { date })
export const getLastWorkoutWeights = (routineId) => callApi('getLastWorkoutWeights', { routineId })
export const getGoals = () => callApi('getGoals')
export const saveGoals = (goals) => callApi('saveGoals', { goals })
export const getBodyLog = () => callApi('getBodyLog')
export const logBody = (entry) => callApi('logBody', { entry })
export const deleteBodyLog = (date, weight, fat) => callApi('deleteBodyLog', { date, weight, fat })
export const getMealUsageCounts = () => callApi('getMealUsageCounts')
export const analyzeFood = (image) => callApi('analyzeFood', { image })
export const describeMeal = (text) => callApi('describeMeal', { text })
export const analyzeFoodPaid = (image) => callApi('analyzeFoodPaid', { image })
export const describeMealPaid = (text) => callApi('describeMealPaid', { text })
export const addIngredient = (ingredient) => callApi('addIngredient', { ingredient })
export const getObjectives = () => callApi('getObjectives')
export const addObjective = (objective) => callApi('addObjective', { objective })
export const updateObjective = (id, fields) => callApi('updateObjective', { id, fields })
export const deleteObjective = (id) => callApi('deleteObjective', { id })
export const getObjectiveSteps = () => callApi('getObjectiveSteps')
export const addObjectiveSteps = (steps) => callApi('addObjectiveSteps', { steps })
export const updateObjectiveStep = (id, fields) => callApi('updateObjectiveStep', { id, fields })
export const deleteObjectiveStep = (id) => callApi('deleteObjectiveStep', { id })
export const saveWeeklySurvey = (rows) => callApi('saveWeeklySurvey', { rows })
export const getProfile = () => callApi('getProfile')
export const saveProfile = (text) => callApi('saveProfile', { text })
export const objectivesChat = (messages, model, decisions) => callApi('objectivesChat', { messages, model, decisions })
export const suggestSteps = (objectiveId, model, steering) => callApi('suggestSteps', { objectiveId, model, steering })
