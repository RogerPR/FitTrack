import { API_URL } from '../config.js'

// Apps Script answers a POST with a 302 to script.googleusercontent.com, and that
// second hop intermittently 404s. Only reads are retried: by the time the redirect
// is issued the script has already run, so retrying a write would duplicate it.
const RETRYABLE = new Set([404, 429, 500, 502, 503])

async function callApi(action, params = {}) {
  const body = JSON.stringify({ action, key: localStorage.getItem('fittrack_pw') || '', ...params })
  const canRetry = action.startsWith('get')

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
    })
    if (res.ok) {
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Unknown error')
      return json.data
    }
    if (!canRetry || !RETRYABLE.has(res.status) || attempt >= 2) throw new Error(`HTTP ${res.status}`)
    await new Promise(r => setTimeout(r, 400 * 2 ** attempt))
  }
}

export const getDashboard = (date) => callApi('getDashboard', { date })
export const getObjectivesBundle = () => callApi('getObjectivesBundle')
export const getIngredients = () => callApi('getIngredients')
export const getSavedMeals = () => callApi('getSavedMeals')
export const saveMeal = (rows) => callApi('saveMeal', { rows })
export const logMeal = (rows) => callApi('logMeal', { rows })
export const getDailyMeals = (date) => callApi('getDailyMeals', { date })
export const deleteDailyMeal = (date, mealId) => callApi('deleteDailyMeal', { date, mealId })
export const getExercises = () => callApi('getExercises')
export const getSavedRoutines = () => callApi('getSavedRoutines')
export const saveRoutine = (rows) => callApi('saveRoutine', { rows })
export const logWorkout = (rows) => callApi('logWorkout', { rows })
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
export const objectivesChat = (messages, model, decisions) => callApi('objectivesChat', { messages, model, decisions })
export const suggestSteps = (objectiveId, model, steering) => callApi('suggestSteps', { objectiveId, model, steering })
