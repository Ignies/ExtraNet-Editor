// Stroked line icons on a 24 px grid, in the style of the CMU Open Vehicles tool (several are copied from it).
const svg = body => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICONS = {
  library: svg('<path d="M4.5 4.5h3v15h-3z"/><path d="M9.5 4.5h3v15h-3z"/><path d="M14.6 5.3l2.9-.8 3.9 14.5-2.9.8z"/>'),
  monitor: svg('<rect x="3" y="4" width="18" height="12.5" rx="1.5"/><path d="M6.5 7.5h6"/><path d="M6.5 10.5h4"/><path d="M9 20h6"/><path d="M12 16.5V20"/>'),
  search: svg('<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>'),
  refresh: svg('<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>'),
  eye: svg('<path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.6"/>'),
  eyeoff: svg('<path d="M3 3l18 18"/><path d="M10.6 5.6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.8 3.6"/><path d="M6.3 6.9C3.9 8.6 2.5 12 2.5 12s3.5 6.5 9.5 6.5c1.6 0 3-.4 4.2-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'),
  copy: svg('<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>'),
  trash: svg('<path d="M5 7h14"/><path d="M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7"/><path d="M6.5 7l.8 11.2A1.5 1.5 0 0 0 8.8 19.6h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7"/>'),
  undo: svg('<path d="M9 14L4.5 9.5 9 5"/><path d="M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-3"/>'),
  redo: svg('<path d="M15 14l4.5-4.5L15 5"/><path d="M19.5 9.5H10a5.5 5.5 0 0 0 0 11h3"/>'),
  folder: svg('<path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4.2l2 2.2H19a1.5 1.5 0 0 1 1.5 1.5v7.8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5v-10z"/>'),
  download: svg('<path d="M12 4v11"/><path d="M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19.5h14"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  spark: svg('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z"/>'),
  grip: svg('<circle cx="9" cy="7" r="1" fill="currentColor"/><circle cx="15" cy="7" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="17" r="1" fill="currentColor"/><circle cx="15" cy="17" r="1" fill="currentColor"/>'),
  lock: svg('<rect x="5.5" y="10.5" width="13" height="9" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>'),
  unlock: svg('<rect x="5.5" y="10.5" width="13" height="9" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 6.8-1.2"/>'),
  write: svg('<path d="M4 20h4.5"/><path d="M8.5 20l10.3-10.3a2 2 0 0 0 0-2.8l-1.7-1.7a2 2 0 0 0-2.8 0L4 15.5V20h4.5z"/><path d="M12.5 7.5l4 4"/>'),
  brush: svg('<path d="M14.5 4.5l5 5-7.2 7.2-5-5 7.2-7.2z"/><path d="M7.3 11.7l-1.6 1.6a2.5 2.5 0 0 0 0 3.5L4.5 19.5h4.3a2.5 2.5 0 0 0 1.7-.7l1.8-1.8"/>'),
  rect: svg('<rect x="4.5" y="6" width="15" height="12" rx="1.5"/>'),
  ellipse: svg('<ellipse cx="12" cy="12" rx="8" ry="6"/>'),
  blocks: svg('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><path d="M16.5 13.5v6M13.5 16.5h6"/>'),
  pages: svg('<path d="M8 4.5h7l4 4V18a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 18V6A1.5 1.5 0 0 1 8 4.5z"/><path d="M15 4.5V8.5h4"/><path d="M9.5 12.5h6M9.5 15.5h4"/>'),
  site: svg('<circle cx="12" cy="12" r="8"/><path d="M4 12h16"/><path d="M12 4c2.5 2.3 3.6 5 3.6 8s-1.1 5.7-3.6 8c-2.5-2.3-3.6-5-3.6-8s1.1-5.7 3.6-8z"/>'),
  image: svg('<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M5 17l4.5-4.5 3 3 2.5-2.5L19.5 17"/>'),
  files: svg('<path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4.2l2 2.2H19a1.5 1.5 0 0 1 1.5 1.5v7.8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5v-10z"/><path d="M8 13.5h8"/>'),
  checklist: svg('<path d="M4.5 7l2 2 3.5-3.5"/><path d="M12.5 7.5h7"/><path d="M4.5 15l2 2 3.5-3.5"/><path d="M12.5 15.5h7"/>'),
  help: svg('<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.1-2.4 3.6"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  home: svg('<path d="M4.5 11L12 4.5l7.5 6.5"/><path d="M6.5 9.5V19h11V9.5"/>'),
  code: svg('<path d="M9 7l-5 5 5 5"/><path d="M15 7l5 5-5 5"/>'),
  repo: svg('<path d="M6.5 4.5h10a1.5 1.5 0 0 1 1.5 1.5v13.5l-3-2-3 2-3-2-3 2V6a1.5 1.5 0 0 1 1.5-1.5z"/><path d="M9.5 9h6M9.5 12h4"/>'),
  panel: svg('<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M9.5 5v14"/>'),
  upload: svg('<path d="M12 15.5v-11"/><path d="M7.5 9L12 4.5 16.5 9"/><path d="M5 19.5h14"/>'),
};

/** An icon element: <i class="ico" data-icon="name">. */
export function icon(name) {
  const i = document.createElement('i');
  i.className = 'ico';
  i.dataset.icon = name;
  i.innerHTML = ICONS[name] || '';
  return i;
}
