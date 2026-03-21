# FitTrack — Development Roadmap

> **How to use:** At the start of each Claude Code session, paste the full `claude.md` file, then paste the specific session section below. Tell Claude Code: "This is Session N. Here are the goals." After each major step, test before moving on.

---

## SESSION 0 — Project Scaffolding + Google Apps Script Backend

**Goal:** App skeleton runs locally. Google Apps Script backend is deployed and can read/write to Google Sheets.

### Pre-work (you do this manually before starting Claude Code):
1. Create a new Google Sheet called "FitTrack"
2. Create these tabs (empty, just the names): `Ingredients`, `Saved Meals`, `Daily Meals`, `Exercises`, `Saved Routines`, `Daily Workouts`
3. In the Sheet, go to **Extensions → Apps Script** — this opens the script editor. Keep it open.

### Tasks for Claude Code:
1. **Scaffold the frontend project**
   - `npm create vite@latest fittrack -- --template react`
   - Install Tailwind CSS
   - Set up folder structure: `src/components/`, `src/api/`, `src/data/`
   - Create a basic App shell with placeholder navigation (Dashboard, Log Meal, Log Workout)
   - Verify it runs with `npm run dev`

2. **Write the Google Apps Script backend**
   - Claude Code will generate a complete `Code.gs` file
   - You will **manually paste** this into the Apps Script editor (Claude Code can't access it)
   - The script will include:
     - `doPost(e)` handler that routes by `action` field
     - All CRUD functions for each tab
     - JSON response helpers
   - Deploy as web app: Execute as "Me", access "Anyone" (it's your personal sheet, no sensitive data)

3. **Connect frontend to backend**
   - Create `src/api/sheets.js` — a thin wrapper around `fetch()` calls to the Apps Script URL
   - The Apps Script URL will be stored in an environment variable / config file
   - Test: call `getIngredients` from the frontend, verify empty array returns

4. **Add headers to all Sheet tabs**
   - The Apps Script `setup()` function will write column headers to each tab
   - Run it once from the script editor to initialize

### Deliverable:
- Frontend runs locally showing a shell with 3 screens
- Apps Script is deployed and responds to POST requests
- A test round-trip (write a row, read it back) works

### What you'll need to do manually during this session:
- Paste the Apps Script code into the Google Apps Script editor
- Click Deploy → New deployment → Web app
- Copy the deployment URL back into the frontend config
- Run the `setup()` function once to create headers

---

## SESSION 1 — Ingredients Database + Meal Creation

**Goal:** Can search ingredients, build a meal from them, save it.

### Pre-work:
- Session 0 must be complete and working

### Tasks for Claude Code:
1. **Populate the Ingredients tab**
   - Generate a JSON file with all 24 ingredients and their real macros per 100g (calories, protein, carbs, fat, fiber, sugar)
   - Write an Apps Script function to bulk-import this data into the Ingredients tab
   - Also keep the JSON as a local fallback file (`src/data/ingredients.json`) for fast client-side search

2. **Build the "Create Meal" screen**
   - Search/filter bar for ingredients (client-side filtering of the local JSON)
   - Tap an ingredient → prompt for quantity in grams
   - Added ingredients appear in a list with computed macros
   - Running totals (calories, protein, carbs, fat) displayed prominently
   - "Name this meal" input + "Save" button

3. **Save meal to Saved Meals tab**
   - On save: write all ingredient rows with a generated Meal_ID to Saved Meals
   - Confirm save with a toast/notification

4. **Build "Saved Meals" list view**
   - Fetch all saved meals from the Sheet, grouped by Meal_ID
   - Display as cards: meal name, total calories, total protein
   - Tap to expand and see ingredient breakdown

### Deliverable:
- Can search ingredients, build a meal, save it
- Can view all saved meals with their macros
- Data persists in Google Sheets

---

## SESSION 2 — Daily Meal Logging + Dashboard

**Goal:** Can log meals to today. Dashboard shows daily macro totals.

### Tasks for Claude Code:
1. **"Log Meal" flow**
   - Main screen shows saved meals list
   - Tap a saved meal → logs it to today's date in Daily Meals tab
   - Also show "Create New Meal" button (reuses Session 1's create flow, then also logs it)
   - After logging, return to dashboard

2. **Dashboard — Nutrition section**
   - Fetch today's Daily Meals from the Sheet
   - Display:
     - Total calories (big number, prominent)
     - Protein / Carbs / Fat breakdown (numbers or simple bar)
     - List of today's meals with individual totals
   - Each meal has a delete button (removes rows from Daily Meals tab)

3. **Optimistic UI**
   - When logging a meal, immediately update the dashboard
   - Write to Sheets in the background
   - If write fails, show an error and a retry option

4. **Date handling**
   - Dashboard defaults to today
   - Nice-to-have: ability to pick a different date (simple date input, not a calendar widget)

### Deliverable:
- Can log a saved meal to today in 2-3 taps
- Dashboard shows today's meals and macro totals
- Can delete a logged meal
- Full nutrition tracking loop works end-to-end

---

## SESSION 3 — Exercise Catalogue + Workout Tracking

**Goal:** Can log a workout with exercises, sets, reps, and weights.

### Tasks for Claude Code:
1. **Populate the Exercises tab**
   - Write all 20 exercises with their categories to the Exercises tab
   - Keep a local JSON copy for fast access

2. **Build "Create Routine" flow**
   - Show exercises grouped by category
   - Tap to add to routine, drag or reorder
   - Name the routine, save to Saved Routines tab

3. **Pre-populate 2-3 starter routines**
   - Based on the exercise list, create sensible defaults (e.g., "Push Day", "Pull Day", "Leg Day")
   - Save them to Saved Routines so the user has something to start with

4. **Build "Log Workout" flow**
   - Show saved routines list
   - Tap a routine → shows its exercises in order
   - For each exercise: input fields for sets × reps × weight (kg)
   - Pre-fill weight from last time this routine was logged (via `getLastWorkoutWeights`)
   - Allow adding/removing exercises on the fly (deviation from routine)
   - "Save Workout" writes all rows to Daily Workouts

5. **Dashboard — Workout section**
   - Show today's workout (if logged): routine name, exercises with sets/reps/weight
   - If no workout today, show nothing or "No workout logged"

### Deliverable:
- Can create and save routines
- Can log a workout with weights pre-filled from last session
- Can modify exercises on the fly during logging
- Dashboard shows today's workout
- Full workout tracking loop works end-to-end

---

## SESSION 4 — Mobile Polish, PWA + GitHub Pages Deployment

**Goal:** App is live, installable on Android, and pleasant to use on a phone.

### Tasks for Claude Code:
1. **Mobile UI polish**
   - Audit all touch targets (minimum 48px)
   - Fix any spacing/overflow issues on small screens
   - Ensure inputs are comfortable to use with thumbs
   - Add loading spinners for Sheets operations
   - Add success/error toasts for all save actions

2. **PWA setup**
   - Create `manifest.json` (app name, icons, theme color, display: standalone)
   - Create a basic service worker (cache the app shell for fast loads)
   - Generate app icons (simple placeholder is fine)
   - Add install prompt or instructions

3. **GitHub Pages deployment**
   - Configure Vite for GitHub Pages base path
   - Set up the build → deploy workflow:
     - Option A: Manual `npm run build` + push `/dist` to `gh-pages` branch
     - Option B: GitHub Actions workflow that auto-deploys on push to main
   - Verify the app loads at `https://yourusername.github.io/fittrack/`

4. **End-to-end phone test**
   - Open deployed URL on Android phone
   - Test: log a meal, log a workout, check dashboard
   - Install as PWA from browser
   - Fix any issues found

5. **Quality of life**
   - Add "pull to refresh" or a refresh button for data sync
   - Handle offline gracefully: show "No connection" instead of crashing
   - Confirm before deleting a logged meal

### Deliverable:
- App is live at a GitHub Pages URL
- Installable as PWA on Android
- Smooth, fast experience on mobile
- **v1 is complete and usable daily**

---

## SESSION 5 (Future) — Meal Plans + Workout Suggestions

> Not part of the initial build. Come back to this after using v1 for a few weeks.

**Goal:** The app suggests what to eat and which workout to do today.

### Tasks:
1. **New tab in Sheets: "Meal Plan"**
   - Columns: Day_of_week, Meal_slot (breakfast/lunch/dinner/snack), Meal_ID
   - You fill this in manually with your preferred weekly rotation

2. **Dashboard: "Suggested meals"**
   - Based on today's day of the week, show the planned meals
   - One-tap to accept (logs to Daily Meals)
   - Or dismiss and log your own

3. **New tab in Sheets: "Workout Plan"**
   - Columns: Day_of_week, Routine_ID
   - Simple rotation: e.g., Mon=Push, Tue=Pull, Wed=Rest, Thu=Legs...

4. **Dashboard: "Today's workout"**
   - Show the planned routine for today
   - One-tap to start logging it

### Deliverable:
- App proactively suggests meals and workouts
- One-tap to accept suggestions
- Easy to reconfigure by editing the Sheets tabs

---

## SESSION MANAGEMENT TIPS

### Starting a new Claude Code session:
```
I'm building FitTrack, a personal fitness & nutrition tracker.

Here is the full project spec:
[paste claude.md]

This is SESSION [N] — [Title].
The goals for this session are:
[paste that session's section from this roadmap]

Current state:
[describe what's built and working so far]

Proceed step by step. After each major step, pause so I can test.
```

### If a session runs long:
- It's fine to split a session across two Claude Code conversations
- When resuming, describe what was completed and what remains

### If you hit issues with Google Apps Script:
- Apps Script has a ~6-minute execution time limit (you'll never hit this)
- Apps Script responses can be slow (~1-2 seconds). The frontend must handle this gracefully with loading states
- If CORS issues appear: the Apps Script `doPost` must return `ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON)`
- After editing Apps Script code, you must **create a new deployment** (or update the existing one) for changes to take effect

### Testing checklist for each session:
- [ ] Does the feature work on desktop browser?
- [ ] Does it work on phone browser (use Chrome DevTools mobile emulation)?
- [ ] Does data appear correctly in Google Sheets?
- [ ] Does data survive a page refresh (i.e., it reads from Sheets, not just local state)?
- [ ] Are there any console errors?
