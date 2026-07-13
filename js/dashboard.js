/**
 * dashboard.js
 * Logic for index.html: overview stat tiles + summary charts pulled from
 * all three tables plus targets.
 */
let dWeightChartInstance = null;
let dCalorieChartInstance = null;
let dMacroChartInstance = null;
const EXERCISE_CATEGORIES = ['cardio', 'lifting', 'core'];

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
  initNav('dashboard');
  loadDashboard();
});

function weekStartISO(isoDate) {
  const d = new Date(isoDate + 'T00:00:00');
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - day);
  return d.toLocaleDateString('en-CA');
}

async function loadDashboard() {
  const [{ data: weights }, { data: exercises }, { data: macros }, { data: targets }] = await Promise.all([
    supabaseClient.from('weight_entries').select('*').gte('logged_at', daysAgoISO(60)).order('logged_at', { ascending: true }),
    supabaseClient.from('exercise_entries').select('*').gte('logged_at', daysAgoISO(60)).order('logged_at', { ascending: true }),
    supabaseClient.from('macro_entries').select('*').gte('logged_at', daysAgoISO(30)).order('logged_at', { ascending: true }),
    supabaseClient.from('goals').select('*').eq('id', 1).single(),
  ]);

  renderStats(weights || [], exercises || [], macros || [], targets);
  renderWeightChart(weights || []);
  renderTodayMacros(macros || [], targets);
  renderCalorieChart(macros || [], targets);
  renderMacroGramChart(macros || [], targets);
  renderExerciseCounts(exercises || []);
}

function renderStats(weights, exercises, macros, targets) {
  const latestWeight = weights.length ? weights[weights.length - 1].weight_lbs : null;
  const monthAgoWeight = (() => {
    const cutoff = daysAgoISO(30);
    const candidates = weights.filter(w => w.logged_at <= cutoff);
    return candidates.length ? candidates[candidates.length - 1].weight_lbs : null;
  })();
  const weightChange = (latestWeight !== null && monthAgoWeight !== null)
    ? round1(latestWeight - monthAgoWeight)
    : null;

  const today = todayISO();
  const todaysCalories = macros
    .filter(m => m.logged_at === today)
    .reduce((sum, m) => sum + Number(m.calories || 0), 0);

  const weekStart = weekStartISO(today);
  const sessionsThisWeek = exercises.filter(e => e.logged_at >= weekStart).length;

  const tiles = [
    ['Current weight', latestWeight !== null ? `${latestWeight} lbs` : '—'],
    ['30-day change', weightChange !== null ? `${weightChange > 0 ? '+' : ''}${weightChange} lbs` : '—'],
    ['Today\'s calories', targets?.target_calories ? `${todaysCalories} / ${targets.target_calories}` : `${todaysCalories}`],
    ['Sessions this week', `${sessionsThisWeek}`],
  ];

  document.getElementById('dStats').innerHTML = tiles.map(([label, value]) => `
    <div class="stat-chip"><span>${value}</span>${label}</div>
  `).join('');
}

function renderWeightChart(rows) {
  const labels = rows.map(r => formatDateShort(r.logged_at));
  const values = rows.map(r => r.weight_lbs);

  const ctx = document.getElementById('dWeightChart').getContext('2d');
  if (dWeightChartInstance) dWeightChartInstance.destroy();
  dWeightChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Weight (lbs)',
        data: values,
        borderColor: '#0F7A6E',
        backgroundColor: 'rgba(15,122,110,0.1)',
        tension: 0.25,
        fill: true,
        pointRadius: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { ticks: { font: { size: 11 } } }, x: { ticks: { font: { size: 10 } } } },
    },
  });
}

function renderTodayMacros(rows, targets) {
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

  const el = document.getElementById('dMacros');
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

  const ctx = document.getElementById('dCalorieChart').getContext('2d');
  if (dCalorieChartInstance) dCalorieChartInstance.destroy();
  dCalorieChartInstance = new Chart(ctx, {
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

  const ctx = document.getElementById('dMacroChart').getContext('2d');
  if (dMacroChartInstance) dMacroChartInstance.destroy();
  dMacroChartInstance = new Chart(ctx, {
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

function renderExerciseCounts(rows) {
  const counts = { cardio: 0, lifting: 0, core: 0 };
  rows.forEach(r => {
    if (counts[r.category] != null) counts[r.category]++;
  });

  const tiles = EXERCISE_CATEGORIES.map(cat => [cat.charAt(0).toUpperCase() + cat.slice(1), counts[cat]]);
  tiles.push(['Total', rows.length]);

  document.getElementById('dExerciseCounts').innerHTML = tiles.map(([label, value]) => `
    <div class="stat-chip"><span>${value}</span>${label}</div>
  `).join('');
}
