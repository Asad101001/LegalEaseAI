/**
 * loader.js
 * Fetches each page fragment and injects into #app-root.
 * This gives the repo a multi-file structure while staying SPA.
 */

'use strict';

const PAGES = ['home', 'analysis', 'qa', 'report', 'about'];

async function loadPages() {
  const root = document.getElementById('app-root');
  if (!root) return;

  // Load all page fragments in parallel
  const results = await Promise.all(
    PAGES.map(name =>
      fetch(`pages/${name}.html`)
        .then(r => r.text())
        .catch(() => `<div class="page" id="page-${name}"><p style="padding:40px;color:red;">Failed to load page: ${name}.html</p></div>`)
    )
  );

  root.innerHTML = results.join('\n');

  // Fire init after all pages are in DOM
  if (typeof initApp === 'function') initApp();
}

// Run immediately
loadPages();
