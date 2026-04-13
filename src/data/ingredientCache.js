import { getIngredients } from '../api/sheets'
import fallbackData from './ingredients.json'

let cached = null

function dedupe(list) {
  const seen = new Set()
  return list.filter(item => {
    if (seen.has(item.Name)) return false
    seen.add(item.Name)
    return true
  })
}

export function getIngredientsList() {
  if (!cached) {
    cached = getIngredients()
      .then(data => dedupe(data && data.length > 0 ? data : fallbackData))
      .catch(() => dedupe(fallbackData))
  }
  return cached
}

export function invalidateIngredientCache() { cached = null }
