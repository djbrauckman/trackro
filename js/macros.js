/**
 * macros.js
 * Logic for macros.html: log entries, today-vs-target progress bars,
 * calorie trend chart, history table.
 */
let mChartInstance = null;
let mMacroChartInstance = null;
let commonFoods = [];
let macroRows = [];
let editingMacroId = null;
let macroHistoryExpanded = false;
let commonFoodsExpanded = false;

const TARGET_LINE_COLOR = '#7A7672';
function targetLineDataset(label, count, value, hidden) {
  return {
    label,
    data: Array(count).fill(value),
    borderColor: TARGET_LINE_COLOR,
    borderDash: [6, 4],
    borderWidth: 1.5,
    pointRadius: 0,
    tension: 0,
    fill: false,
    hidden: !!hidden,
  };
}

document.addEventListener('DOMContentLoaded', () => {
  initNav('macros');
  document.getElementById('mDate').value = todayISO();
  resetIngredientRows();

  document.getElementById('mSubmit').addEventListener('click', submitMacro);
  document.getElementById('mCancelEdit').addEventListener('click', cancelMacroEdit);
  document.getElementById('mAddIngredient').addEventListener('click', addIngredientRow);
  document.getElementById('mClearIngredients').addEventListener('click', clearMacroIngredients);
  document.getElementById('mIngredients').addEventListener('click', (e) => {
    if (e.target.classList.contains('ing-remove')) {
      removeIngredientRow(e.target.closest('.repeatable-row'));
    }
  });
  document.getElementById('mIngredients').addEventListener('change', (e) => {
    if (e.target.classList.contains('ing-food')) {
      autofillIngredientRow(e.target);
    }
  });
  document.getElementById('cfAdd').addEventListener('click', addCommonFood);

  loadMacroData();
  loadCommonFoods();
});

function ingredientRowEl() {
  const div = document.createElement('div');
  div.className = 'repeatable-row';
  div.innerHTML = `
    <div class="repeatable-row-head">
      <span>Ingredient</span>
      <button type="button" class="btn-danger ing-remove">Remove</button>
    </div>
    <div class="input-row-food">
      <div>
        <div class="label">Food</div>
        <input type="text" class="ing-food" list="commonFoodsList" placeholder="e.g. Egg (per egg)" />
      </div>
      <div>
        <div class="label">Qty</div>
        <input type="number" class="ing-qty" step="any" min="0" value="1" />
      </div>
    </div>
    <div class="input-row-3">
      <div>
        <div class="label">Calories</div>
        <input type="number" class="ing-cal" step="1" />
      </div>
      <div>
        <div class="label">Protein (g)</div>
        <input type="number" class="ing-protein" step="1" />
      </div>
      <div>
        <div class="label">Carbs (g)</div>
        <input type="number" class="ing-carbs" step="1" />
      </div>
    </div>
    <div style="max-width: calc(33.33% - 10px); margin-bottom:16px">
      <div class="label">Fat (g)</div>
      <input type="number" class="ing-fat" step="1" />
    </div>
  `;
  return div;
}

function addIngredientRow() {
  document.getElementById('mIngredients').appendChild(ingredientRowEl());
  updateIngredientRemoveButtons();
}

function removeIngredientRow(rowEl) {
  rowEl.remove();
  updateIngredientRemoveButtons();
}

function updateIngredientRemoveButtons() {
  const rows = document.querySelectorAll('#mIngredients .repeatable-row');
  rows.forEach(row => {
    row.querySelector('.ing-remove').style.display = rows.length > 1 ? '' : 'none';
  });
}

function resetIngredientRows() {
  const container = document.getElementById('mIngredients');
  container.innerHTML = '';
  container.appendChild(ingredientRowEl());
  updateIngredientRemoveButtons();
}

// Clears just the food/ingredient rows, leaving date, meal, and edit state untouched.
function clearMacroIngredients() {
  resetIngredientRows();
  document.getElementById('mError').textContent = '';
}

function autofillIngredientRow(foodInput) {
  const match = commonFoods.find(f => f.name.toLowerCase() === foodInput.value.trim().toLowerCase());
  if (!match) return;
  const row = foodInput.closest('.repeatable-row');
  row.querySelector('.ing-cal').value = match.calories;
  row.querySelector('.ing-protein').value = match.protein_g;
  row.querySelector('.ing-carbs').value = match.carbs_g;
  row.querySelector('.ing-fat').value = match.fat_g;
}

async function submitMacro() {
  const errorEl = document.getElementById('mError');
  errorEl.textContent = '';

  const logged_at = document.getElementById('mDate').value;
  const meal_name = document.getElementById('mMeal').value;

  if (!logged_at) {
    errorEl.textContent = 'Enter a date.';
    return;
  }

  const numOrZero = (el) => (el.value === '' ? 0 : parseFloat(el.value));

  const names = [];
  const totals = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

  document.querySelectorAll('#mIngredients .repeatable-row').forEach(row => {
    const foodName = row.querySelector('.ing-food').value.trim();
    if (!foodName) return;
    const qtyVal = row.querySelector('.ing-qty').value;
    const qty = qtyVal === '' ? 1 : parseFloat(qtyVal);
    names.push(foodName);
    totals.calories += numOrZero(row.querySelector('.ing-cal')) * qty;
    totals.protein_g += numOrZero(row.querySelector('.ing-protein')) * qty;
    totals.carbs_g += numOrZero(row.querySelector('.ing-carbs')) * qty;
    totals.fat_g += numOrZero(row.querySelector('.ing-fat')) * qty;
  });

  if (!names.length) {
    errorEl.textContent = 'Enter at least one food.';
    return;
  }

  const entry = {
    logged_at,
    meal_name,
    food_name: names.join(' + '),
    ...totals,
  };

  const { error } = editingMacroId
    ? await supabaseClient.from('macro_entries').update(entry).eq('id', editingMacroId)
    : await supabaseClient.from('macro_entries').insert(entry);
  if (error) {
    errorEl.textContent = error.message;
    return;
  }

  editingMacroId = null;
  setMacroFormMode('add');
  resetIngredientRows();
  loadMacroData();
}

function setMacroFormMode(mode) {
  document.getElementById('mSubmit').textContent = mode === 'edit' ? 'Update entry' : 'Save entry';
  document.getElementById('mCancelEdit').style.display = mode === 'edit' ? '' : 'none';
}

// Only the combined totals are stored (not the original ingredient breakdown),
// so editing repopulates a single row with the entry's aggregate values.
function editMacro(id) {
  const r = macroRows.find(x => x.id === id);
  if (!r) return;

  editingMacroId = id;

  document.getElementById('mDate').value = r.logged_at;
  document.getElementById('mMeal').value = r.meal_name;

  const container = document.getElementById('mIngredients');
  container.innerHTML = '';
  const row = ingredientRowEl();
  row.querySelector('.ing-food').value = r.food_name;
  row.querySelector('.ing-qty').value = 1;
  row.querySelector('.ing-cal').value = r.calories;
  row.querySelector('.ing-protein').value = r.protein_g;
  row.querySelector('.ing-carbs').value = r.carbs_g;
  row.querySelector('.ing-fat').value = r.fat_g;
  container.appendChild(row);
  updateIngredientRemoveButtons();

  setMacroFormMode('edit');
  document.getElementById('mDate').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelMacroEdit() {
  editingMacroId = null;
  document.getElementById('mDate').value = todayISO();
  document.getElementById('mMeal').value = 'Breakfast';
  resetIngredientRows();
  setMacroFormMode('add');
}

// Repopulates the form from a past entry as a new (not edited) entry, logged today.
// Does not touch the common foods dictionary — this is just a form shortcut.
function copyMacro(id) {
  const r = macroRows.find(x => x.id === id);
  if (!r) return;

  editingMacroId = null;
  setMacroFormMode('add');

  document.getElementById('mDate').value = todayISO();
  document.getElementById('mMeal').value = r.meal_name;

  const container = document.getElementById('mIngredients');
  container.innerHTML = '';
  const row = ingredientRowEl();
  row.querySelector('.ing-food').value = r.food_name;
  row.querySelector('.ing-qty').value = 1;
  row.querySelector('.ing-cal').value = r.calories;
  row.querySelector('.ing-protein').value = r.protein_g;
  row.querySelector('.ing-carbs').value = r.carbs_g;
  row.querySelector('.ing-fat').value = r.fat_g;
  container.appendChild(row);
  updateIngredientRemoveButtons();

  document.getElementById('mDate').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function deleteMacro(id) {
  await supabaseClient.from('macro_entries').delete().eq('id', id);
  loadMacroData();
}

// Saves a history row's stored totals straight into the common foods dictionary
// under its existing name (upsert, so re-adding the same name just updates it).
async function addHistoryToCommonFoods(id) {
  const r = macroRows.find(x => x.id === id);
  if (!r) return;

  const { error } = await supabaseClient.from('common_foods').upsert({
    name: r.food_name,
    calories: r.calories,
    protein_g: r.protein_g,
    carbs_g: r.carbs_g,
    fat_g: r.fat_g,
  }, { onConflict: 'name' });

  if (error) {
    document.getElementById('mError').textContent = error.message;
    return;
  }
  loadCommonFoods();
}

async function loadCommonFoods() {
  const { data, error } = await supabaseClient.from('common_foods').select('*').order('name');
  const listEl = document.getElementById('cfList');
  if (error) {
    listEl.innerHTML = `<div class="empty-note">${escapeHtml(error.message)}</div>`;
    return;
  }
  commonFoods = data || [];

  document.getElementById('commonFoodsList').innerHTML = commonFoods
    .map(f => `<option value="${escapeHtml(f.name)}"></option>`)
    .join('');

  renderCommonFoodsList();
}

const COMMON_FOODS_PAGE_SIZE = 10;

function toggleCommonFoods() {
  commonFoodsExpanded = !commonFoodsExpanded;
  renderCommonFoodsList();
}

// Collapses the whole card (add form + list), not just the list pagination.
function toggleCommonFoodsCard() {
  document.getElementById('cfCardChevron').classList.toggle('open');
  document.getElementById('cfCardBody').classList.toggle('open');
}

function renderCommonFoodsList() {
  const listEl = document.getElementById('cfList');
  if (!commonFoods.length) {
    listEl.innerHTML = '<div class="empty-note">No common foods saved yet.</div>';
    return;
  }

  const visible = commonFoodsExpanded ? commonFoods : commonFoods.slice(0, COMMON_FOODS_PAGE_SIZE);

  const toggleHtml = commonFoods.length > COMMON_FOODS_PAGE_SIZE
    ? `<div class="btn-row" style="margin-top:12px">
         <button class="btn-tiny" onclick="toggleCommonFoods()">
           ${commonFoodsExpanded ? 'Show fewer' : `Show all ${commonFoods.length}`}
         </button>
       </div>`
    : '';

  listEl.innerHTML = `
    <table class="history-table">
      <thead><tr><th>Name</th><th>Macros (per unit)</th><th></th></tr></thead>
      <tbody>
        ${visible.map(f => `
          <tr>
            <td>${escapeHtml(f.name)}</td>
            <td>${f.calories} cal · ${f.protein_g}p / ${f.carbs_g}c / ${f.fat_g}f</td>
            <td>
              <button class="icon-btn icon-btn-danger" title="Delete" onclick="deleteCommonFood('${f.id}')">${ICON_TRASH}</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ${toggleHtml}
  `;
}

async function addCommonFood() {
  const errorEl = document.getElementById('cfError');
  errorEl.textContent = '';

  const name = document.getElementById('cfName').value.trim();
  if (!name) {
    errorEl.textContent = 'Enter a name.';
    return;
  }

  const numOrZero = (id) => {
    const v = document.getElementById(id).value;
    return v === '' ? 0 : parseFloat(v);
  };

  const entry = {
    name,
    calories: numOrZero('cfCalories'),
    protein_g: numOrZero('cfProtein'),
    carbs_g: numOrZero('cfCarbs'),
    fat_g: numOrZero('cfFat'),
  };

  const { error } = await supabaseClient.from('common_foods').upsert(entry, { onConflict: 'name' });
  if (error) {
    errorEl.textContent = error.message;
    return;
  }

  ['cfName', 'cfCalories', 'cfProtein', 'cfCarbs', 'cfFat'].forEach(id => {
    document.getElementById(id).value = '';
  });
  loadCommonFoods();
}

async function deleteCommonFood(id) {
  await supabaseClient.from('common_foods').delete().eq('id', id);
  loadCommonFoods();
}

async function loadMacroData() {
  const [{ data: targets }, { data: recent, error }] = await Promise.all([
    supabaseClient.from('goals').select('*').eq('id', 1).single(),
    supabaseClient
      .from('macro_entries')
      .select('*')
      .gte('logged_at', daysAgoISO(30))
      .order('logged_at', { ascending: false }),
  ]);

  const historyEl = document.getElementById('mHistory');
  if (error) {
    historyEl.innerHTML = `<div class="empty-note">${escapeHtml(error.message)}</div>`;
    return;
  }

  macroRows = recent;

  renderTodayProgress(recent, targets);
  renderCalorieChart(recent, targets);
  renderMacroGramChart(recent, targets);
  renderMacroHistory(recent);
}

function renderTodayProgress(rows, targets) {
  const today = todayISO();
  const todays = rows.filter(r => r.logged_at === today);
  const totals = todays.reduce((acc, r) => ({
    calories: acc.calories + Number(r.calories || 0),
    protein_g: acc.protein_g + Number(r.protein_g || 0),
    carbs_g: acc.carbs_g + Number(r.carbs_g || 0),
    fat_g: acc.fat_g + Number(r.fat_g || 0),
  }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });

  const bars = [
    ['Calories', totals.calories, targets?.target_calories, ''],
    ['Protein', totals.protein_g, targets?.target_protein_g, 'g'],
    ['Carbs', totals.carbs_g, targets?.target_carbs_g, 'g'],
    ['Fat', totals.fat_g, targets?.target_fat_g, 'g'],
  ];

  const el = document.getElementById('mToday');
  el.innerHTML = bars.map(([label, value, target, unit]) => {
    const pct = target ? Math.min(100, Math.round((value / target) * 100)) : 0;
    const over = target && value > target;
    const targetText = target ? ` / ${target}${unit}` : '';
    return `
      <div class="progress-row">
        <div class="progress-label"><span>${label}</span><b>${round1(value)}${unit}${targetText}</b></div>
        <div class="progress-track"><div class="progress-fill${over ? ' over' : ''}" style="width:${target ? pct : 0}%"></div></div>
      </div>
    `;
  }).join('') || '<div class="empty-note">Set targets on the Targets page.</div>';
}

function renderCalorieChart(rows, targets) {
  const byDay = {};
  rows.forEach(r => {
    byDay[r.logged_at] = (byDay[r.logged_at] || 0) + Number(r.calories || 0);
  });
  const days = Object.keys(byDay).sort();
  const labels = days.map(formatDateShort);
  const values = days.map(d => byDay[d]);

  const datasets = [{
    label: 'Calories',
    data: values,
    borderColor: '#A86300',
    backgroundColor: 'rgba(168,99,0,0.1)',
    tension: 0.25,
    fill: true,
    pointRadius: 2,
  }];
  if (targets?.target_calories) {
    datasets.push(targetLineDataset('Target', days.length, targets.target_calories));
  }

  const ctx = document.getElementById('mChart').getContext('2d');
  if (mChartInstance) mChartInstance.destroy();
  mChartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: datasets.length > 1, labels: { boxWidth: 12, font: { size: 11 } } } },
      scales: {
        y: { beginAtZero: true, ticks: { font: { size: 11 } } },
        x: { ticks: { font: { size: 10 } } },
      },
    },
  });
}

function renderMacroGramChart(rows, targets) {
  const byDay = {};
  rows.forEach(r => {
    if (!byDay[r.logged_at]) byDay[r.logged_at] = { protein_g: 0, carbs_g: 0, fat_g: 0 };
    byDay[r.logged_at].protein_g += Number(r.protein_g || 0);
    byDay[r.logged_at].carbs_g += Number(r.carbs_g || 0);
    byDay[r.logged_at].fat_g += Number(r.fat_g || 0);
  });
  const days = Object.keys(byDay).sort();
  const labels = days.map(formatDateShort);

  const series = [
    ['Protein (g)', 'protein_g', '#0F7A6E', 'target_protein_g'],
    ['Carbs (g)', 'carbs_g', '#1B5EAB', 'target_carbs_g'],
    ['Fat (g)', 'fat_g', '#A86300', 'target_fat_g'],
  ];

  const datasets = [];
  series.forEach(([label, key, color, targetKey]) => {
    datasets.push({
      label,
      data: days.map(d => byDay[d][key]),
      borderColor: color,
      backgroundColor: 'transparent',
      tension: 0.25,
      pointRadius: 2,
    });
    // Target lines start hidden (toggle via legend) — 6 lines at once was too busy.
    if (targets?.[targetKey]) {
      datasets.push(targetLineDataset(`${label} target`, days.length, targets[targetKey], true));
    }
  });

  const ctx = document.getElementById('mMacroChart').getContext('2d');
  if (mMacroChartInstance) mMacroChartInstance.destroy();
  mMacroChartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } },
      scales: {
        y: { beginAtZero: true, ticks: { font: { size: 11 } } },
        x: { ticks: { font: { size: 10 } } },
      },
    },
  });
}

const MACRO_DAYS_PAGE_SIZE = 7;
let openMacroDays = new Set();

function toggleMacroHistory() {
  macroHistoryExpanded = !macroHistoryExpanded;
  renderMacroHistory(macroRows);
}

function toggleMacroDay(day) {
  if (openMacroDays.has(day)) openMacroDays.delete(day);
  else openMacroDays.add(day);
  renderMacroHistory(macroRows);
}

function renderMacroHistory(rows) {
  const historyEl = document.getElementById('mHistory');
  if (!rows.length) {
    historyEl.innerHTML = '<div class="empty-note">No entries yet.</div>';
    return;
  }

  const byDay = {};
  rows.forEach(r => {
    (byDay[r.logged_at] = byDay[r.logged_at] || []).push(r);
  });
  const days = Object.keys(byDay).sort((a, b) => b.localeCompare(a));
  const visibleDays = macroHistoryExpanded ? days : days.slice(0, MACRO_DAYS_PAGE_SIZE);

  const dayHtml = visibleDays.map(day => {
    const dayRows = byDay[day];
    const dayCalories = dayRows.reduce((sum, r) => sum + Number(r.calories || 0), 0);
    const isOpen = openMacroDays.has(day);

    const rowsHtml = dayRows.map(r => `
      <tr>
        <td>${escapeHtml(r.meal_name)}</td>
        <td>${escapeHtml(r.food_name)}</td>
        <td>${r.calories} cal · ${r.protein_g}p / ${r.carbs_g}c / ${r.fat_g}f</td>
        <td>
          <div class="row-actions">
            <button class="icon-btn" title="Add to common foods" onclick="addHistoryToCommonFoods('${r.id}')">${ICON_PLUS}</button>
            <button class="icon-btn" title="Copy as new entry" onclick="copyMacro('${r.id}')">${ICON_COPY}</button>
            <button class="icon-btn" title="Edit" onclick="editMacro('${r.id}')">${ICON_EDIT}</button>
            <button class="icon-btn icon-btn-danger" title="Delete" onclick="deleteMacro('${r.id}')">${ICON_TRASH}</button>
          </div>
        </td>
      </tr>
    `).join('');

    return `
      <div class="history-subhead-row" onclick="toggleMacroDay('${day}')">
        <h3 class="history-subhead">
          <span class="collapsible-chevron${isOpen ? ' open' : ''}">${ICON_CHEVRON}</span>
          ${formatDateShort(day)} <span class="history-subhead-meta">(${dayRows.length} · ${dayCalories} cal)</span>
        </h3>
      </div>
      <div class="collapsible-body${isOpen ? ' open' : ''}">
        <table class="history-table">
          <thead><tr><th>Meal</th><th>Food</th><th>Macros</th><th></th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  }).join('');

  const toggleHtml = days.length > MACRO_DAYS_PAGE_SIZE
    ? `<div class="btn-row" style="margin-top:12px">
         <button class="btn-tiny" onclick="toggleMacroHistory()">
           ${macroHistoryExpanded ? 'Show fewer days' : `Show all ${days.length} days`}
         </button>
       </div>`
    : '';

  historyEl.innerHTML = dayHtml + toggleHtml;
}
