/**
 * exercise.js
 * Logic for exercise.html: log entries, render weekly volume chart + history table.
 */
let eChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  initNav('exercise');
  document.getElementById('eDate').value = todayISO();
  resetExerciseRows();
  updateCategoryFields();

  document.getElementById('eCategory').addEventListener('change', updateCategoryFields);
  document.getElementById('eSubmit').addEventListener('click', submitExercise);
  document.getElementById('eAddExercise').addEventListener('click', addExerciseRow);
  document.getElementById('eExercises').addEventListener('click', (e) => {
    if (e.target.classList.contains('ex-remove')) {
      removeExerciseRow(e.target.closest('.repeatable-row'));
    }
  });
  document.getElementById('eDuration').addEventListener('blur', updatePaceField);
  document.getElementById('eDistance').addEventListener('blur', updatePaceField);

  loadExerciseData();
});

// Parses "mm:ss" (or a bare number of minutes) into fractional minutes.
function parseMinutesSeconds(str) {
  if (!str) return null;
  const trimmed = str.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(':');
  if (parts.length === 1) {
    const n = parseFloat(parts[0]);
    return isNaN(n) ? null : n;
  }
  const mins = parseInt(parts[0], 10) || 0;
  const secs = parseFloat(parts[1]) || 0;
  return mins + secs / 60;
}

function formatMinutesSeconds(totalMinutes) {
  if (totalMinutes == null || isNaN(totalMinutes)) return '';
  const totalSeconds = Math.round(totalMinutes * 60);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function updateCategoryFields() {
  const isCardio = document.getElementById('eCategory').value === 'cardio';
  document.getElementById('eCardioFields').style.display = isCardio ? '' : 'none';
  document.getElementById('eLiftFields').style.display = isCardio ? 'none' : '';
}

// Recomputes pace from duration + distance, unless the user is actively editing the pace field.
function updatePaceField() {
  if (document.activeElement === document.getElementById('ePace')) return;
  const durationMin = parseMinutesSeconds(document.getElementById('eDuration').value);
  const distanceMi = parseFloat(document.getElementById('eDistance').value);
  if (!durationMin || !distanceMi) return;
  document.getElementById('ePace').value = formatMinutesSeconds(durationMin / distanceMi);
}

function exerciseRowEl() {
  const div = document.createElement('div');
  div.className = 'repeatable-row';
  div.innerHTML = `
    <div class="repeatable-row-head">
      <span>Exercise</span>
      <button type="button" class="btn-danger ex-remove">Remove</button>
    </div>
    <div style="margin-bottom:16px">
      <div class="label">Name</div>
      <input type="text" class="ex-name" placeholder="e.g. Squat" />
    </div>
    <div class="input-row-3">
      <div>
        <div class="label">Sets</div>
        <input type="number" class="ex-sets" step="1" />
      </div>
      <div>
        <div class="label">Reps</div>
        <input type="number" class="ex-reps" step="1" />
      </div>
      <div>
        <div class="label">Load (lbs)</div>
        <input type="number" class="ex-load" step="0.5" />
      </div>
    </div>
  `;
  return div;
}

function addExerciseRow() {
  document.getElementById('eExercises').appendChild(exerciseRowEl());
  updateExerciseRemoveButtons();
}

function removeExerciseRow(rowEl) {
  rowEl.remove();
  updateExerciseRemoveButtons();
}

function updateExerciseRemoveButtons() {
  const rows = document.querySelectorAll('#eExercises .repeatable-row');
  rows.forEach(row => {
    row.querySelector('.ex-remove').style.display = rows.length > 1 ? '' : 'none';
  });
}

function resetExerciseRows() {
  const container = document.getElementById('eExercises');
  container.innerHTML = '';
  container.appendChild(exerciseRowEl());
  updateExerciseRemoveButtons();
}

async function submitExercise() {
  const errorEl = document.getElementById('eError');
  errorEl.textContent = '';

  const logged_at = document.getElementById('eDate').value;
  const exercise_name = document.getElementById('eName').value.trim();
  const category = document.getElementById('eCategory').value;

  if (!logged_at || !exercise_name) {
    errorEl.textContent = 'Enter a date and title.';
    return;
  }

  const numOrNull = (id) => {
    const v = document.getElementById(id).value;
    return v === '' ? null : parseFloat(v);
  };

  const duration_min = parseMinutesSeconds(document.getElementById('eDuration').value);

  const entry = {
    logged_at,
    exercise_name,
    category,
    duration_min,
    calories_burned: numOrNull('eCalories'),
    notes: document.getElementById('eNotes').value.trim() || null,
    sets: null,
    reps: null,
    load_lbs: null,
    distance_mi: null,
    pace_sec_per_mi: null,
    details: null,
  };

  if (category === 'cardio') {
    const distance_mi = numOrNull('eDistance');
    entry.distance_mi = distance_mi;

    const paceMin = parseMinutesSeconds(document.getElementById('ePace').value);
    entry.pace_sec_per_mi = paceMin != null
      ? paceMin * 60
      : (duration_min && distance_mi ? (duration_min / distance_mi) * 60 : null);
  } else {
    const items = [];
    document.querySelectorAll('#eExercises .repeatable-row').forEach(row => {
      const name = row.querySelector('.ex-name').value.trim();
      if (!name) return;
      const sets = row.querySelector('.ex-sets').value;
      const reps = row.querySelector('.ex-reps').value;
      const load = row.querySelector('.ex-load').value;
      let line = name;
      if (sets !== '' || reps !== '') line += `: ${sets || '-'}x${reps || '-'}`;
      if (load !== '') line += ` @ ${load} lbs`;
      items.push(line);
    });

    if (!items.length) {
      errorEl.textContent = 'Add at least one exercise.';
      return;
    }
    entry.details = items.join('\n');
  }

  const { error } = await supabaseClient.from('exercise_entries').insert(entry);
  if (error) {
    errorEl.textContent = error.message;
    return;
  }

  ['eName', 'eDuration', 'eDistance', 'ePace', 'eCalories', 'eNotes'].forEach(id => {
    document.getElementById(id).value = '';
  });
  resetExerciseRows();
  loadExerciseData();
}

async function deleteExercise(id) {
  await supabaseClient.from('exercise_entries').delete().eq('id', id);
  loadExerciseData();
}

async function loadExerciseData() {
  const { data, error } = await supabaseClient
    .from('exercise_entries')
    .select('*')
    .gte('logged_at', daysAgoISO(90))
    .order('logged_at', { ascending: false });

  const historyEl = document.getElementById('eHistory');
  if (error) {
    historyEl.innerHTML = `<div class="empty-note">${escapeHtml(error.message)}</div>`;
    return;
  }

  renderExerciseChart(data);
  renderExerciseHistory(data);
}

function weekStartISO(isoDate) {
  const d = new Date(isoDate + 'T00:00:00');
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - day);
  return d.toLocaleDateString('en-CA');
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

  const ctx = document.getElementById('eChart').getContext('2d');
  if (eChartInstance) eChartInstance.destroy();
  eChartInstance = new Chart(ctx, {
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

function renderExerciseHistory(rows) {
  const historyEl = document.getElementById('eHistory');
  if (!rows.length) {
    historyEl.innerHTML = '<div class="empty-note">No entries yet.</div>';
    return;
  }

  const details = (r) => {
    const parts = [];
    if (r.duration_min) parts.push(`${formatMinutesSeconds(r.duration_min)} min`);
    if (r.distance_mi) parts.push(`${r.distance_mi} mi`);
    if (r.pace_sec_per_mi) parts.push(`${formatMinutesSeconds(r.pace_sec_per_mi / 60)}/mi`);
    if (r.calories_burned) parts.push(`${r.calories_burned} cal`);
    if (r.sets || r.reps) parts.push(`${r.sets || '-'}x${r.reps || '-'}`);
    if (r.load_lbs) parts.push(`${r.load_lbs} lbs`);
    let text = parts.join(' · ');
    if (r.details) text += (text ? ' · ' : '') + r.details.replace(/\n/g, '; ');
    if (r.notes) text += (text ? ' · ' : '') + r.notes;
    return escapeHtml(text);
  };

  const rowsHtml = rows.slice(0, 25).map(r => `
    <tr>
      <td>${formatDateShort(r.logged_at)}</td>
      <td>${escapeHtml(r.exercise_name)}</td>
      <td>${details(r)}</td>
      <td><button class="btn-danger" onclick="deleteExercise('${r.id}')">Delete</button></td>
    </tr>
  `).join('');

  historyEl.innerHTML = `
    <table class="history-table">
      <thead><tr><th>Date</th><th>Title</th><th>Details</th><th></th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
}
