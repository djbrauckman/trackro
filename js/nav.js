/**
 * nav.js
 * Injects shared navigation into every page.
 * Call initNav() with the current page key to highlight the active tab.
 */

const NAV_LINKS = [
  { key: 'dashboard', label: 'Dashboard', href: 'index.html' },
  { key: 'weight',    label: 'Weight',    href: 'weight.html' },
  { key: 'exercise',  label: 'Exercise',  href: 'exercise.html' },
  { key: 'macros',    label: 'Macros',    href: 'macros.html' },
  { key: 'goals',     label: 'Goals',     href: 'goals.html' },
];

function initNav(activePage) {
  const nav = document.getElementById('main-nav');
  if (!nav) return;

  nav.innerHTML = NAV_LINKS.map(link => {
    const isActive = link.key === activePage;
    return `<a href="${link.href}" class="nav-link ${isActive ? 'nav-link--active' : ''}">${link.label}</a>`;
  }).join('');
}
