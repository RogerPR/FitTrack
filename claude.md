# FitTrack — Personal Fitness & Nutrition Tracker

## Project Status: v1 COMPLETE (Sessions 0-4 done)
App is live at https://rogerpr.github.io/FitTrack/ and installable as a PWA on Android.
Next: Session 5 (Meal Plans + Workout Suggestions) — see roadmap.md.

## Project Overview
A personal, mobile-first fitness and nutrition tracker for a single user. Static frontend hosted on GitHub Pages, with Google Apps Script as the backend API proxying all reads/writes to a Google Sheet.

## Architecture

```
┌─────────────────────┐     HTTPS JSON     ┌──────────────────────┐
│  Frontend (React)   │ ◄──────────────────►│  Google Apps Script  │
│  GitHub Pages       │                     │  (Web App endpoint)  │
│  PWA / mobile-first │                     │  reads/writes to:    │
└─────────────────────┘                     │  Google Sheets DB    │
                                            └──────────────────────┘
```

**No traditional server. No database. No Google Cloud project.**
Google Apps Script has native Sheets access — no API keys or OAuth tokens needed for the backend. The frontend calls the Apps Script deployed URL.

## Tech Stack
- **Frontend:** React (Vite) + Tailwind CSS
- **Backend:** Google Apps Script (deployed as web app)
- **Database:** Google Sheets (one spreadsheet, multiple tabs)
- **Hosting:** GitHub Pages (static build output)
- **PWA:** Service worker + manifest for Android home-screen install

## Critical Constraints
- **FREE HOSTING, CHEAP APIS.** No paid hosting, no subscriptions. The one exception is the Claude
  API, used for meal estimation and the objectives coach — pay-per-token, cents per month at
  single-user volume. Everything else stays free.
- **SINGLE USER.** No auth, no multi-user, no login screen. Just me.
- **SIMPLE OVER CLEVER.** Minimal dependencies, no over-engineering. If a feature can be done in 20 lines instead of pulling in a library, do it in 20 lines.
- **STABLE OVER PRETTY.** Reliability matters more than aesthetics. A working ugly button beats a broken beautiful one.
- **METRIC UNITS.** All weights in kg, all food in grams.
- **MOBILE-FIRST.** Every UI decision assumes a phone screen. Desktop is a bonus, not a target.

## Google Sheets Structure

One spreadsheet with these tabs:

### Tab: "Ingredients"
| Name | Calories_100g | Protein_100g | Carbs_100g | Fat_100g | Fiber_100g | Sugar_100g |
|------|---------------|--------------|------------|----------|------------|------------|

Static reference data. The frontend also keeps a local JSON copy for fast searching — synced from this tab on load.

### Tab: "Saved Meals"
| Meal_ID | Meal_Name | Ingredient | Qty_g | Calories | Protein | Carbs | Fat | Fiber | Sugar |
|---------|-----------|------------|-------|----------|---------|-------|-----|-------|-------|

Each row is one ingredient within a meal. A meal like "Oats + Banana" has 2 rows sharing the same Meal_ID.

### Tab: "Daily Meals"
| Date | Meal_ID | Meal_Name | Ingredient | Qty_g | Calories | Protein | Carbs | Fat | Fiber | Sugar |
|------|---------|-----------|------------|-------|----------|---------|-------|-----|-------|-------|

Same structure as Saved Meals but with a Date column. Date format: YYYY-MM-DD.

### Tab: "Exercises"
| Name | Category |
|------|----------|

Static reference. Categories: Biceps, Triceps, Chest, Pull, Legs, Abs.

### Tab: "Saved Routines"
| Routine_ID | Routine_Name | Exercise | Order |
|------------|--------------|----------|-------|

### Tab: "Daily Workouts"
| Date | Routine_ID | Routine_Name | Exercise | Set_Num | Reps | Weight_kg |
|------|------------|--------------|----------|---------|------|-----------|

Date format: YYYY-MM-DD.

### Tab: "Objectives"
| Objective_ID | Term | Text | Start_Date | Due_Date | Completed | Score |
|--------------|------|------|------------|----------|-----------|-------|

One row per objective. `Term` is `short` (2 weeks), `mid` (3 months), or `long` (no deadline).
**Long-term objectives leave `Due_Date` empty** — every reader must handle that. `Completed` is `y`
or empty — deliberately not TRUE/FALSE, since Sheets coerces those to booleans. `Score` is 1-5 or
empty. Dates are YYYY-MM-DD.

### Tab: "Objective Steps"
| Step_ID | Objective_ID | Step_Num | Text | Done |
|---------|--------------|----------|------|------|

One row per step. Identity is `Step_ID` (client-minted, `step_<timestamp>_<i>`) — `Step_Num` is
display order only, so appending never renumbers existing rows. `Done` is `y` or empty, same
boolean-coercion reason as `Completed`. Deleting an objective cascades to its steps server-side.

### Tab: "Profile"
| Text |
|------|

A single cell (`A2`) holding the user's free-text description of themselves, capped at 2000 chars.
Edited from the "About me" popup on the Objectives screen and prepended to `buildObjectivesContext()`
as an `# About me` block, so both objectives AI features see it. Reads tolerate a missing tab and
return `''`, so the coach keeps working before `setup()` is re-run.

## Frontend Screens

### 1. Dashboard (home screen)
- Today's date
- Summary: total calories, protein, carbs, fat (big, readable numbers)
- List of today's logged meals (with a delete/remove option each)
- Today's logged workout summary (if any)
- Two prominent action buttons: "Log Meal" and "Log Workout"

### 2. Log Meal
- Shows list of saved meals — tap one to log it to today instantly
- "Create New Meal" button at top
- Create flow: search/filter ingredients, tap to add, set quantity in grams, see running macro totals, name it, save
- After saving a new meal, also log it to today

### 3. Log Workout
- Shows list of saved routines — tap one to start it
- When a routine is selected: show all exercises pre-listed, for each exercise enter sets × reps × weight
- Allow adding/removing/swapping exercises on the fly (the user sometimes deviates from the routine)
- Save button writes to Daily Workouts
- "Create New Routine" flow: pick exercises from catalogue, order them, name it, save

### 4. History (v2 — not in initial build)
### 5. Settings (v2 — not in initial build)

## Exercise Catalogue

```
BICEPS: Dumbbell curl, Cable curl
TRICEPS: Tricep pushdown, Overhead extension
CHEST: Flat bench press, 45 degrees bench press, Shoulder press
PULL: Pull-up, Row
LEGS: Squat, Lunge, Leg press, Curl, Extension
ABS: Deadbug, Cable lateral, Lower back machine, Crunch machine, Reverse plank, Crunch
```

## Ingredient List (initial — populate with real macros per 100g)

Chicken breast, White rice, Olive oil, Banana, Oats, Whole wheat bread, Eggs, Milk, Coconut oil, Coffee, White fish, Salmon, Shrimp, Beef, Lamb, Beef hamburger meat, Potatoes, Chicken broth, Vegetable cream, Pumpkin, Pumpkin and potato cream, Ham, Cheese, Protein yoghurt.

## UX Principles
- **Logging a saved meal = 3 taps max.** Open app → tap "Log Meal" → tap the meal. Done.
- **Logging a saved workout = select routine → fill in weights → save.** Pre-fill with last session's weights where possible.
- **Optimistic UI.** Show the change immediately, write to Sheets in the background. If the write fails, show a retry.
- **Big touch targets.** Minimum 48px tap targets, generous spacing. This is used with thumbs on a phone.

## Google Apps Script API Design

The Apps Script web app exposes a single URL. All requests are POST with a JSON body containing an `action` field.

Reads whose results are always needed together are batched into a single action, since Apps Script
serializes executions per user and every extra round trip is another chance to hit the redirect 404
(see Known Gotchas):
- `getDashboard(date)` → `{ meals, workout, goals }` — what the Dashboard needs in one call
- `getObjectivesBundle` → `{ objectives, steps, profile }`

The underlying single-purpose actions are still exposed and still work.

Endpoints (actions):
- `getIngredients` → returns all rows from Ingredients tab
- `getSavedMeals` → returns all saved meals (grouped by Meal_ID)
- `saveMeal` → writes rows to Saved Meals tab
- `logMeal` → writes rows to Daily Meals tab
- `getDailyMeals(date)` → returns meals for a given date
- `deleteDailyMeal(date, mealId)` → removes a meal from a day
- `getExercises` → returns exercise catalogue
- `getSavedRoutines` → returns all saved routines
- `saveRoutine` → writes rows to Saved Routines tab
- `logWorkout` → writes rows to Daily Workouts tab
- `getDailyWorkout(date)` → returns workout for a given date
- `getLastWorkoutWeights(routineId)` → returns most recent weights for a routine's exercises
- `getObjectives` → returns all rows from the Objectives tab (flat array)
- `addObjective(objective)` → appends one objective row
- `updateObjective(id, fields)` → sets the given columns on the matching Objective_ID row
- `deleteObjective(id)` → removes the objective row, and cascades to its steps
- `getObjectiveSteps` → returns all rows from the Objective Steps tab (flat array)
- `addObjectiveSteps(steps)` → appends step rows
- `updateObjectiveStep(id, fields)` → sets the given columns on the matching Step_ID row
- `deleteObjectiveStep(id)` → removes the step row
- `objectivesChat(messages, model, decisions?)` → multi-turn chat over the objectives context →
  `{ reply, content, actions, toolResults }`. The coach has tools that edit objectives; a turn that
  calls one returns `actions` (proposals) and writes nothing. Sending the same `messages` back with
  `decisions` (a map of tool_use id → true/false) runs the approved ones and continues the turn.
- `suggestSteps(objectiveId, model)` → generates 2-10 steps for one objective → `{ steps: [...] }`
- `getProfile` / `saveProfile(text)` → the user's free-text "About me" note
- `getGoals` / `saveGoals(goals)` → macro targets
- `getBodyLog` / `logBody(entry)` / `deleteBodyLog(date, weight, fat)` → weight and body-fat log
- `getMealUsageCounts` → how often each saved meal has been logged
- `addIngredient(ingredient)` → appends one ingredient row
- `analyzeFood(image)` / `describeMeal(text)` → macro estimation via Gemini (free tier)
- `analyzeFoodPaid(image)` / `describeMealPaid(text)` → same, via Claude

All responses: `{ success: true, data: ... }` or `{ success: false, error: "message" }`.

## LLM Usage

Two providers, both called server-side from `Code.gs` via `UrlFetchApp`. No SDK (Apps Script has no
npm) and no key ever reaches the frontend.

| Feature | Model | Notes |
|---------|-------|-------|
| `analyzeFood`, `describeMeal` | `gemini-2.5-flash` | Free tier |
| `analyzeFoodPaid`, `describeMealPaid` | `claude-sonnet-4-6` | |
| `objectivesChat`, `suggestSteps` | `claude-sonnet-5` default, `claude-opus-5` via toggle | Model choice persists in `localStorage['fittrack_ai_model']` |

Objectives AI notes:
- `buildObjectivesContext()` in `Code.gs` renders the Profile note, then every objective, its dates,
  and its steps into one text block shared by both features. It goes in the `system` parameter.
  **The frontend never sends the objectives or the profile** — the backend reads the Sheet directly.
- Overdue days are precomputed server-side rather than left for the model to derive from dates.
- Keep adaptive thinking on and control cost with `output_config.effort` (`low` for chat, `medium`
  for steps). Explicitly disabling thinking on Opus 5 leaks `<thinking>` tags into the reply, and is
  a 400 at `xhigh`/`max` effort.
- With adaptive thinking on, `content[0]` may be a thinking block — collect the `text` blocks
  instead of indexing. `callClaude()` does this.
- The chat is **not fitness-flavoured** — objectives are general life goals. Keep FitTrack, meals,
  and workouts out of that prompt and out of its context.
- **The coach's tools never write without confirmation.** `OBJECTIVE_TOOLS` (`add_objective`,
  `add_steps`, `update_objective`, `delete_objective`) come back as `tool_use` blocks that the
  backend turns into `actions` and returns unexecuted. `runObjectiveTool()` only runs on a second
  request carrying `decisions`. The frontend blocks the input box until the user picks Do it/Skip,
  since a dangling `tool_use` with no `tool_result` is a 400 on the next turn.
- **Assistant turns are stored as raw `content` blocks, not strings.** Thinking blocks carry
  signatures the API rejects if edited, so the client replays `content` verbatim and renders only
  the `text` blocks (`textOf()` in `ObjectivesChat.jsx`).
- **No streaming is possible in Apps Script.** `UrlFetchApp` blocks, so a chat turn is one round
  trip with a pending indicator. `effort: 'low'` is the main latency lever.

## Deployment & Infrastructure
- **Frontend:** GitHub Pages, auto-deployed via GitHub Actions on push to `main` (`.github/workflows/deploy.yml`)
- **API URL:** Stored in `src/config.js` (gitignored). Injected during CI via `VITE_API_URL` GitHub Actions secret.
- **Vite base path:** `/FitTrack/` (configured in `vite.config.js`)
- **PWA:** `public/manifest.json` + `public/sw.js` (network-first, cache fallback for offline)
- **Apps Script deployment:** Must select "New version" when redeploying, or the live web app won't update.

## Key Files
- `src/App.jsx` — Root component, tab navigation, offline banner
- `src/components/Dashboard.jsx` — Daily summary, macro totals, meal/workout lists, refresh button
- `src/components/LogMeal.jsx` — Saved meals list, "Log to Today", Create Meal flow
- `src/components/LogWorkout.jsx` — Saved routines, Create Routine, Log Workout Session with pre-fill
- `src/components/Objectives.jsx` — Objectives sub-app: short/mid/long term collapsible sections, add/score/finish/re-add/remove, per-objective steps, "About me" profile popup
- `src/components/ObjectivesChat.jsx` — Goal-coach chat with starter prompts, a Sonnet/Opus toggle, and the confirm-before-write card for proposed objective edits
- `src/api/sheets.js` — All API functions (POST to Apps Script)
- `src/config.js` — API_URL (gitignored, generated in CI from secret)
- `src/data/ingredients.json` — 24 ingredients with macros (local cache)
- `src/data/exercises.json` — 20 exercises with categories (local cache)
- `Code.gs` — Apps Script backend (local copy, must be manually synced to script editor)

## Known Gotchas
- **Apps Script `instanceof Date` is broken.** `getValues()` returns Date objects that fail `instanceof Date`. Use `typeof val.getTime === 'function'` instead.
- **`setup()` must be re-run after adding a Sheets tab.** It is idempotent and won't touch existing data, but a missing tab surfaces as a runtime error on the first read.
- **Long-term objectives have no `Due_Date`.** `daysUntil()` returns `null` for an empty date rather than `NaN`; anything rendering a due date or urgency colour must branch on it.
- **Intermittent HTTP 404 on API calls.** A POST to `/exec` is answered with a 302 to
  `script.googleusercontent.com/macros/echo?user_content_key=...`; `fetch` follows it transparently,
  so `res.status` is the status of that *second* hop, which Google intermittently 404s. It is not a
  bad API URL — a wrong URL fails every time, not sometimes. `callApi()` retries these (plus 429/5xx)
  twice with backoff, but **only for `get*` actions**: the redirect is issued after `doPost` has
  already run, so retrying a write would duplicate the row. Writes surface the error for a manual
  retry instead.
- **Apps Script deployment versioning.** Editing code in the script editor does NOT update the live web app. Must: Manage deployments → edit → Version: "New version" → Deploy.
- **`src/config.js` is gitignored.** The API URL is injected via the `VITE_API_URL` GitHub Actions secret during CI build. Update both local file and secret when the deployment URL changes.

## Code Style
- Minimal comments — only where something non-obvious happens.
- No preference on TypeScript vs JavaScript — pick whatever is simpler for this project.
- Flat file structure preferred. Don't over-nest folders.
- No linting, no tests, no CI — this is a personal tool.

## What NOT To Do
- Don't add authentication or user management.
- Don't add a traditional database (Supabase, Firebase, etc.).
- Don't add features not described in this document.
- Don't install heavy libraries for things that can be done simply.
- Don't optimize for performance beyond "feels fast on a phone."
- Don't build the History or Settings screens in v1.
