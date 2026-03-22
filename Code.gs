var SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
var API_KEY = ''; // Set this to your password
var GEMINI_API_KEY = 'your-gemini-api-key-here';

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.key !== API_KEY) {
      return respond({ success: false, error: 'Unauthorized' });
    }
    switch (body.action) {
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
    'Body Log':        ['Date', 'Weight_kg', 'Fat_pct']
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
