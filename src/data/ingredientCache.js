import { getIngredients, readCache, writeCache } from '../api/sheets'
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

// What a screen renders at once: the last list from the Sheet, or the bundled one.
// Never waits on the network - getIngredientsList() refreshes in the background.
export function readIngredientsNow() {
  const stored = readCache('getIngredients')
  return dedupe(stored && stored.length > 0 ? stored : fallbackData)
}

export function getIngredientsList() {
  if (!cached) {
    cached = getIngredients()
      .then(data => dedupe(data && data.length > 0 ? data : fallbackData))
      .catch(() => {
        // Don't pin the bundled list for the session — retry on the next screen open
        cached = null
        return dedupe(fallbackData)
      })
  }
  return cached
}

export function invalidateIngredientCache() { cached = null }

// A just-added ingredient is searchable immediately rather than after the next read.
export function rememberIngredient(ing) {
  const list = readIngredientsNow().filter(i => i.Name !== ing.Name)
  writeCache('getIngredients', {}, [...list, ing])
  invalidateIngredientCache()
}
