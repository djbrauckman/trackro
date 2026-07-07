/**
 * macros.js
 * Logic for macros.html: log entries, today-vs-target progress bars,
 * calorie trend chart, history table.
 */
let mChartInstance = null;
let commonFoods = [];

document.addEventListener('DOMContentLoaded', () => {
  initNav('macros');
  document.getElementById('mDate').value = todayISO();
  resetIngredientRows();

  document.getElementById('mSubmit').addEventListener('click', submitMacro);
  document.getElementById('mAddIngredient').addEventListener('click', addIngredientRow);
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

  const { error } = await supabaseClient.from('macro_entries').insert(entry);
  if (error) {
    errorEl.textContent = error.message;
    return;
  }

  resetIngredientRows();
  loadMacroData();
}

async function deleteMacro(id) {
  await supabaseClient.from('macro_entries').delete().eq('id', id);
  loadMacroData();
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

  if (!commonFoods.length) {
    listEl.innerHTML = '<div class="empty-note">No common foods saved yet.</div>';
    return;
  }
  listEl.innerHTML = `
    <table class="history-table">
      <thead><tr><th>Name</th><th>Macros (per unit)</th><th></th></tr></thead>
      <tbody>
        ${commonFoods.map(f => `
          <tr>
            <td>${escapeHtml(f.name)}</td>
            <td>${f.calories} cal · ${f.protein_g}p / ${f.carbs_g}c / ${f.fat_g}f</td>
            <td><button class="btn-danger" onclick="deleteCommonFood('${f.id}')">Delete</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
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
  const [{ data: goals }, { data: recent, error }] = await Promise.all([
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

  renderTodayProgress(recent, goals);
  renderCalorieChart(recent);
  renderMacroHistory(recent);
}

function renderTodayProgress(rows, goals) {
  const today = todayISO();
  const todays = rows.filter(r => r.logged_at === today);
  const totals = todays.reduce((acc, r) => ({
    calories: acc.calories + Number(r.calories || 0),
    protein_g: acc.protein_g + Number(r.protein_g || 0),
    carbs_g: acc.carbs_g + Number(r.carbs_g || 0),
    fat_g: acc.fat_g + Number(r.fat_g || 0),
  }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });

  const bars = [
    ['Calories', totals.calories, goals?.target_calories, ''],
    ['Protein', totals.protein_g, goals?.target_protein_g, 'g'],
    ['Carbs', totals.carbs_g, goals?.target_carbs_g, 'g'],
    ['Fat', totals.fat_g, goals?.target_fat_g, 'g'],
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
  }).join('') || '<div class="empty-note">Set targets on the Goals page.</div>';
}

function renderCalorieChart(rows) {
  const byDay = {};
  rows.forEach(r => {
    byDay[r.logged_at] = (byDay[r.logged_at] || 0) + Number(r.calories || 0);
  });
  const days = Object.keys(byDay).sort();
  const labels = days.map(formatDateShort);
  const values = days.map(d => byDay[d]);

  const ctx = document.getElementById('mChart').getContext('2d');
  if (mChartInstance) mChartInstance.destroy();
  mChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Calories',
        data: values,
        borderColor: '#A86300',
        backgroundColor: 'rgba(168,99,0,0.1)',
        tension: 0.25,
        fill: true,
        pointRadius: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { font: { size: 11 } } },
        x: { ticks: { font: { size: 10 } } },
      },
    },
  });
}

function renderMacroHistory(rows) {
  const historyEl = document.getElementById('mHistory');
  if (!rows.length) {
    historyEl.innerHTML = '<div class="empty-note">No entries yet.</div>';
    return;
  }

  const rowsHtml = rows.slice(0, 25).map(r => `
    <tr>
      <td>${formatDateShort(r.logged_at)}</td>
      <td>${escapeHtml(r.meal_name)}</td>
      <td>${escapeHtml(r.food_name)}</td>
      <td>${r.calories} cal · ${r.protein_g}p / ${r.carbs_g}c / ${r.fat_g}f</td>
      <td><button class="btn-danger" onclick="deleteMacro('${r.id}')">Delete</button></td>
    </tr>
  `).join('');

  historyEl.innerHTML = `
    <table class="history-table">
      <thead><tr><th>Date</th><th>Meal</th><th>Food</th><th>Macros</th><th></th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
}
