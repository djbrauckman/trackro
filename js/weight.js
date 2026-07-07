/**
 * weight.js
 * Logic for weight.html: log entries, render trend chart + history table.
 */
let wChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  initNav('weight');
  document.getElementById('wDate').value = todayISO();
  document.getElementById('wSubmit').addEventListener('click', submitWeight);
  loadWeightData();
});

async function submitWeight() {
  const errorEl = document.getElementById('wError');
  errorEl.textContent = '';

  const logged_at = document.getElementById('wDate').value;
  const weight_lbs = parseFloat(document.getElementById('wWeight').value);
  const notes = document.getElementById('wNotes').value.trim() || null;

  if (!logged_at || isNaN(weight_lbs)) {
    errorEl.textContent = 'Enter a date and weight.';
    return;
  }

  const { error } = await supabaseClient
    .from('weight_entries')
    .insert({ logged_at, weight_lbs, notes });

  if (error) {
    errorEl.textContent = error.message;
    return;
  }

  document.getElementById('wWeight').value = '';
  document.getElementById('wNotes').value = '';
  loadWeightData();
}

async function deleteWeight(id) {
  await supabaseClient.from('weight_entries').delete().eq('id', id);
  loadWeightData();
}

async function loadWeightData() {
  const { data, error } = await supabaseClient
    .from('weight_entries')
    .select('*')
    .order('logged_at', { ascending: false })
    .limit(90);

  const historyEl = document.getElementById('wHistory');
  if (error) {
    historyEl.innerHTML = `<div class="empty-note">${escapeHtml(error.message)}</div>`;
    return;
  }

  renderWeightChart(data);
  renderWeightHistory(data);
}

function renderWeightChart(rows) {
  const ascending = [...rows].reverse();
  const labels = ascending.map(r => formatDateShort(r.logged_at));
  const values = ascending.map(r => r.weight_lbs);

  const ctx = document.getElementById('wChart').getContext('2d');
  if (wChartInstance) wChartInstance.destroy();
  wChartInstance = new Chart(ctx, {
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

function renderWeightHistory(rows) {
  const historyEl = document.getElementById('wHistory');
  if (!rows.length) {
    historyEl.innerHTML = '<div class="empty-note">No entries yet.</div>';
    return;
  }

  const rowsHtml = rows.slice(0, 20).map(r => `
    <tr>
      <td>${formatDateShort(r.logged_at)}</td>
      <td>${r.weight_lbs}</td>
      <td>${escapeHtml(r.notes)}</td>
      <td><button class="btn-danger" onclick="deleteWeight('${r.id}')">Delete</button></td>
    </tr>
  `).join('');

  historyEl.innerHTML = `
    <table class="history-table">
      <thead><tr><th>Date</th><th>Weight</th><th>Notes</th><th></th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
}
