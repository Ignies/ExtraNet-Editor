// The game's page fonts (CMUComputerTheme.GetFont), loaded from the repository's /Fonts so the preview uses the
// same faces. Until a face loads, a similar system font stands in.

import { fetchResource, onRepoChanged } from './repo.js';

/** CSS family per page font, plus the faces behind it. Bold uses the font's bold file when it has one. */
export const FONT_FACES = {
  Sans: { family: 'GameSans', fallback: '"Noto Sans", "Segoe UI", Arial, sans-serif', regular: '/Fonts/NotoSans/NotoSans-Regular.ttf', bold: '/Fonts/NotoSans/NotoSans-Bold.ttf' },
  Display: { family: 'GameDisplay', fallback: '"Noto Sans Display", "Segoe UI", Arial, sans-serif', regular: '/Fonts/NotoSansDisplay/NotoSansDisplay-Regular.ttf', bold: '/Fonts/NotoSansDisplay/NotoSansDisplay-Bold.ttf' },
  Mono: { family: 'GameMono', fallback: '"Roboto Mono", Consolas, monospace', regular: '/Fonts/RobotoMono/RobotoMono-Regular.ttf', bold: '/Fonts/RobotoMono/RobotoMono-Bold.ttf' },
  // The terminal font has no bold file; the game uses the same face for both.
  Terminal: { family: 'GameTerminal', fallback: 'Consolas, "Courier New", monospace', regular: '/Fonts/UAVOSD/UAV-OSD-Sans-Mono.ttf', bold: '/Fonts/UAVOSD/UAV-OSD-Sans-Mono.ttf' },
  Pixel: { family: 'GamePixel', fallback: '"Lucida Console", monospace', regular: '/Fonts/Cozette/CozetteVector.ttf', bold: '/Fonts/Cozette/CozetteVectorBold.ttf' },
};

/** Rich text [bold] and [italic] switch to the Default* font prototypes (Noto Sans) whatever the page font. */
export const RICH_FACES = {
  family: 'GameRich',
  regular: '/Fonts/NotoSans/NotoSans-Regular.ttf',
  bold: '/Fonts/NotoSans/NotoSans-Bold.ttf',
  italic: '/Fonts/NotoSans/NotoSans-Italic.ttf',
  boldItalic: '/Fonts/NotoSans/NotoSans-BoldItalic.ttf',
};

const loaded = new Map();
let onLoaded = () => {};

export function onFontLoaded(callback) {
  onLoaded = callback;
}

onRepoChanged(() => {
  // Faces already in document.fonts stay; only failed ones are retried from the new repository.
  for (const [key, value] of loaded) if (value === 'failed') loaded.delete(key);
});

async function loadFace(family, path, descriptors) {
  const key = `${family}|${descriptors.weight}|${descriptors.style}`;
  if (loaded.has(key)) return;
  loaded.set(key, 'loading');
  try {
    const { data } = await fetchResource(path, 'blob');
    const face = new FontFace(family, await data.arrayBuffer(), descriptors);
    await face.load();
    document.fonts.add(face);
    loaded.set(key, 'ok');
    onLoaded();
  } catch {
    loaded.set(key, 'failed');
  }
}

/** Starts loading what a page in this font needs. */
export function ensureFont(name) {
  const face = FONT_FACES[name] || FONT_FACES.Sans;
  loadFace(face.family, face.regular, { weight: '400', style: 'normal' });
  loadFace(face.family, face.bold, { weight: '700', style: 'normal' });
  loadFace(RICH_FACES.family, RICH_FACES.regular, { weight: '400', style: 'normal' });
  loadFace(RICH_FACES.family, RICH_FACES.bold, { weight: '700', style: 'normal' });
  loadFace(RICH_FACES.family, RICH_FACES.italic, { weight: '400', style: 'italic' });
  loadFace(RICH_FACES.family, RICH_FACES.boldItalic, { weight: '700', style: 'italic' });
}

export function fontStack(name) {
  const face = FONT_FACES[name] || FONT_FACES.Sans;
  return `"${face.family}", ${face.fallback}`;
}

export function richStack() {
  return `"${RICH_FACES.family}", ${FONT_FACES.Sans.fallback}`;
}

/** Robust sizes fonts in points at 96 DPI. */
export function px(points) {
  return `${(points * 96 / 72).toFixed(2)}px`;
}

export function fontStatus() {
  const values = [...loaded.values()];
  return { ok: values.filter(v => v === 'ok').length, failed: values.filter(v => v === 'failed').length, total: values.length };
}
