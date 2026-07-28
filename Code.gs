var SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
var API_KEY = ''; // Set this to your password
var GEMINI_API_KEY = 'your-gemini-api-key-here';
var ANTHROPIC_API_KEY = 'your-anthropic-api-key-here';

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.key !== API_KEY) {
      return respond({ success: false, error: 'Unauthorized' });
    }
    switch (body.action) {
      case 'getDashboard':         return respond(handleGetDashboard(body));
      case 'getObjectivesBundle':  return respond(handleGetObjectivesBundle());
      case 'getIngredients':       return respond(handleGetIngredients());
      case 'getSavedMeals':        return respond(handleGetSavedMeals());
      case 'saveMeal':             return respond(handleSaveMeal(body));
      case 'logMeal':              return respond(handleLogMeal(body));
      case 'getDailyMeals':        return respond(handleGetDailyMeals(body));
      case 'deleteDailyMeal':      return respond(handleDeleteDailyMeal(body));
      case 'getExercises':         return respond(handleGetExercises());
      case 'getSavedRoutines':     return respond(handleGetSavedRoutines());
      case 'saveRoutine':          return respond(handleSaveRoutine(body));
      case 'logWorkout':           return respond(handleLogWorkout(body));
      case 'getDailyWorkout':      return respond(handleGetDailyWorkout(body));
      case 'getLastWorkoutWeights': return respond(handleGetLastWorkoutWeights(body));
      case 'getGoals':             return respond(handleGetGoals());
      case 'saveGoals':            return respond(handleSaveGoals(body));
      case 'getBodyLog':           return respond(handleGetBodyLog());
      case 'logBody':              return respond(handleLogBody(body));
      case 'deleteBodyLog':        return respond(handleDeleteBodyLog(body));
      case 'getMealUsageCounts':   return respond(handleGetMealUsageCounts());
      case 'analyzeFood':          return respond(handleAnalyzeFood(body));
      case 'describeMeal':         return respond(handleDescribeMeal(body));
      case 'analyzeFoodPaid':      return respond(handleAnalyzeFoodPaid(body));
      case 'describeMealPaid':     return respond(handleDescribeMealPaid(body));
      case 'addIngredient':        return respond(handleAddIngredient(body));
      case 'getObjectives':        return respond(handleGetObjectives());
      case 'addObjective':         return respond(handleAddObjective(body));
      case 'updateObjective':      return respond(handleUpdateObjective(body));
      case 'deleteObjective':      return respond(handleDeleteObjective(body));
      case 'getObjectiveSteps':    return respond(handleGetObjectiveSteps());
      case 'addObjectiveSteps':    return respond(handleAddObjectiveSteps(body));
      case 'updateObjectiveStep':  return respond(handleUpdateObjectiveStep(body));
      case 'deleteObjectiveStep':  return respond(handleDeleteObjectiveStep(body));
      case 'objectivesChat':       return respond(handleObjectivesChat(body));
      case 'suggestSteps':         return respond(handleSuggestSteps(body));
      default: return respond({ success: false, error: 'Unknown action: ' + body.action });
    }
  } catch (err) {
    return respond({ success: false, error: err.message });
  }
}

function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// --- Helpers ---

function getSheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function getSheetData(name) {
  var sheet = getSheet(name);
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var val = data[i][j];
      if (val && typeof val.getTime === 'function') val = normalizeDate(val);
      obj[headers[j]] = val;
    }
    rows.push(obj);
  }
  return rows;
}

function normalizeDate(val) {
  if (val && typeof val.getTime === 'function') {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(val);
}

function appendRows(sheetName, rows) {
  var sheet = getSheet(sheetName);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  for (var i = 0; i < rows.length; i++) {
    var row = [];
    for (var j = 0; j < headers.length; j++) {
      row.push(rows[i][headers[j]] !== undefined ? rows[i][headers[j]] : '');
    }
    sheet.appendRow(row);
  }
}

function groupBy(rows, key) {
  var groups = {};
  for (var i = 0; i < rows.length; i++) {
    var k = rows[i][key];
    if (!groups[k]) groups[k] = [];
    groups[k].push(rows[i]);
  }
  return groups;
}

// Sets the given columns on the first row whose idHeader matches id.
function updateRowById(sheetName, idHeader, id, fields) {
  var sheet = getSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return;

  var headers = data[0];
  var idCol = headers.indexOf(idHeader);
  var keys = Object.keys(fields || {});

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) !== String(id)) continue;
    for (var k = 0; k < keys.length; k++) {
      var col = headers.indexOf(keys[k]);
      if (col >= 0) sheet.getRange(i + 1, col + 1).setValue(fields[keys[k]]);
    }
    break;
  }
}

// Deletes every row whose header column matches value. Bottom-to-top to avoid index shifting.
function deleteRowsWhere(sheetName, header, value) {
  var sheet = getSheet(sheetName);
  if (!sheet) return 0;
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return 0;

  var col = data[0].indexOf(header);
  if (col < 0) return 0;

  var count = 0;
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][col]) === String(value)) {
      sheet.deleteRow(i + 1);
      count++;
    }
  }
  return count;
}

// --- Setup (run once) ---

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var tabs = {
    'Ingredients':     ['Name', 'Calories_100g', 'Protein_100g', 'Carbs_100g', 'Fat_100g', 'Fiber_100g'],
    'Saved Meals':     ['Meal_ID', 'Meal_Name', 'Ingredient', 'Qty_g', 'Calories', 'Protein', 'Carbs', 'Fat', 'Fiber'],
    'Daily Meals':     ['Date', 'Meal_ID', 'Meal_Name', 'Ingredient', 'Qty_g', 'Calories', 'Protein', 'Carbs', 'Fat', 'Fiber'],
    'Exercises':       ['Name', 'Category'],
    'Saved Routines':  ['Routine_ID', 'Routine_Name', 'Exercise', 'Order'],
    'Daily Workouts':  ['Date', 'Routine_ID', 'Routine_Name', 'Exercise', 'Set_Num', 'Reps', 'Weight_kg'],
    'Goals':           ['Calories', 'Protein', 'Carbs', 'Fat'],
    'Body Log':        ['Date', 'Weight_kg', 'Fat_pct'],
    'Objectives':      ['Objective_ID', 'Term', 'Text', 'Start_Date', 'Due_Date', 'Completed', 'Score'],
    'Objective Steps': ['Step_ID', 'Objective_ID', 'Step_Num', 'Text', 'Done']
  };

  var names = Object.keys(tabs);
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    var sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    var headers = tabs[name];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

// --- Populate data (run once from script editor) ---

function populateIngredients() {
  var sheet = getSheet('Ingredients');
  var existing = sheet.getDataRange().getValues();
  if (existing.length > 1) {
    sheet.getRange(2, 1, existing.length - 1, existing[0].length).clear();
  }

  var data = [
    ['Chicken breast', 165, 31, 0, 3.6, 0],
    ['White rice', 130, 2.7, 28, 0.3, 0.4],
    ['Olive oil', 884, 0, 0, 100, 0],
    ['Banana', 89, 1.1, 23, 0.3, 2.6],
    ['Oats', 389, 17, 66, 6.9, 11],
    ['Whole wheat bread', 247, 13, 41, 3.4, 7],
    ['Eggs', 155, 13, 1.1, 11, 0],
    ['Milk', 42, 3.4, 5, 1, 0],
    ['Coconut oil', 862, 0, 0, 100, 0],
    ['Coffee', 2, 0.1, 0, 0, 0],
    ['White fish', 90, 18, 0, 1.3, 0],
    ['Salmon', 208, 20, 0, 13, 0],
    ['Shrimp', 99, 24, 0.2, 0.3, 0],
    ['Beef', 250, 26, 0, 15, 0],
    ['Lamb', 294, 25, 0, 21, 0],
    ['Beef hamburger meat', 254, 17, 0, 20, 0],
    ['Potatoes', 77, 2, 17, 0.1, 2.2],
    ['Chicken broth', 7, 1.1, 0.2, 0.2, 0],
    ['Vegetable cream', 195, 1.5, 5, 19, 0.3],
    ['Pumpkin', 26, 1, 6.5, 0.1, 0.5],
    ['Pumpkin and potato cream', 45, 1.2, 8, 1, 1],
    ['Ham', 145, 21, 1.5, 6, 0],
    ['Cheese', 402, 25, 1.3, 33, 0],
    ['Protein yoghurt', 70, 10, 4, 1.5, 0]
  ];

  sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
}

function populateExercises() {
  var sheet = getSheet('Exercises');
  var existing = sheet.getDataRange().getValues();
  if (existing.length > 1) {
    sheet.getRange(2, 1, existing.length - 1, existing[0].length).clear();
  }

  var data = [
    ['Dumbbell curl', 'Biceps'],
    ['Cable curl', 'Biceps'],
    ['Tricep pushdown', 'Triceps'],
    ['Overhead extension', 'Triceps'],
    ['Flat bench press', 'Chest'],
    ['45 degrees bench press', 'Chest'],
    ['Shoulder press', 'Chest'],
    ['Pull-up', 'Pull'],
    ['Row', 'Pull'],
    ['Squat', 'Legs'],
    ['Lunge', 'Legs'],
    ['Leg press', 'Legs'],
    ['Curl', 'Legs'],
    ['Extension', 'Legs'],
    ['Deadbug', 'Abs'],
    ['Cable lateral', 'Abs'],
    ['Lower back machine', 'Abs'],
    ['Crunch machine', 'Abs'],
    ['Reverse plank', 'Abs'],
    ['Crunch', 'Abs']
  ];

  sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
}

function populateStarterRoutines() {
  var sheet = getSheet('Saved Routines');
  var existing = sheet.getDataRange().getValues();
  if (existing.length > 1) {
    sheet.getRange(2, 1, existing.length - 1, existing[0].length).clear();
  }

  var data = [
    ['push1', 'Push Day', 'Flat bench press', 1],
    ['push1', 'Push Day', '45 degrees bench press', 2],
    ['push1', 'Push Day', 'Shoulder press', 3],
    ['push1', 'Push Day', 'Tricep pushdown', 4],
    ['push1', 'Push Day', 'Overhead extension', 5],

    ['pull1', 'Pull Day', 'Pull-up', 1],
    ['pull1', 'Pull Day', 'Row', 2],
    ['pull1', 'Pull Day', 'Dumbbell curl', 3],
    ['pull1', 'Pull Day', 'Cable curl', 4],

    ['legs1', 'Leg Day', 'Squat', 1],
    ['legs1', 'Leg Day', 'Leg press', 2],
    ['legs1', 'Leg Day', 'Lunge', 3],
    ['legs1', 'Leg Day', 'Curl', 4],
    ['legs1', 'Leg Day', 'Extension', 5]
  ];

  sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
}

// --- Action Handlers ---

// Batched reads: one round trip instead of several parallel ones, which Apps Script
// serializes per user anyway.
function handleGetDashboard(body) {
  return { success: true, data: {
    meals: handleGetDailyMeals(body).data,
    workout: handleGetDailyWorkout(body).data,
    goals: handleGetGoals().data,
  } };
}

function handleGetObjectivesBundle() {
  var steps = handleGetObjectiveSteps();
  if (!steps.success) return steps;
  return { success: true, data: {
    objectives: handleGetObjectives().data,
    steps: steps.data,
  } };
}

function handleGetIngredients() {
  return { success: true, data: getSheetData('Ingredients') };
}

function handleGetSavedMeals() {
  var rows = getSheetData('Saved Meals');
  return { success: true, data: groupBy(rows, 'Meal_ID') };
}

function handleSaveMeal(body) {
  appendRows('Saved Meals', body.rows);
  return { success: true, data: null };
}

function handleLogMeal(body) {
  appendRows('Daily Meals', body.rows);
  return { success: true, data: null };
}

function handleGetDailyMeals(body) {
  var rows = getSheetData('Daily Meals');
  var filtered = [];
  for (var i = 0; i < rows.length; i++) {
    if (normalizeDate(rows[i].Date) === body.date) {
      filtered.push(rows[i]);
    }
  }
  return { success: true, data: groupBy(filtered, 'Meal_ID') };
}

function handleDeleteDailyMeal(body) {
  var sheet = getSheet('Daily Meals');
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return { success: true, data: null };

  var headers = data[0];
  var dateCol = headers.indexOf('Date');
  var mealIdCol = headers.indexOf('Meal_ID');

  var rowsToDelete = [];
  for (var i = 1; i < data.length; i++) {
    var rowDate = normalizeDate(data[i][dateCol]);
    var rowMealId = String(data[i][mealIdCol]);
    if (rowDate === body.date && rowMealId === String(body.mealId)) {
      rowsToDelete.push(i + 1);
    }
  }

  // Delete bottom-to-top to avoid index shifting
  for (var j = rowsToDelete.length - 1; j >= 0; j--) {
    sheet.deleteRow(rowsToDelete[j]);
  }

  return { success: true, data: null };
}

function handleGetExercises() {
  return { success: true, data: getSheetData('Exercises') };
}

function handleGetSavedRoutines() {
  var rows = getSheetData('Saved Routines');
  return { success: true, data: groupBy(rows, 'Routine_ID') };
}

function handleSaveRoutine(body) {
  appendRows('Saved Routines', body.rows);
  return { success: true, data: null };
}

function handleLogWorkout(body) {
  appendRows('Daily Workouts', body.rows);
  return { success: true, data: null };
}

function handleGetDailyWorkout(body) {
  var rows = getSheetData('Daily Workouts');
  var filtered = [];
  for (var i = 0; i < rows.length; i++) {
    if (normalizeDate(rows[i].Date) === body.date) {
      filtered.push(rows[i]);
    }
  }
  return { success: true, data: groupBy(filtered, 'Routine_ID') };
}

function handleGetLastWorkoutWeights(body) {
  var rows = getSheetData('Daily Workouts');
  var matching = [];
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].Routine_ID) === String(body.routineId)) {
      matching.push(rows[i]);
    }
  }

  if (matching.length === 0) return { success: true, data: [] };

  // Find the most recent date
  var latestDate = '';
  for (var j = 0; j < matching.length; j++) {
    var d = normalizeDate(matching[j].Date);
    if (d > latestDate) latestDate = d;
  }

  var result = [];
  for (var k = 0; k < matching.length; k++) {
    if (normalizeDate(matching[k].Date) === latestDate) {
      result.push(matching[k]);
    }
  }

  return { success: true, data: result };
}

function handleGetGoals() {
  var sheet = getSheet('Goals');
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return { success: true, data: null };
  var headers = data[0];
  var obj = {};
  for (var j = 0; j < headers.length; j++) {
    obj[headers[j]] = data[1][j];
  }
  return { success: true, data: obj };
}

function handleSaveGoals(body) {
  var sheet = getSheet('Goals');
  var data = sheet.getDataRange().getValues();
  if (data.length > 1) {
    sheet.getRange(2, 1, data.length - 1, data[0].length).clear();
  }
  var headers = data[0];
  var row = [];
  for (var j = 0; j < headers.length; j++) {
    row.push(body.goals[headers[j]] !== undefined ? body.goals[headers[j]] : '');
  }
  sheet.appendRow(row);
  return { success: true, data: null };
}

function handleGetBodyLog() {
  return { success: true, data: getSheetData('Body Log') };
}

function handleLogBody(body) {
  appendRows('Body Log', [body.entry]);
  return { success: true, data: null };
}

function handleGetMealUsageCounts() {
  var rows = getSheetData('Daily Meals');
  var seen = {};
  var counts = {};
  for (var i = 0; i < rows.length; i++) {
    var key = normalizeDate(rows[i].Date) + '|' + rows[i].Meal_ID;
    if (!seen[key]) {
      seen[key] = true;
      var mid = String(rows[i].Meal_ID);
      counts[mid] = (counts[mid] || 0) + 1;
    }
  }
  return { success: true, data: counts };
}

function handleAnalyzeFood(body) {
  if (!body.image) return { success: false, error: 'No image provided' };

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_API_KEY;
  var payload = {
    contents: [{
      parts: [
        { text: 'You are a nutrition estimation assistant. Analyze this photo of food and estimate the nutritional content.\n\nRespond with ONLY a JSON object in this exact format:\n{\n  "name": "Short meal name",\n  "foods": [\n    {\n      "item": "Food name",\n      "grams": <estimated total grams>,\n      "calories_100g": <calories per 100g>,\n      "protein_100g": <protein grams per 100g>,\n      "carbs_100g": <carbs grams per 100g>,\n      "fat_100g": <fat grams per 100g>\n    }\n  ]\n}\nList each distinct food item separately. Round all numbers to integers. Use metric units.' },
        { inline_data: { mime_type: 'image/jpeg', data: body.image } }
      ]
    }]
  };

  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  if (res.getResponseCode() !== 200) {
    return { success: false, error: 'Gemini API error: ' + res.getContentText().substring(0, 200) };
  }

  var result = JSON.parse(res.getContentText());
  var text = result.candidates[0].content.parts[0].text;
  // Strip markdown fences if present
  text = text.replace(/```json\s*/i, '').replace(/```\s*$/, '').trim();
  var parsed = JSON.parse(text);

  return { success: true, data: parsed };
}

function handleDescribeMeal(body) {
  if (!body.text) return { success: false, error: 'No text provided' };

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_API_KEY;
  var payload = {
    contents: [{
      parts: [
        { text: 'You are a nutrition estimation assistant. Estimate the nutritional content of the following meal description.\n\nIf the user specifies quantities, use those. If not, estimate reasonable portions.\n\nRespond with ONLY a JSON object in this exact format:\n{\n  "name": "Short meal name",\n  "foods": [\n    {\n      "item": "Food name",\n      "grams": <estimated total grams>,\n      "calories_100g": <calories per 100g>,\n      "protein_100g": <protein grams per 100g>,\n      "carbs_100g": <carbs grams per 100g>,\n      "fat_100g": <fat grams per 100g>\n    }\n  ]\n}\nList each distinct food item separately. Round all numbers to integers. Use metric units.\n\nMeal description: ' + body.text }
      ]
    }]
  };

  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  if (res.getResponseCode() !== 200) {
    return { success: false, error: 'Gemini API error: ' + res.getContentText().substring(0, 200) };
  }

  var result = JSON.parse(res.getContentText());
  var text = result.candidates[0].content.parts[0].text;
  text = text.replace(/```json\s*/i, '').replace(/```\s*$/, '').trim();
  var parsed = JSON.parse(text);

  return { success: true, data: parsed };
}

function handleAnalyzeFoodPaid(body) {
  if (!body.image) return { success: false, error: 'No image provided' };

  var url = 'https://api.anthropic.com/v1/messages';
  var payload = {
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: body.image
          }
        },
        {
          type: 'text',
          text: 'You are a nutrition estimation assistant. Analyze this photo of food and estimate the nutritional content.\n\nRespond with ONLY a JSON object in this exact format:\n{\n  "name": "Short meal name",\n  "foods": [\n    {\n      "item": "Food name",\n      "grams": <estimated total grams>,\n      "calories_100g": <calories per 100g>,\n      "protein_100g": <protein grams per 100g>,\n      "carbs_100g": <carbs grams per 100g>,\n      "fat_100g": <fat grams per 100g>\n    }\n  ]\n}\nList each distinct food item separately. Round all numbers to integers. Use metric units.'
        }
      ]
    }]
  };

  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  if (res.getResponseCode() !== 200) {
    return { success: false, error: 'Claude API error: ' + res.getContentText().substring(0, 200) };
  }

  var result = JSON.parse(res.getContentText());
  var text = result.content[0].text;
  text = text.replace(/```json\s*/i, '').replace(/```\s*$/, '').trim();
  var parsed = JSON.parse(text);

  return { success: true, data: parsed };
}

function handleDescribeMealPaid(body) {
  if (!body.text) return { success: false, error: 'No text provided' };

  var url = 'https://api.anthropic.com/v1/messages';
  var payload = {
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: 'You are a nutrition estimation assistant. Estimate the nutritional content of the following meal description.\n\nIf the user specifies quantities, use those. If not, estimate reasonable portions.\n\nRespond with ONLY a JSON object in this exact format:\n{\n  "name": "Short meal name",\n  "foods": [\n    {\n      "item": "Food name",\n      "grams": <estimated total grams>,\n      "calories_100g": <calories per 100g>,\n      "protein_100g": <protein grams per 100g>,\n      "carbs_100g": <carbs grams per 100g>,\n      "fat_100g": <fat grams per 100g>\n    }\n  ]\n}\nList each distinct food item separately. Round all numbers to integers. Use metric units.\n\nMeal description: ' + body.text
    }]
  };

  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  if (res.getResponseCode() !== 200) {
    return { success: false, error: 'Claude API error: ' + res.getContentText().substring(0, 200) };
  }

  var result = JSON.parse(res.getContentText());
  var text = result.content[0].text;
  text = text.replace(/```json\s*/i, '').replace(/```\s*$/, '').trim();
  var parsed = JSON.parse(text);

  return { success: true, data: parsed };
}

function handleAddIngredient(body) {
  if (!body.ingredient || !body.ingredient.Name) return { success: false, error: 'No ingredient name provided' };
  appendRows('Ingredients', [body.ingredient]);
  return { success: true, data: null };
}

function handleGetObjectives() {
  return { success: true, data: getSheetData('Objectives') };
}

function handleAddObjective(body) {
  if (!body.objective || !body.objective.Objective_ID) return { success: false, error: 'No objective provided' };
  appendRows('Objectives', [body.objective]);
  return { success: true, data: null };
}

function handleUpdateObjective(body) {
  var sheet = getSheet('Objectives');
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return { success: true, data: null };

  var headers = data[0];
  var idCol = headers.indexOf('Objective_ID');
  var fields = body.fields || {};
  var keys = Object.keys(fields);

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) !== String(body.id)) continue;
    for (var k = 0; k < keys.length; k++) {
      var col = headers.indexOf(keys[k]);
      if (col >= 0) sheet.getRange(i + 1, col + 1).setValue(fields[keys[k]]);
    }
    break;
  }

  return { success: true, data: null };
}

function handleDeleteObjective(body) {
  var sheet = getSheet('Objectives');
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return { success: true, data: null };

  var headers = data[0];
  var idCol = headers.indexOf('Objective_ID');

  var rowsToDelete = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(body.id)) {
      rowsToDelete.push(i + 1);
    }
  }

  // Delete bottom-to-top to avoid index shifting
  for (var j = rowsToDelete.length - 1; j >= 0; j--) {
    sheet.deleteRow(rowsToDelete[j]);
  }

  // Don't leave the objective's steps orphaned.
  deleteRowsWhere('Objective Steps', 'Objective_ID', body.id);

  return { success: true, data: null };
}

// --- Objective steps ---

function handleGetObjectiveSteps() {
  if (!getSheet('Objective Steps')) {
    return { success: false, error: 'Objective Steps tab is missing - run setup() in the Apps Script editor' };
  }
  return { success: true, data: getSheetData('Objective Steps') };
}

function handleAddObjectiveSteps(body) {
  var steps = body.steps || [];
  if (!steps.length) return { success: false, error: 'No steps provided' };
  appendRows('Objective Steps', steps);
  return { success: true, data: null };
}

function handleUpdateObjectiveStep(body) {
  updateRowById('Objective Steps', 'Step_ID', body.id, body.fields);
  return { success: true, data: null };
}

function handleDeleteObjectiveStep(body) {
  deleteRowsWhere('Objective Steps', 'Step_ID', body.id);
  return { success: true, data: null };
}

// --- Objectives AI ---

var CLAUDE_MODELS = { sonnet: 'claude-sonnet-5', opus: 'claude-opus-5' };

function callClaude(modelKey, system, messages, maxTokens, effort) {
  var payload = {
    model: CLAUDE_MODELS[modelKey] || CLAUDE_MODELS.sonnet,
    max_tokens: maxTokens,
    system: system,
    messages: messages,
    thinking: { type: 'adaptive' },
    output_config: { effort: effort }
  };

  var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  if (res.getResponseCode() !== 200) {
    return { ok: false, error: 'Claude API error: ' + res.getContentText().substring(0, 200) };
  }

  var result = JSON.parse(res.getContentText());
  if (result.stop_reason === 'refusal') {
    return { ok: false, error: 'Claude declined to answer that one.' };
  }

  // Adaptive thinking puts thinking blocks in content alongside the text, so
  // content[0] is not reliably the answer - collect the text blocks instead.
  var text = '';
  for (var i = 0; i < result.content.length; i++) {
    if (result.content[i].type === 'text') text += result.content[i].text;
  }
  if (!text) return { ok: false, error: 'Empty response from Claude' };

  return { ok: true, text: text };
}

function todayStr() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function daysBetween(fromStr, toStr) {
  return Math.round((new Date(toStr + 'T00:00:00') - new Date(fromStr + 'T00:00:00')) / 86400000);
}

function describeObjective(o, objSteps, today) {
  var line = '- [' + o.Objective_ID + '] "' + o.Text + '" - started ' + o.Start_Date;

  if (o.Due_Date) {
    var left = daysBetween(today, String(o.Due_Date));
    line += ', due ' + o.Due_Date;
    line += left < 0 ? ' (OVERDUE by ' + Math.abs(left) + ' days)' : ' (' + left + ' days left)';
  } else {
    line += ', no deadline';
  }

  line += o.Score ? '. Score ' + o.Score + '/5.' : '. No score yet.';

  var list = objSteps || [];
  if (!list.length) return line + '\n  No steps yet.';

  list.sort(function (a, b) { return Number(a.Step_Num) - Number(b.Step_Num); });
  var parts = [];
  for (var i = 0; i < list.length; i++) {
    parts.push((String(list[i].Done) === 'y' ? '[x] ' : '[ ] ') + list[i].Text);
  }
  return line + '\n  Steps: ' + parts.join('; ');
}

// The shared context block for both AI features. Built here rather than sent by
// the client so it is always fresh and there is one copy of the format.
function buildObjectivesContext() {
  var objectives = getSheetData('Objectives');
  var steps = getSheet('Objective Steps') ? getSheetData('Objective Steps') : [];
  var stepsByObj = groupBy(steps, 'Objective_ID');
  var today = todayStr();

  var terms = [
    { id: 'short', label: 'Short term (2 weeks)' },
    { id: 'mid',   label: 'Mid term (3 months)' },
    { id: 'long',  label: 'Long term (no deadline)' }
  ];

  var out = ['# My objectives (today is ' + today + ')'];

  for (var t = 0; t < terms.length; t++) {
    var lines = [];
    for (var i = 0; i < objectives.length; i++) {
      var o = objectives[i];
      if (String(o.Term) !== terms[t].id || String(o.Completed) === 'y') continue;
      lines.push(describeObjective(o, stepsByObj[o.Objective_ID], today));
    }
    out.push('');
    out.push('## ' + terms[t].label);
    out.push(lines.length ? lines.join('\n') : '- (none yet)');
  }

  // Completed objectives from every term, flattened - useful history, not worth full detail.
  var completed = [];
  for (var c = 0; c < objectives.length; c++) {
    if (String(objectives[c].Completed) === 'y') completed.push(objectives[c]);
  }
  if (completed.length) {
    out.push('');
    out.push('## Completed');
    for (var d = 0; d < completed.length; d++) {
      var co = completed[d];
      out.push('- "' + co.Text + '" (' + co.Term + ' term' + (co.Score ? ', scored ' + co.Score + '/5' : '') + ')');
    }
  }

  return out.join('\n');
}

function handleObjectivesChat(body) {
  var messages = body.messages || [];
  if (!messages.length) return { success: false, error: 'No messages provided' };

  var system = [
    'You are a personal goal coach inside FitTrack, a fitness and nutrition tracker used by one person on their phone.',
    '',
    'How to respond:',
    '- Be brief. A few short sentences, or one short paragraph. No headings, no long bullet lists.',
    '- Be concrete. A specific next action beats general encouragement.',
    '- Be honest about overdue objectives rather than glossing over them.',
    '- Long term objectives have no deadline on purpose. Treat them as direction, not something to chase a date on.',
    '- Use metric units: kilograms and grams.',
    '- Refer to objectives by their text, never by their ID.',
    '',
    'The user\'s current objectives and steps:',
    '',
    buildObjectivesContext()
  ].join('\n');

  var res = callClaude(body.model, system, messages, 2048, 'low');
  if (!res.ok) return { success: false, error: res.error };

  return { success: true, data: { reply: res.text } };
}

function handleSuggestSteps(body) {
  if (!body.objectiveId) return { success: false, error: 'No objective provided' };

  var objectives = getSheetData('Objectives');
  var target = null;
  for (var i = 0; i < objectives.length; i++) {
    if (String(objectives[i].Objective_ID) === String(body.objectiveId)) {
      target = objectives[i];
      break;
    }
  }
  if (!target) return { success: false, error: 'Objective not found' };

  var system = [
    'You break personal objectives down into concrete, actionable steps.',
    'You can see all of the user\'s objectives, so avoid proposing steps that duplicate another objective or pull against a long term one.',
    'Use metric units: kilograms and grams.',
    '',
    buildObjectivesContext()
  ].join('\n');

  var user = [
    'Generate steps for this objective: [' + target.Objective_ID + '] "' + target.Text + '"'
  ];

  // Optional steering typed on the phone before asking. Capped because it goes
  // straight into the prompt and there is no reason for it to be an essay.
  var steering = String(body.steering || '').trim().substring(0, 500);
  if (steering) {
    user.push('');
    user.push('Extra direction from me, follow it closely: ' + steering);
  }

  user = user.concat([
    '',
    'Rules:',
    '- Between 2 and 10 steps. Fewer is better if fewer will do.',
    '- Each step is one concrete action that can be finished and ticked off.',
    '- Order them so each step builds on the one before it.',
    '- Keep each step under 12 words.',
    '- Do not repeat steps this objective already has.',
    '',
    'Respond with ONLY a JSON object in this exact format: {"steps": ["first step", "second step"]}'
  ]).join('\n');

  var res = callClaude(body.model, system, [{ role: 'user', content: user }], 1536, 'medium');
  if (!res.ok) return { success: false, error: res.error };

  var text = res.text.replace(/```json\s*/i, '').replace(/```\s*$/, '').trim();
  var parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { success: false, error: 'Could not read steps from the response' };
  }

  var raw = parsed.steps || [];
  var steps = [];
  for (var s = 0; s < raw.length && steps.length < 10; s++) {
    var t = String(raw[s]).trim();
    if (t) steps.push(t);
  }
  if (!steps.length) return { success: false, error: 'No steps came back' };

  return { success: true, data: { steps: steps } };
}

function handleDeleteBodyLog(body) {
  var sheet = getSheet('Body Log');
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return { success: true, data: null };

  var headers = data[0];
  var dateCol = headers.indexOf('Date');
  var weightCol = headers.indexOf('Weight_kg');
  var fatCol = headers.indexOf('Fat_pct');

  for (var i = data.length - 1; i >= 1; i--) {
    var rowDate = normalizeDate(data[i][dateCol]);
    if (rowDate === body.date && data[i][weightCol] == body.weight && data[i][fatCol] == body.fat) {
      sheet.deleteRow(i + 1);
      break;
    }
  }

  return { success: true, data: null };
}
