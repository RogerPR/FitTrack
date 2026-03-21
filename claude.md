# FitTrack — Personal Fitness & Nutrition Tracker -

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
- **FREE ONLY.** No paid services, no paid APIs, no paid hosting.
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

All responses: `{ success: true, data: ... }` or `{ success: false, error: "message" }`.

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
