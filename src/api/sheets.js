import { API_URL } from '../config.js'

async function callApi(action, params = {}) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, key: localStorage.getItem('fittrack_pw') || '', ...params }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'Unknown error')
  return json.data
}

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
