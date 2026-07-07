/**
 * dashboard.js
 * Logic for index.html: overview stat tiles + summary charts pulled from
 * all three tables plus goals.
 */
let dWeightChartInstance = null;
let dExerciseChartInstance = null;

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
  const [{ data: weights }, { data: exercises }, { data: macros }, { data: goals }] = await Promise.all([
    supabaseClient.from('weight_entries').select('*').gte('logged_at', daysAgoISO(60)).order('logged_at', { ascending: true }),
    supabaseClient.from('exercise_entries').select('*').gte('logged_at', daysAgoISO(60)).order('logged_at', { ascending: true }),
    supabaseClient.from('macro_entries').select('*').gte('logged_at', daysAgoISO(30)).order('logged_at', { ascending: true }),
    supabaseClient.from('goals').select('*').eq('id', 1).single(),
  ]);

  renderStats(weights || [], exercises || [], macros || [], goals);
  renderWeightChart(weights || []);
  renderTodayMacros(macros || [], goals);
  renderExerciseChart(exercises || []);
}

function renderStats(weights, exercises, macros, goals) {
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
    ['Today\'s calories', goals?.target_calories ? `${todaysCalories} / ${goals.target_calories}` : `${todaysCalories}`],
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

function renderTodayMacros(rows, goals) {
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
  }).join('') || '<div class="empty-note">Set targets on the Goals page.</div>';
}

function renderExerciseChart(rows) {
  const counts = {};
  rows.forEach(r => {
    const wk = weekStartISO(r.logged_at);
    counts[wk] = (counts[wk] || 0) + 1;
  });
  const weeks = Object.keys(counts).sort();
  const labels = weeks.map(formatDateShort);
  const values = weeks.map(w => counts[w]);

  const ctx = document.getElementById('dExerciseChart').getContext('2d');
  if (dExerciseChartInstance) dExerciseChartInstance.destroy();
  dExerciseChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Sessions',
        data: values,
        backgroundColor: '#1B5EAB',
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } } },
        x: { ticks: { font: { size: 10 } } },
      },
    },
  });
}
