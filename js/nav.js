/**
 * nav.js
 * Injects shared navigation into every page.
 * Call initNav() with the current page key to highlight the active tab.
 * Icons are self-contained here (not utils.js) since not every page loads
 * utils.js before nav.js.
 */

const NAV_ICON_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

const NAV_ICONS = {
  dashboard: `<svg ${NAV_ICON_ATTRS}><line x1="4" y1="20" x2="4" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="20" y1="20" x2="20" y2="14"/></svg>`,
  weight: `<svg ${NAV_ICON_ATTRS}><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="12" cy="13" r="4"/><line x1="12" y1="13" x2="12" y2="10"/></svg>`,
  exercise: `<svg ${NAV_ICON_ATTRS}><rect x="1" y="8" width="4" height="8" rx="1"/><rect x="19" y="8" width="4" height="8" rx="1"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  macros: `<svg ${NAV_ICON_ATTRS}><line x1="4" y1="2" x2="4" y2="7"/><line x1="6" y1="2" x2="6" y2="7"/><line x1="8" y1="2" x2="8" y2="7"/><path d="M4 7v2a2 2 0 0 0 4 0V7"/><line x1="6" y1="9" x2="6" y2="22"/><path d="M17 2c-1.5 2.5-1.5 5.5 0 8v12"/></svg>`,
  goals: `<svg ${NAV_ICON_ATTRS}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/></svg>`,
};

const NAV_LINKS = [
  { key: 'dashboard', label: 'Dashboard', href: 'index.html' },
  { key: 'weight',    label: 'Weight',    href: 'weight.html' },
  { key: 'exercise',  label: 'Exercise',  href: 'exercise.html' },
  { key: 'macros',    label: 'Macros',    href: 'macros.html' },
  { key: 'goals',     label: 'Targets',   href: 'goals.html' },
];

function initNav(activePage) {
  const nav = document.getElementById('main-nav');
  if (!nav) return;

  nav.innerHTML = NAV_LINKS.map(link => {
    const isActive = link.key === activePage;
    return `<a href="${link.href}" class="nav-link ${isActive ? 'nav-link--active' : ''}"><span class="nav-icon">${NAV_ICONS[link.key]}</span>${link.label}</a>`;
  }).join('');
}
