import { getIngredients } from '../api/sheets'
import fallbackData from './ingredients.json'

let cached = null

export function getIngredientsList() {
  if (!cached) {
    cached = getIngredients()
      .then(data => data && data.length > 0 ? data : fallbackData)
      .catch(() => fallbackData)
  }
  return cached
}

export function invalidateIngredientCache() { cached = null }
