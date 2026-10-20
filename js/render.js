// Draws a parsed page the way CMUNetPageView lays it out: page margins, fonts and sizes from the page style,
// guidebook paragraphs, lists and headings, and each ExtraNet tag.

import { parseDocument, walk, hexColour, parseFloatInvariant, H_ALIGN } from './markup.js';
import { checkTag, styleFromTag, isPlaceholderTag } from './tags.js';
import { el, rgba, css, mix, WHITE } from './util.js';
import { fontStack, richStack, px, ensureFont } from './fonts.js';
import { imageUrl, deepAds, wallpapers, locale, bundled } from './repo.js';
import { spriteCanvas } from './sprites.js';

export const THEMES = {
  CMUOsSeegson: { id: 'CMUOsSeegson', label: 'Seegson colony desktop', name: 'GARRISONLINK', phosphor: '#3FE05A', background: '#0A0E12' },
  CMUOsWeyland: { id: 'CMUOsWeyland', label: 'Weyland-Yutani terminal', name: 'WEYLAND-YUTANI', phosphor: '#FFB547', background: '#120A02' },
  CMUOsCMB: { id: 'CMUOsCMB', label: 'Marshals (CMB) console', name: 'CMB', phosphor: '#8FC4FF', background: '#050A14' },
};

/** CMUComputerTheme colours derived from an OS. */
export function themeColours(theme) {
  const phosphor = rgba(theme.phosphor);
  const background = rgba(theme.background);
  return {
    phosphor,
    background,
    accent: phosphor,
    dim: mix(background, phosphor, 0.45),
    defaultStyle: {
      background: theme.background,
      text: css(mix(phosphor, WHITE, 0.15)),
      heading: css(mix(phosphor, WHITE, 0.35)),
      link: theme.phosphor,
      font: 'Sans',
      backgroundMode: 'Stretch',
    },
  };
}

/** CMUNetPageStyle.Over: fields set in `top` win. */
export function over(top, fallback) {
  const out = { ...fallback };
  for (const [key, value] of Object.entries(top || {})) if (value) out[key] = value;
  return out;
}

/** A style from YAML or a tag as CSS colours; values the game would reject are left to the fallback. */
export function cleanStyle(style) {
  const out = {};
  for (const key of ['background', 'text', 'heading', 'link']) {
    if (style && style[key] && (hexColour(style[key]) || style[key].startsWith('rgba('))) out[key] = style[key];
  }
  if (style && ['Sans', 'Display', 'Mono', 'Terminal', 'Pixel'].includes(style.font)) out.font = style.font;
  if (style && style.backgroundImage) out.backgroundImage = style.backgroundImage;
  if (style && ['Stretch', 'Tile', 'Center'].includes(style.backgroundMode)) out.backgroundMode = style.backgroundMode;
  return out;
}

function colourCss(value) {
  return hexColour(value) || value;
}

function colourArray(value) {
  if (!value) return WHITE;
  if (value.startsWith('rgba(')) {
    const parts = value.slice(5, -1).split(',').map(Number);
    return [parts[0] / 255, parts[1] / 255, parts[2] / 255, parts[3]];
  }
  return rgba(value) || WHITE;
}

/** The text of a GuidebookError box. */
export function errorBox(title, detail, raw) {
  return el('div.gb-error', {},
    el('div.gb-error-head', { text: 'Parser Error' }),
    el('div.gb-error-detail', { text: detail ? `${title}\n${detail}` : title }),
    raw ? el('details.gb-error-raw', {}, el('summary', { text: 'Original markup' }), el('pre', { text: raw })) : null);
}

/**
 * Renders a page's text with a site style. Returns { page, popups, style, timers, error }.
 * ctx: { theme, onLink(address), colours (themeColours) }
 */
export function renderDocument(text, siteStyle, ctx) {
  let style = over(cleanStyle(siteStyle), ctx.colours.defaultStyle);
  const parsed = parseDocument(text);
  const timers = [];
  const popups = [];
  const page = el('div.page-content');

  if (parsed.error) {
    applyPageVars(page, style);
    page.append(errorBox('Error parsing this page', `Line ${parsed.error.line}, column ${parsed.error.col}: ${parsed.error.message}`, text));
    return { page, popups, style, timers, error: parsed.error };
  }

  if (text.includes('<CMUNetStyle')) {
    for (const node of walk(parsed.controls)) {
      if (node.kind === 'tag' && node.name === 'CMUNetStyle') {
        const tagStyle = styleFromTag(node);
        if (tagStyle) style = over(cleanStyle(tagStyle), style);
      }
    }
  }

  ensureFont(style.font);
  applyPageVars(page, style);
  const r = new Renderer(style, ctx, timers, popups);
  for (const control of parsed.controls) {
    const node = r.control(control);
    if (node) page.append(node);
  }
  return { page, popups, style, timers, error: null };
}

/** The style a page ends up with: the site style over the theme's, then any CMUNetStyle tags in the page. */
export function pageStyleOf(text, siteStyle, colours) {
  let style = over(cleanStyle(siteStyle), colours.defaultStyle);
  const parsed = parseDocument(text);
  if (parsed.error) return style;
  for (const node of walk(parsed.controls)) {
    if (node.kind === 'tag' && node.name === 'CMUNetStyle') {
      const tagStyle = styleFromTag(node);
      if (tagStyle) style = over(cleanStyle(tagStyle), style);
    }
  }
  return style;
}

/** Renders a piece of markup (one block's worth) in a page style. Returns { nodes, timers, popups }. */
export function renderSnippet(text, style, ctx) {
  const timers = [];
  const popups = [];
  const parsed = parseDocument(text);
  if (parsed.error) return { nodes: [errorBox('Error parsing this block', `${parsed.error.message}`, text)], timers, popups };
  const r = new Renderer(style, ctx, timers, popups);
  const nodes = parsed.controls.map(c => r.control(c)).filter(Boolean);
  return { nodes, timers, popups };
}

export function applyPageVars(node, style) {
  node.style.setProperty('--page-bg', colourCss(style.background));
  node.style.setProperty('--page-text', colourCss(style.text));
  node.style.setProperty('--page-heading', colourCss(style.heading || style.text));
  node.style.setProperty('--page-link', colourCss(style.link));
  node.style.setProperty('--page-font', fontStack(style.font));
  node.style.setProperty('--rich-font', richStack());
  node.style.setProperty('--f12', px(12));
  node.style.setProperty('--f13', px(13));
  node.style.setProperty('--f16', px(16));
  node.style.setProperty('--f20', px(20));
}

/** An ExtraNet link label: underlined, filled with the link colour on hover. */
export function netLink(text, link, colour, background, onLink) {
  const node = el('span.netlink', { title: link, text, tabIndex: 0 });
  node.style.setProperty('--l', colourCss(colour));
  node.style.setProperty('--lb', colourCss(background));
  const go = event => {
    event.preventDefault();
    event.stopPropagation();
    onLink(link);
  };
  node.addEventListener('click', go);
  node.addEventListener('keydown', event => {
    if (event.key === 'Enter') go(event);
  });
  return node;
}

const ALIGN_SELF = { Left: 'flex-start', Center: 'center', Right: 'flex-end', Stretch: 'stretch' };

class Renderer {
  constructor(style, ctx, timers, popups) {
    this.style = style;
    this.ctx = ctx;
    this.timers = timers;
    this.popups = popups;
  }

  control(node) {
    switch (node.kind) {
      case 'heading': {
        const cls = ['', 'h-bigger', 'h-heading', 'h-key'][node.level];
        return el(`div.page-heading.${cls}`, { text: node.text });
      }
      case 'list':
        return el('div.page-list', {}, el('span.page-bullet', { text: '  › ' }), this.text(node.item));
      case 'text':
        return this.text(node);
      case 'tag':
        return this.tag(node);
      default:
        return null;
    }
  }

  text(node) {
    if (node.rich.error) {
      return errorBox('Error parsing this text', node.rich.error.message, node.raw);
    }
    const block = el('div.page-text');
    this.rich(block, node.rich.nodes, this.style.text);
    return block;
  }

  /** Rich text with the guidebook's tags: colour, bold, italic, head sizes, bullets and netlinks. */
  rich(block, nodes, baseColour) {
    const colours = [colourCss(baseColour)];
    const fonts = [{ bold: false, italic: false, size: 12, rich: false }];
    const open = [];
    for (const node of nodes) {
      if (node.type === 'text') {
        const font = fonts[fonts.length - 1];
        const span = el('span', { text: node.value });
        span.style.color = colours[colours.length - 1];
        if (font.rich) {
          span.style.fontFamily = 'var(--rich-font)';
          if (font.bold) span.style.fontWeight = '700';
          if (font.italic) span.style.fontStyle = 'italic';
        }
        if (font.size !== 12) span.style.fontSize = px(font.size);
        block.append(span);
        continue;
      }
      if (node.type === 'close') {
        const index = open.lastIndexOf(node.name);
        if (index >= 0) open.splice(index, 1);
        if (node.name === 'color' && colours.length > 1) colours.pop();
        if (['bold', 'italic', 'bolditalic', 'head'].includes(node.name) && fonts.length > 1) fonts.pop();
        continue;
      }
      const current = fonts[fonts.length - 1];
      switch (node.name) {
        case 'color':
          if (node.param && node.param.kind === 'color') colours.push(namedColour(node.param.value));
          break;
        case 'bold':
          fonts.push({ ...current, rich: true, bold: true, italic: open.includes('italic') || current.italic });
          break;
        case 'italic':
          fonts.push({ ...current, rich: true, italic: true, bold: open.includes('bold') || current.bold });
          break;
        case 'bolditalic':
          fonts.push({ ...current, rich: true, bold: true, italic: true });
          break;
        case 'head': {
          if (node.param && node.param.kind === 'number') {
            const level = Math.min(Math.max(node.param.value, 1), 3);
            fonts.push({ ...current, rich: true, bold: true, size: Math.ceil(12 * 2 / Math.sqrt(level)) });
          } else {
            fonts.push(current);
          }
          break;
        }
        case 'bullet':
          block.append(el('span', { text: ' · ', style: { color: colours[colours.length - 1] } }));
          break;
        case 'netlink': {
          if (node.param && node.param.kind === 'string') {
            const link = node.attrs.link && node.attrs.link.kind === 'string' ? node.attrs.link.value : node.param.value;
            block.append(netLink(node.param.value, link, this.style.link, this.style.background, this.ctx.onLink));
          }
          break;
        }
        case 'textlink':
          if (node.param && node.param.kind === 'string') block.append(el('span.textlink', { text: node.param.value, title: 'Guidebook link: opens the guidebook in game' }));
          break;
        case 'keybind':
          block.append(el('span.keybind', { text: node.param ? String(node.param.value) : '?', title: 'Key binding: shows the player\'s key in game' }));
          break;
        case 'protodata':
          block.append(el('span.keybind', { text: 'data', title: 'Prototype data: filled in by the game' }));
          break;
        default:
          break;
      }
      open.push(node.name);
    }
  }

  children(container, node) {
    for (const child of node.children) {
      const rendered = this.control(child);
      if (rendered) container.append(rendered);
    }
    return container;
  }

  tag(node) {
    const check = checkTag(node);
    if (check.errors.length) return errorBox(`Failed to parse ${node.name} args`, check.errors.join('\n'));
    const a = node.args;
    switch (node.name) {
      case 'Document':
        return this.children(el('div.doc'), node);
      case 'CMUNetStyle':
        return null;
      case 'Box': {
        const box = el('div.gb-box');
        box.style.flexDirection = a.Orientation === 'Vertical' ? 'column' : 'row';
        if (a.Orientation !== 'Vertical') box.classList.add('gb-row');
        box.dataset.halign = a.HorizontalAlignment || 'Center';
        box.style.alignSelf = ALIGN_SELF[a.HorizontalAlignment || 'Center'];
        box.style.setProperty('--hal', ALIGN_SELF[a.HorizontalAlignment || 'Center']);
        if (a.Margin) box.style.margin = `${parseFloatInvariant(a.Margin)}px`;
        if (a.VerticalAlignment) box.style.alignItems = { Top: 'flex-start', Center: 'center', Bottom: 'flex-end', Stretch: 'stretch' }[a.VerticalAlignment];
        return this.children(box, node);
      }
      case 'ColorBox': {
        const box = el('div.gb-colorbox');
        box.style.background = colourCss(a.Color || '#00000000');
        box.style.borderWidth = `${a.OutlineThickness ? parseFloatInvariant(a.OutlineThickness) : 1}px`;
        box.style.borderColor = a.OutlineColor ? colourCss(a.OutlineColor) : '#FFFFFF';
        box.style.alignSelf = ALIGN_SELF[a.HorizontalAlignment || 'Stretch'];
        if (a.Margin) box.style.margin = `${parseFloatInvariant(a.Margin)}px`;
        return this.children(box, node);
      }
      case 'Table': {
        const table = el('div.gb-table');
        table.style.gridTemplateColumns = `repeat(${Math.max(1, parseInt(a.Columns, 10))}, minmax(0, auto))`;
        return this.children(table, node);
      }
      case 'CMUGuideImage':
        return this.image(node);
      case 'CMUNetSprite':
        return this.sprite(node);
      case 'CMUNetBlink':
        return this.blink(node);
      case 'CMUNetMarquee':
        return this.marquee(node);
      case 'CMUNetPopup':
        this.popups.push(this.popup(node));
        return null;
      case 'CMUNetAd':
        return this.ad(node);
      case 'CMUNetWallpaper':
        return this.wallpaper(node);
      default:
        if (isPlaceholderTag(node.name)) {
          const args = Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(' ');
          return el('div.tag-placeholder', { title: 'Drawn live by the game; the editor cannot show it.' },
            el('strong', { text: node.name }), args ? ` ${args}` : '', el('div.tag-placeholder-note', { text: 'Drawn by the game in play' }));
        }
        return null;
    }
  }

  image(node) {
    const a = node.args;
    const holder = el('div.gb-image');
    const img = el('img', { alt: '' });
    holder.append(img);
    const maxHeight = parseFloatInvariant(a.MaxHeight || '');
    imageUrl(a.Path).then(url => {
      img.onload = () => {
        const scale = maxHeight > 0 ? maxHeight / img.naturalHeight : 1;
        img.style.width = `${img.naturalWidth * scale}px`;
      };
      img.src = url;
    }).catch(() => {
      holder.replaceWith(errorBox('Failed to parse CMUGuideImage args', `No image at ${a.Path}${a.Path.startsWith('./') ? ' in the package' : ' in the repository'}.`));
    });
    return holder;
  }

  sprite(node) {
    const a = node.args;
    const holder = el('div.net-sprite');
    const align = H_ALIGN.includes(a.Align) ? a.Align : 'Center';
    holder.style.alignSelf = ALIGN_SELF[align];
    const scale = a.Scale !== undefined ? parseFloatInvariant(a.Scale) : 2;
    const loading = el('div.sprite-loading', { text: 'loading sprite' });
    holder.append(loading);
    spriteCanvas(a.Rsi, a.State, scale).then(canvas => {
      loading.replaceWith(canvas);
    }).catch(e => {
      holder.replaceWith(errorBox('Failed to parse CMUNetSprite args', `${a.Rsi} / ${a.State}: ${e.message}`));
    });
    return holder;
  }

  blink(node) {
    const box = this.children(el('div.net-blink'), node);
    const rate = node.args.Rate !== undefined ? parseFloatInvariant(node.args.Rate) : 0.6;
    let timer = 0;
    let visible = true;
    this.timers.push(dt => {
      timer += dt;
      if (timer < rate) return;
      timer = 0;
      visible = !visible;
      box.style.opacity = visible ? '1' : '0';
    });
    return box;
  }

  marquee(node) {
    const a = node.args;
    const speed = a.Speed !== undefined ? parseFloatInvariant(a.Speed) : 60;
    const colour = a.Color ? colourCss(a.Color) : colourCss(this.style.text);
    const text = el('span.net-marquee-text', { text: a.Text });
    text.style.color = colour;
    const box = el('div.net-marquee', {}, text);
    let offset = 0;
    this.timers.push(dt => {
      offset += dt * speed;
      const width = box.clientWidth;
      const textWidth = text.offsetWidth;
      if (textWidth > 0) offset %= width + textWidth;
      text.style.transform = `translateX(${width - offset}px)`;
    });
    return box;
  }

  popup(node) {
    const a = node.args;
    const float = (key, fallback) => {
      const v = a[key] !== undefined ? parseFloatInvariant(a[key]) : null;
      return v === null ? fallback : v;
    };
    const background = a.Background && hexColour(a.Background) ? a.Background : '#1A1A1A';
    const accent = a.Accent && hexColour(a.Accent) ? a.Accent : '#FFD200';
    const bg = rgba(background);
    const ink = bg[0] * 0.299 + bg[1] * 0.587 + bg[2] * 0.114 > 0.55 ? '#141414' : '#F2F2F2';
    const popup = el('div.net-popup');
    popup.style.setProperty('--pb', colourCss(background));
    popup.style.setProperty('--pa', colourCss(accent));
    const close = el('button.net-popup-close', { text: 'X', type: 'button', onclick: () => {
      popup.dataset.closed = '1';
      popup.style.display = 'none';
    } });
    const column = el('div.net-popup-column', {}, el('div.net-popup-text', { text: a.Text, style: { color: ink } }));
    if (a.Link) {
      column.append(netLink(a.LinkText || a.Link, a.Link, accent, background, this.ctx.onLink));
    }
    const body = el('div.net-popup-body');
    if (a.Icon) {
      const icon = el('img.net-popup-icon', { alt: '' });
      imageUrl(a.Icon).then(url => {
        icon.onload = () => {
          icon.style.width = `${icon.naturalWidth * 2}px`;
        };
        icon.src = url;
        body.prepend(icon);
      }).catch(() => {});
    }
    body.append(column);
    popup.append(el('div.net-popup-title', {}, el('span', { text: a.Title }), close), body);
    popup.dataset.x = String(Math.min(1, Math.max(0, float('X', 0.5))));
    popup.dataset.y = String(Math.min(1, Math.max(0, float('Y', 0.3))));
    popup.dataset.delay = String(Math.max(0, float('Delay', 1)));
    return popup;
  }

  ad(node) {
    const a = node.args;
    const flip = a.Flip !== undefined && a.Flip.trim().toLowerCase() === 'true';
    const banner = el('div.net-ad', {}, el('div.net-ad-loading', { text: `ad ${a.Id}` }));
    Promise.all([deepAds(), locale().catch(() => ({})), bundled('ad_sprites.json').catch(() => ({}))]).then(([ads, strings, sprites]) => {
      const ad = ads.get(a.Id);
      banner.textContent = '';
      if (!ad) {
        banner.replaceWith(errorBox('Failed to parse CMUNetAd args', `No cmuDeepAd with id ${a.Id} in deep_ads.yml.`));
        return;
      }
      drawAd(banner, ad, strings, sprites, flip);
    }).catch(() => {
      banner.textContent = '';
      banner.classList.add('net-ad-offline');
      banner.append(el('div.ad-placeholder', { text: `CMUNetAd ${a.Id}: the repository could not be reached, so the ad is not drawn.` }));
    });
    return banner;
  }

  wallpaper(node) {
    const box = el('div.net-wallpaper');
    const img = el('img', { alt: '' });
    const name = el('div.h-key.page-heading', { text: node.args.Id });
    const button = el('button.net-wallpaper-set', { type: 'button', text: 'Use as desktop wallpaper', title: 'Sets the terminal\'s desktop wallpaper in game' });
    box.append(el('div.net-wallpaper-frame', {}, img), name, button);
    Promise.all([wallpapers(), locale().catch(() => ({}))]).then(([all, strings]) => {
      const wallpaper = all.get(node.args.Id);
      if (!wallpaper) {
        box.replaceWith(errorBox('Failed to parse CMUNetWallpaper args', `No cmuWallpaper with id ${node.args.Id} in wallpapers.yml.`));
        return;
      }
      name.textContent = strings[wallpaper.name] || wallpaper.name;
      if (strings['cmu-wallpaper-set']) button.textContent = strings['cmu-wallpaper-set'];
      imageUrl(wallpaper.path).then(url => {
        img.src = url;
      }).catch(() => {});
    }).catch(() => {
      name.textContent = `${node.args.Id} (repository not reachable)`;
    });
    return box;
  }
}

/** Robust colour names are the CSS ones in practice; an unknown name is black. */
function namedColour(value) {
  if (value.startsWith('#')) return hexColour(value) || '#000000';
  return CSS.supports('color', value) ? value : '#000000';
}

const BADGE_RSI = '/Textures/CMU14/PersonalComputers/Sites/Ads/badges.rsi';

/** CMUNetAd: gradient banner with a frame and scanlines, product sprite, words and a price tag. */
function drawAd(banner, ad, strings, sprites, flip) {
  const top = ad.top || '#0E3B5C';
  const bottom = ad.bottom || '#06182A';
  const accent = ad.accent || '#FFD200';
  const textColour = ad.text || '#FFFFFF';
  const scale = ad.scale ? parseFloat(ad.scale) : 3;
  banner.style.setProperty('--ad-top', colourCss(top));
  banner.style.setProperty('--ad-bottom', colourCss(bottom));
  banner.style.setProperty('--ad-accent', colourCss(accent));

  const product = el('div.net-ad-product');
  product.style.minWidth = `${32 * scale}px`;
  product.style.minHeight = `${32 * scale}px`;
  if (ad.gear) {
    product.append(el('div.ad-placeholder', { text: `person in ${ad.gear}` }));
  } else {
    const layers = sprites[ad.entity];
    if (layers && layers.length) {
      const stack = el('div.ad-layers');
      product.append(stack);
      layers.forEach((layer, index) => {
        spriteCanvas(layer.rsi, layer.state, scale).then(canvas => {
          canvas.style.zIndex = String(index);
          stack.append(canvas);
        }).catch(() => {});
      });
    } else {
      product.append(el('div.ad-placeholder', { text: ad.entity || ad.id }));
    }
  }

  const loc = id => strings[id] || id;
  const words = el('div.net-ad-words', {},
    el('div.h-key.ad-brand', { text: loc(ad.brand).toUpperCase(), style: { color: colourCss(accent) } }),
    el('div.h-bigger.ad-product', { text: loc(ad.product), style: { color: colourCss(textColour) } }),
    el('div.ad-slogan', { text: loc(ad.slogan), style: { color: css(colourArray(colourCss(textColour)), 0.85) } }));

  const corner = el('div.net-ad-corner');
  if (ad.badge) {
    spriteCanvas(BADGE_RSI, ad.badge, 2).then(canvas => corner.prepend(canvas)).catch(() => {});
  }
  if (ad.price) {
    corner.append(el('div.net-ad-price', { text: ad.price, style: { background: colourCss(accent), color: colourCss(bottom) } }));
  }

  const row = el('div.net-ad-row');
  if (flip) row.append(words, corner, product);
  else row.append(product, words, corner);
  banner.append(row);
}
