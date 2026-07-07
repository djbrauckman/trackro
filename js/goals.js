/**
 * goals.js
 * Logic for goals.html: read/write the single `goals` row.
 */
document.addEventListener('DOMContentLoaded', () => {
  initNav('goals');
  document.getElementById('gSubmit').addEventListener('click', saveGoals);
  loadGoals();
});

async function loadGoals() {
  const { data, error } = await supabaseClient.from('goals').select('*').eq('id', 1).single();
  const errorEl = document.getElementById('gError');
  if (error) {
    errorEl.textContent = error.message;
    return;
  }
  document.getElementById('gWeight').value = data.target_weight_lbs ?? '';
  document.getElementById('gCalories').value = data.target_calories ?? '';
  document.getElementById('gProtein').value = data.target_protein_g ?? '';
  document.getElementById('gCarbs').value = data.target_carbs_g ?? '';
  document.getElementById('gFat').value = data.target_fat_g ?? '';
}

async function saveGoals() {
  const errorEl = document.getElementById('gError');
  const successEl = document.getElementById('gSuccess');
  errorEl.textContent = '';
  successEl.textContent = '';

  const numOrNull = (id) => {
    const v = document.getElementById(id).value;
    return v === '' ? null : parseFloat(v);
  };

  const { error } = await supabaseClient.from('goals').upsert({
    id: 1,
    target_weight_lbs: numOrNull('gWeight'),
    target_calories: numOrNull('gCalories'),
    target_protein_g: numOrNull('gProtein'),
    target_carbs_g: numOrNull('gCarbs'),
    target_fat_g: numOrNull('gFat'),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    errorEl.textContent = error.message;
    return;
  }
  successEl.textContent = 'Saved.';
}
