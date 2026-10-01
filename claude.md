# FitTrack — Personal Fitness & Nutrition Tracker

## Project Status: v1 COMPLETE (Sessions 0-4 done) + Stabilization Stage 1
App is live at https://rogerpr.github.io/FitTrack/ and installable as a PWA on Android.
Next: Session 5 (Meal Plans + Workout Suggestions), and Stabilization Stage 2 (Cloudflare Worker) when
the new features need it — both in roadmap.md.

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
| Date | Meal_ID | Meal_Name | Ingredient | Qty_g | Calories | Protein | Carbs | Fat | Fiber | Sugar | Log_ID |
|------|---------|-----------|------------|-------|----------|---------|-------|-----|-------|-------|--------|

Same structure as Saved Meals but with a Date column. Date format: YYYY-MM-DD.

`Log_ID` (`log_<timestamp>_<random>`, client-minted) identifies one *logging event*: every row of a
meal logged at once shares it. `logMeal` skips a request whose `Log_ID` is already in the tab, so the
client can replay a write it never got a response for. Reads group by `Log_ID`, falling back to
`Meal_ID` for rows written before the column existed (those have it empty). The same saved meal logged
twice in a day is therefore two entries, not one.

### Tab: "Exercises"
| Name | Category |
|------|----------|

Static reference. Categories: Biceps, Triceps, Chest, Pull, Legs, Abs.

### Tab: "Saved Routines"
| Routine_ID | Routine_Name | Exercise | Order |
|------------|--------------|----------|-------|

### Tab: "Daily Workouts"
| Date | Routine_ID | Routine_Name | Exercise | Set_Num | Reps | Weight_kg | Log_ID |
|------|------------|--------------|----------|---------|------|-----------|--------|

Date format: YYYY-MM-DD. `Log_ID` works exactly as in Daily Meals: one per saved session, deduped
server-side, grouped on read with `Routine_ID` as the fallback for old rows.

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

### Tab: "Weekly Survey"
| Date | Objective_ID | Term | Text | Score |
|------|--------------|------|------|-------|

One row per objective per submission, written by the "Weekly survey" button on the Objectives
screen. Covers only *active* short- and mid-term objectives. `Text` is a denormalized snapshot of
the objective wording so the raw sheet reads without joining back to Objectives. Nothing in the app
reads this data back — it exists to be looked at in Sheets — and it is deliberately **not** part of
`buildObjectivesContext()`. No cadence enforcement: submitting twice in a week appends twice.

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
- `getMealsBundle` → `{ meals, counts }` — saved meals plus usage counts for the Log Meal list

The underlying single-purpose actions are still exposed and still work.

Endpoints (actions):
- `getIngredients` → returns all rows from Ingredients tab
- `getSavedMeals` → returns all saved meals (grouped by Meal_ID)
- `saveMeal` → writes rows to Saved Meals tab
- `logMeal` → writes rows to Daily Meals tab; no-op if the rows' `Log_ID` is already there
- `getDailyMeals(date)` → returns meals for a given date, grouped by `Log_ID`
- `deleteDailyMeal(date, mealId, logId?)` → removes one logging event by `logId`, or every row
  matching date + mealId when `logId` is absent (old rows)
- `getExercises` → returns exercise catalogue
- `getSavedRoutines` → returns all saved routines
- `saveRoutine` → writes rows to Saved Routines tab
- `logWorkout` → writes rows to Daily Workouts tab; same `Log_ID` dedupe as `logMeal`
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
- `saveWeeklySurvey(rows)` → appends weekly survey rows (one per objective)
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
| `analyzeFoodPaid`, `describeMealPaid` | `claude-sonnet-5` | Via `callClaude()`, effort `low` |
| `objectivesChat`, `suggestSteps` | `claude-sonnet-5` default, `claude-opus-5-5` via toggle | Model choice persists in `localStorage['fittrack_ai_model']` |

Objectives AI notes:
- `buildObjectivesContext()` in `Code.gs` renders the Profile note, then every objective, its dates,
  and its steps into one text block shared by both features. It goes in the `system` parameter.
  **The frontend never sends the objectives or the profile** — the backend reads the Sheet directly.
- Overdue days are precomputed server-side rather than left for the model to derive from dates.
- Keep adaptive thinking on and control cost with `output_config.effort` (`low` for chat, `medium`
  for steps). Opus 5.5 cannot disable thinking at all (400), and Sonnet 5 thinks by default, so
  effort is the only cost lever. Opus 5.5 defaults to `medium` effort, so always set it explicitly.
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
- **PWA:** `public/manifest.json` + `public/sw.js`. Cache-first: hashed assets are served from cache
  forever, `index.html` is served from cache and refreshed in the background. When the fresh HTML
  differs the SW posts `update-available` and `App.jsx` shows a "New version · Reload" bar. The SW
  stays out of the way on `localhost` so dev/HMR is unaffected.
- **Apps Script deployment:** Must select "New version" when redeploying, or the live web app won't update.

## Key Files
- `src/App.jsx` — Root component, tab navigation, offline banner
- `src/components/Dashboard.jsx` — Daily summary, macro totals, meal/workout lists, refresh button
- `src/components/LogMeal.jsx` — Saved meals list, "Log to Today", Create Meal flow
- `src/components/LogWorkout.jsx` — Saved routines, Create Routine, Log Workout Session with pre-fill
- `src/components/Objectives.jsx` — Objectives sub-app: short/mid/long term collapsible sections, add/score/finish/re-add/remove, per-objective steps, "About me" profile popup, "Weekly survey" button
- `src/components/WeeklySurvey.jsx` — Weekly check-in: rates every active short/mid objective 1-5, appends one dated row each
- `src/components/ObjectivesChat.jsx` — Goal-coach chat with starter prompts, a Sonnet/Opus toggle, and the confirm-before-write card for proposed objective edits
- `src/api/sheets.js` — All API functions (POST to Apps Script), plus the read cache, the write
  outbox, the API timings ring buffer, and the cold-open gate (`afterDashboard`)
- `src/config.js` — API_URL (gitignored, generated in CI from secret)
- `src/data/ingredients.json` — 24 ingredients with macros (local cache)
- `src/data/exercises.json` — 20 exercises with categories (local cache)
- `Code.gs` — Apps Script backend (local copy, must be manually synced to script editor)

## Known Gotchas
- **Apps Script `instanceof Date` is broken.** `getValues()` returns Date objects that fail `instanceof Date`. Use `typeof val.getTime === 'function'` instead.
- **Never call a service per cell.** `Session.getScriptTimeZone()` / `Utilities.formatDate()` are
  round trips; called once per Date cell they cost seconds per read on the log tabs (measured
  2026-10-01: 7–35s for an empty day). `normalizeDate()` builds `yyyy-MM-dd` from the V8 Date
  getters, which already run in the script's time zone. Keep it that way.
- **Log tabs are read columns-first, block-second.** `getSheetData()` (whole tab) is only for the
  small reference tabs. Anything over Daily Meals / Daily Workouts goes through `readColumns()` (the
  one or two columns the query filters on) and then `readRowBlock()` for the first..last matching
  row — see `rowsForDate()`. A day's read is then ~20 Sheets calls regardless of history, instead
  of thousands.
- **`setup()` must be re-run after adding a Sheets tab.** It is idempotent and won't touch existing data, but a missing tab surfaces as a runtime error on the first read.
- **Long-term objectives have no `Due_Date`.** `daysUntil()` returns `null` for an empty date rather than `NaN`; anything rendering a due date or urgency colour must branch on it.
- **Intermittent HTTP 404 on API calls.** A POST to `/exec` is answered with a 302 to
  `script.googleusercontent.com/macros/echo?user_content_key=...`; `fetch` follows it transparently,
  so `res.status` is the status of that *second* hop, which Google intermittently 404s. It is not a
  bad API URL — a wrong URL fails every time, not sometimes. `callApi()` retries any failure
  (bad status, network error, unparsable body) up to 5 times, delays `0, 0.5, 1, 2s` (the 404 is
  instant, so the first retry is too), but **only for `get*` actions and `IDEMPOTENT_ACTIONS`**
  (`saveMeal`, `saveRoutine`, `addIngredient`, which `appendOnce()` dedupes on their own id): the
  redirect is issued after `doPost` has already run, so blindly retrying any other write could
  duplicate the row. Every successful
  read is cached in `localStorage` under `fittrack_cache:<action>:<params>`; when a read's retries
  are exhausted the cached copy is returned and a `fittrack-stale` window event shows the yellow
  "showing last saved data" banner in `App.jsx`.
- **Every screen renders from cache first and refreshes in the background.** Screens seed state via
  `readCache()` and show a small "Updating..." line rather than a spinner. The dashboard on the first
  open of a day (no cache for that date yet) renders empty with the last known goals instead of
  "Loading...". Sheets stays authoritative: on returning to the app after 60s+ away, `App.jsx` bumps
  `focusKey`/`refreshKey`; the dashboard and the **visible** tab re-pull at once and the other
  screens re-pull when next shown (`loadedFor` ref vs `focusKey` in each screen), so edits from
  another device or made directly in the Sheet show up without a four-wide burst of executions.
- **Write outbox is pending-first, and the write is the confirmation.** `logMeal` and `logWorkout`
  go into `localStorage['fittrack_outbox']` *before* they are sent, keyed by `Log_ID`. Entry states:
  pending (in flight, dashboard tag "saving…"), `failed` (transport failure or server rejection with
  `error`; tag "unsent", orange "N unsent entries · Retry" bar in `App.jsx`). On acknowledgement
  `sendLogged()` merges the rows into `fittrack_cache:getDashboard:{date}` under their `Log_ID`
  (`mergeIntoDashboardCache`) and drops the entry; the dashboard re-seeds from cache on the
  `fittrack-outbox` event. **No read-back after a write** — that was one more full execution per
  log; the next focus refresh reconciles with the Sheet. `flushOutbox()` replays every entry
  oldest-first on start, on `online`, on focus and on Retry, skipping ones in flight. Replay is only
  safe because the server dedupes on `Log_ID` — **a new Daily Meals row without a `Log_ID` means the
  live Apps Script deployment is stale, and every replay will duplicate rows.** Failed entries are
  never dropped automatically; deleting one from the dashboard removes it. Deleting an acknowledged
  entry goes through `deleteDailyMeal` by `Log_ID` and `dropFromDashboardCache()`. All other writes
  still surface their error for a manual retry.
- **The ingredient list never waits on the network.** `readIngredientsNow()` (localStorage copy or
  the bundled JSON) seeds Create Meal / Log Ingredient / Suggest Meals; `getIngredientsList()` only
  refreshes in the background, and `rememberIngredient()` puts a just-added one into the cache.
- **`removeDuplicateLogRows(dryRun)` in `Code.gs`** cleans replay duplicates from the Sheet (rows
  identical on every column, only for per-log IDs `ing_/desc_/snap_/custom_`, any row with a `Log_ID`,
  and workouts). Run it from the script editor: no argument logs what it would delete;
  `removeDuplicateLogRowsNow()` (the Run button can't pass arguments) deletes. Saved-meal re-logs are never touched.
- **Cold open is staggered.** All five screens are mounted at once (hidden divs), so their mount
  effects used to fire seven Apps Script calls in parallel. Now non-dashboard screens wrap their first
  load in `afterDashboard()`, which waits for the dashboard read (or 3s). Settings only loads when its
  tab is shown. Keep it that way when adding screens.
- **API timings** for the last 20 calls (duration, attempts, cache fallback, last error) are under
  Settings, from a ring buffer `callApi` keeps in `localStorage['fittrack_timings']`. The Apps
  Script floor is ~2.3s per call (2026-10-01); anything well above it is a slow execution, not the
  network.
- **`setup()` never moves columns.** It appends any missing header after the last column, so re-running
  it after adding a column (like `Log_ID`) is safe on tabs with data. Adding a column therefore means:
  add it to `setup()`, re-run `setup()`, then deploy the code that writes it.
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
