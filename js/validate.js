// The checks CMUExtraNetTest and the YAML linter run on a site, plus the contributor guide's advice.
// Errors fail the game's tests; warnings are things the game ignores or that read badly; info is a note.

import { parseDocument, walk, netlinks, lineCol, hexColour, splitAddress, isBuiltIn, isCamera, NETWORKS, FONTS, BACKGROUND_MODES, richPlainText } from './markup.js';
import { checkTag } from './tags.js';
import { pageForPath, attributionFor } from './package.js';
import { resourceExists, deepAds, wallpapers, knownAddresses, bundled } from './repo.js';
import { loadRsi, rootedRsi } from './sprites.js';

function issue(level, file, message, line = null, extra = {}) {
  return { level, file, message, line, ...extra };
}

const SITE = 'site.yml';

export function normalisedPath(path) {
  return path.trim().replace(/^\/+|\/+$/g, '').toLowerCase();
}

/** Checks the site settings. */
function checkSite(pkg, out) {
  const s = pkg.site;
  if (!s.id) out.push(issue('error', SITE, 'The site needs an id.'));
  else {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(s.id)) out.push(issue('error', SITE, `Id "${s.id}" may only hold letters, digits and _.`));
    if (!s.id.startsWith('CMUNetSitePackage')) out.push(issue('warning', SITE, `Package site ids start with CMUNetSitePackage (e.g. CMUNetSitePackage${pkg.folder}).`));
  }
  if (!s.address) out.push(issue('error', SITE, 'The site needs an address.'));
  else {
    if (s.address !== s.address.trim().toLowerCase()) out.push(issue('error', SITE, `Address "${s.address}" must be lowercase without surrounding spaces.`));
    if (/[/\s]/.test(s.address)) out.push(issue('error', SITE, `Address "${s.address}" is a bare host: no slashes or spaces.`));
    if (s.address.includes('://')) out.push(issue('error', SITE, 'Leave the scheme (http://) out of the address.'));
    else if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/.test(s.address.trim().toLowerCase())) {
      out.push(issue('warning', SITE, `Address "${s.address}" should be letters, digits, dots and dashes, like lostfound.colony.`));
    }
  }
  if (!s.title) out.push(issue('error', SITE, 'The site needs a title.'));
  if (!s.networks.length) out.push(issue('error', SITE, 'Put the site on at least one network.'));
  for (const network of s.networks) if (!NETWORKS.includes(network)) out.push(issue('error', SITE, `Unknown network ${network}.`));
  const deep = s.networks.includes('CMUNetDeep');
  if (deep && !s.unlisted) out.push(issue('warning', SITE, 'Deep sites should be unlisted: true (players find them with The deeps.exi scan).'));
  if (deep && s.networks.length > 1) out.push(issue('warning', SITE, 'A deep site on other networks too still only answers at its random deep address.'));
  if (s.hidden && !deep) out.push(issue('warning', SITE, 'hidden only matters for deep sites (it keeps them to the ad maze).'));
  if (s.aliasSuffix) {
    if (!deep) out.push(issue('warning', SITE, 'aliasSuffix only matters for deep sites; it is not written for this one.'));
    else if (!/^\.[a-z0-9]+$/.test(s.aliasSuffix)) out.push(issue('error', SITE, `aliasSuffix "${s.aliasSuffix}" should look like .deep, .file or .cam.`));
  }

  for (const key of ['background', 'text', 'heading', 'link']) {
    const value = s.style[key];
    if (value && !hexColour(value)) out.push(issue('error', SITE, `style.${key} "${value}" is not a colour like #FFD24A.`));
  }
  if (s.style.font && !FONTS.includes(s.style.font)) out.push(issue('error', SITE, `style.font must be one of ${FONTS.join(', ')}.`));
  if (s.style.backgroundMode && !BACKGROUND_MODES.includes(s.style.backgroundMode)) out.push(issue('error', SITE, `style.backgroundMode must be one of ${BACKGROUND_MODES.join(', ')}.`));

  const seen = new Map();
  if (!s.pages.some(p => normalisedPath(p.path) === '')) out.push(issue('error', SITE, 'Every site needs an index page listed under "" (the empty path).'));
  for (const page of s.pages) {
    const key = normalisedPath(page.path);
    if (seen.has(key)) out.push(issue('error', SITE, `Two pages use the path "${page.path}".`));
    seen.set(key, page);
    if (/\s/.test(page.path)) out.push(issue('error', SITE, `Page path "${page.path}" has spaces; players cannot type it.`));
    if (page.path !== page.path.toLowerCase()) out.push(issue('warning', SITE, `Page path "${page.path}" is matched lowercase; write it lowercase.`));
    if (!page.file) out.push(issue('error', SITE, `Page "${page.path}" has no file.`));
    else {
      if (!/\.xml$/i.test(page.file)) out.push(issue('warning', SITE, `Page file ${page.file} should be an .xml file.`));
      if (!(page.file in pkg.texts)) out.push(issue('error', SITE, `Page "${page.path}" points to missing file ${page.file}.`));
    }
  }

  for (const tab of s.tabs) {
    if (!tab.title) out.push(issue('error', SITE, 'A tab has no title.'));
    if (!pageForPath(s, tab.path || '')) out.push(issue('error', SITE, `Tab "${tab.title}" points to "${tab.path}", which is not one of the site's pages.`));
  }

  if (s.board) {
    const b = s.board;
    if (!b.postLabel) out.push(issue('error', SITE, 'board.postLabel is required (the composer button text).'));
    if (!b.empty) out.push(issue('error', SITE, 'board.empty is required (shown with no postings).'));
    if (!b.posters.length && !b.anyonePosts && !b.posterWhitelist) out.push(issue('warning', SITE, 'Nobody can post on this board but admins: list posters jobs or tick anyone posts.'));
    if (b.leaks && !deep) out.push(issue('warning', SITE, 'board.leaks only lands on deep sites.'));
  }
}

const CHAR_NAMES = { '>': '>', '&': '&', '"': 'double quotes' };

/** Checks one page's markup. Returns the parse for the async checks. */
function checkPage(pkg, file, text, out) {
  const parsed = parseDocument(text);
  if (parsed.error) {
    out.push(issue('error', file, `The page does not parse: ${parsed.error.message}. The game shows an error box instead of the page.`, parsed.error.line));
    return null;
  }
  const s = pkg.site;
  const lineOf = offset => lineCol(text, offset).line;
  const own = s.address.trim().toLowerCase();
  const deep = s.networks.includes('CMUNetDeep');

  if (!parsed.controls.length) out.push(issue('warning', file, 'The page is empty.'));
  else if (!(parsed.controls.length === 1 && parsed.controls[0].kind === 'tag' && parsed.controls[0].name === 'Document')) {
    out.push(issue('info', file, 'Pages are normally one <Document> ... </Document> block.', lineOf(parsed.controls[0].start)));
  }

  const checkLink = (link, line) => {
    if (!link) return;
    if (isBuiltIn(link)) {
      if (/^net:\/\//i.test(link) && link.trim().toLowerCase() !== 'net://random') out.push(issue('warning', file, `${link}: the only net:// link the browser knows is net://random.`, line));
      return;
    }
    if (isCamera(link)) {
      out.push(issue(deep ? 'info' : 'warning', file, `${link} opens a camera grid${deep ? '' : '; camera links only work on deep sites'}.`, line));
      return;
    }
    const { host, path } = splitAddress(link);
    if (host === own) {
      if (!pageForPath(s, path)) out.push(issue('error', file, `Link to ${link}: the site has no page "${path}".`, line));
      return;
    }
    out.push(issue('info', file, `External link ${link}: only works if that site exists in game.`, line, { external: host }));
  };

  for (const node of walk(parsed.controls)) {
    if (node.kind === 'tag') {
      const { errors, warnings } = checkTag(node);
      for (const message of errors) out.push(issue('error', file, message, lineOf(node.start)));
      for (const message of warnings) out.push(issue('warning', file, message, lineOf(node.start)));
      if (node.name === 'CMUNetPopup' && node.args.Link) checkLink(node.args.Link, lineOf(node.start));
      if (node.name === 'Document' && Object.keys(node.args).length) out.push(issue('warning', file, '<Document> takes no attributes.', lineOf(node.start)));
      continue;
    }
    if (node.kind === 'heading') {
      if (/\[\/?[a-z]+[^\]]*\]/i.test(node.text)) out.push(issue('warning', file, 'Headings are plain text: markup like [bold] shows as typed.', lineOf(node.start)));
      if (/[<>&"]/.test(node.text)) out.push(issue('warning', file, 'Avoid <, >, & and double quotes in text.', lineOf(node.start)));
      continue;
    }
    if (node.kind !== 'text') continue;
    if (node.rich.error) {
      out.push(issue('error', file, `Bad rich text markup: ${node.rich.error.message}. The game shows an error box for this paragraph.`, lineOf(node.start)));
      continue;
    }
    if (node.rich.truncated >= 0) out.push(issue('warning', file, 'A backslash (\\) that escapes nothing cuts the rest of this paragraph off in game.', lineOf(node.start)));
    for (const note of node.notes) {
      if (note.type === 'merged-heading') out.push(issue('warning', file, 'This # line runs on from the line above, so it is shown as text, not a heading. Put a blank line before it.', lineOf(note.offset)));
    }
    const plain = richPlainText(node.rich.nodes);
    const bad = [...new Set([...plain].filter(c => c in CHAR_NAMES))];
    if (bad.length) out.push(issue('warning', file, `Avoid ${bad.map(c => CHAR_NAMES[c]).join(', ')} in page text outside markup.`, lineOf(node.start)));
    for (const tag of node.rich.nodes.filter(n => n.type === 'open')) {
      if (!['bold', 'bolditalic', 'bullet', 'color', 'head', 'italic', 'textlink', 'keybind', 'protodata', 'netlink'].includes(tag.name)) {
        out.push(issue('warning', file, `[${tag.name}] is not a page text tag; it is skipped and its text shown plain.`, lineOf(node.start)));
      }
      if (tag.name === 'color' && (!tag.param || tag.param.kind !== 'color')) out.push(issue('warning', file, '[color] needs a value like [color=#FFD24A].', lineOf(node.start)));
    }
    for (const link of netlinks(node)) {
      if (link.text === null) {
        out.push(issue('error', file, 'netlink text must be quoted: [netlink="Text" link="host/path"].', lineOf(node.start)));
        continue;
      }
      checkLink(link.link, lineOf(node.start));
    }
  }
  return parsed;
}

/** Synchronous checks: everything that needs no network. */
export function validateSync(pkg) {
  const out = [];
  checkSite(pkg, out);
  const parsedPages = {};
  for (const [file, text] of Object.entries(pkg.texts)) {
    if (!/\.xml$/i.test(file)) continue;
    const listed = pkg.site.pages.some(p => p.file === file);
    if (!listed) {
      const parts = file.split('/');
      if (parts.length > 1) {
        out.push(issue('info', file, `Colony version of ${parts.slice(1).join('/')}: shown on maps whose id or colony is "${parts[0]}".`));
        if (!pkg.site.pages.some(p => p.file === parts.slice(1).join('/'))) out.push(issue('warning', file, `There is no generic ${parts.slice(1).join('/')} page for this to replace.`));
      } else {
        out.push(issue('warning', file, `${file} is not listed in the site's pages, so it cannot be opened (the test still parses it).`));
      }
    }
    parsedPages[file] = checkPage(pkg, file, text, out);
  }

  for (const [file, text] of Object.entries(pkg.texts)) {
    if (/\.xml$/i.test(file) && /[^\x09\x0A\x20-\x7E -￿]/.test(text)) out.push(issue('warning', file, 'The page holds control characters.'));
  }

  for (const name of Object.keys(pkg.images)) {
    if (!/^[a-z0-9_.-]+\.png$/.test(name)) out.push(issue('warning', 'images', `Image name ${name}: use lowercase letters, digits, _ and - (resource paths are case sensitive).`));
    const entry = attributionFor(pkg, name);
    if (!entry) out.push(issue('error', 'attributions.yml', `${name} has no attributions.yml entry (licence, copyright, source).`));
    else {
      if (!entry.license) out.push(issue('error', 'attributions.yml', `${name} has no licence.`));
      if (!entry.copyright) out.push(issue('error', 'attributions.yml', `${name} has no copyright (who made it).`));
      if (!entry.source) out.push(issue('error', 'attributions.yml', `${name} has no source.`));
    }
  }
  for (const entry of pkg.attributions) {
    for (const file of entry.files) {
      if (!(file in pkg.images) && !(file in pkg.other)) out.push(issue('warning', 'attributions.yml', `attributions.yml lists ${file}, which is not in the package.`));
    }
  }
  for (const path of Object.keys(pkg.other)) {
    if (/\.design\.json$/i.test(path)) {
      out.push(issue('info', path, 'Banner Studio design file: kept in the package so the banner can be edited again; the game ignores it.'));
      continue;
    }
    if (/\.png$/i.test(path) && !path.includes('.rsi/') && !attributionFor(pkg, path)) {
      out.push(issue('warning', 'attributions.yml', `${path} has no attributions.yml entry.`));
    }
  }
  return { issues: out, parsedPages };
}

/** Collects every resource a page refers to: images, sprites, ads, wallpapers, background images. */
function references(pkg, parsedPages) {
  const refs = [];
  const add = (kind, file, line, value, extra = {}) => refs.push({ kind, file, line, value, ...extra });
  if (pkg.site.style.backgroundImage) add('image', SITE, null, pkg.site.style.backgroundImage);
  for (const [file, parsed] of Object.entries(parsedPages)) {
    if (!parsed) continue;
    const text = pkg.texts[file];
    for (const node of walk(parsed.controls)) {
      if (node.kind !== 'tag') continue;
      const line = lineCol(text, node.start).line;
      const a = node.args;
      if (node.name === 'CMUGuideImage' && a.Path) add('image', file, line, a.Path, { required: true });
      if (node.name === 'CMUNetStyle' && a.BackgroundImage) add('image', file, line, a.BackgroundImage);
      if (node.name === 'CMUNetPopup' && a.Icon) add('image', file, line, a.Icon);
      if (node.name === 'CMUNetSprite' && a.Rsi && a.State) add('sprite', file, line, a.Rsi, { state: a.State });
      if (node.name === 'CMUNetAd' && a.Id) add('ad', file, line, a.Id);
      if (node.name === 'CMUNetWallpaper' && a.Id) add('wallpaper', file, line, a.Id);
    }
  }
  return refs;
}

/**
 * Checks that need the repository: sprite paths and states, rooted images, ad and wallpaper ids, address clashes,
 * board poster jobs. Package (./) paths are checked locally.
 */
export async function validateAsync(pkg, parsedPages) {
  const out = [];
  let offline = false;
  const refs = references(pkg, parsedPages);

  await Promise.all(refs.map(async ref => {
    if (ref.kind === 'image') {
      if (ref.value.startsWith('./')) {
        const name = ref.value.slice(2);
        if (!(name in pkg.images) && !(name in pkg.other)) out.push(issue('error', ref.file, `${ref.value} is not in the package. Upload it under Images.`, ref.line));
        return;
      }
      if (!ref.value.startsWith('/')) {
        out.push(issue('error', ref.file, `Image path ${ref.value} must start with / (e.g. /Textures/...) or ./ for package files.`, ref.line));
        return;
      }
      const exists = await resourceExists(ref.value);
      if (exists === false) out.push(issue(ref.required ? 'error' : 'warning', ref.file, `${ref.value} does not exist in the repository.`, ref.line));
      if (exists === null) offline = true;
      return;
    }
    if (ref.kind === 'sprite') {
      try {
        const rsi = await loadRsi(ref.value);
        if (!rsi.states.has(ref.state)) {
          const names = [...rsi.states.keys()];
          out.push(issue('error', ref.file, `${rootedRsi(ref.value)} has no state "${ref.state}". It has: ${names.slice(0, 12).join(', ')}${names.length > 12 ? ', ...' : ''}.`, ref.line));
        }
      } catch (e) {
        if (ref.value.startsWith('./')) out.push(issue('error', ref.file, `${ref.value} is not in the package.`, ref.line));
        else if (/not found: (404|4\d\d)/.test(e.message)) out.push(issue('error', ref.file, `No RSI at ${rootedRsi(ref.value)} in the repository.`, ref.line));
        else offline = true;
      }
      return;
    }
    if (ref.kind === 'ad') {
      try {
        const ads = await deepAds();
        if (!ads.has(ref.value)) out.push(issue('error', ref.file, `No cmuDeepAd with id ${ref.value} (deep_ads.yml).`, ref.line));
      } catch {
        offline = true;
      }
      return;
    }
    if (ref.kind === 'wallpaper') {
      try {
        const all = await wallpapers();
        if (!all.has(ref.value)) out.push(issue('error', ref.file, `No cmuWallpaper with id ${ref.value} (wallpapers.yml).`, ref.line));
      } catch {
        offline = true;
      }
    }
  }));

  try {
    const addresses = await knownAddresses();
    const own = pkg.site.address.trim().toLowerCase();
    if (addresses.has(own)) out.push(issue('error', SITE, `The game's site ${addresses.get(own)} already uses the address ${own}.`));
  } catch {
    offline = true;
  }

  if (pkg.site.board && pkg.site.board.posters.length) {
    try {
      const jobs = new Set(await bundled('jobs.json'));
      for (const job of pkg.site.board.posters) {
        if (!jobs.has(job)) out.push(issue('warning', SITE, `Poster job ${job} is not a job id the editor knows (exact ids, e.g. AU14JobCivilianJournalist).`));
      }
    } catch {
      // the bundled list is optional
    }
  }

  if (offline) out.push(issue('info', 'repository', 'Some sprites, images or ids could not be checked: the repository could not be reached.'));
  return out;
}
