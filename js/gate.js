/**
 * gate.js
 * Client-side passcode lock. Hides #app-content and shows a lock overlay
 * until the correct passcode is entered once, then remembers it in
 * localStorage for next time.
 *
 * Note: this is a convenience gate, not real security — the Supabase anon
 * key ships in the JS regardless. See README for details.
 */
const UNLOCK_KEY = 'trackro_unlocked';

function isUnlocked() {
  return localStorage.getItem(UNLOCK_KEY) === 'true';
}

document.addEventListener('DOMContentLoaded', () => {
  const content = document.getElementById('app-content');

  if (isUnlocked()) {
    if (content) content.style.display = '';
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = 'lock-screen';
  overlay.innerHTML = `
    <div class="lock-card">
      <h1>Trackro</h1>
      <input type="password" id="lock-passcode" placeholder="Passcode" autofocus />
      <button class="btn-primary" id="lock-submit" style="width:100%">Unlock</button>
      <div class="lock-error" id="lock-error"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const input = overlay.querySelector('#lock-passcode');
  const error = overlay.querySelector('#lock-error');

  function tryUnlock() {
    if (input.value === APP_PASSCODE) {
      localStorage.setItem(UNLOCK_KEY, 'true');
      overlay.remove();
      if (content) content.style.display = '';
    } else {
      error.textContent = 'Incorrect passcode';
      input.value = '';
      input.focus();
    }
  }

  overlay.querySelector('#lock-submit').addEventListener('click', tryUnlock);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tryUnlock();
  });
});
