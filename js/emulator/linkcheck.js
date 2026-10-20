// The link sweep: loads every page of every site (colony versions too) and resolves every link on it through the
// emulator's resolver, from the browser the page opens in (The deeps.exi for deep sites). Run it with ?linkcheck
// in the address, or extranetEditor.linkCheck() from the console. It reports links that go nowhere, links whose
// page is missing, and "./" files that are not there.

import { parseDocument, walk, netlinks, isCamera } from '../markup.js';
import { snapshotInfo } from '../repo.js';
import { loadIndex } from '../library.js';
import { gameData, theme as makeTheme } from './data.js';
import { Network, DEEP } from './net.js';

const ALL_NETWORKS = ['CMUNetPublic', 'CMUNetSeegson', 'CMUNetWeylandYutani', 'CMUNetUSCM', 'CMUNetCMB', DEEP];

/** Every link of a page: netlinks in text, pop up links, and resource paths starting "./". */
function pageLinks(text) {
  const parsed = parseDocument(text);
  if (parsed.error) return { error: parsed.error.message, links: [], local: [] };
  const links = [];
  const local = [];
  for (const node of walk(parsed.controls)) {
    if (node.kind === 'tag') {
      if (node.name === 'CMUNetPopup' && node.args.Link) links.push({ link: node.args.Link, from: 'popup' });
      for (const key of ['Path', 'BackgroundImage', 'Icon', 'Rsi']) {
        const value = node.args[key];
        if (value && value.startsWith('./')) local.push(value);
      }
      continue;
    }
    if (node.kind === 'text') for (const l of netlinks(node)) if (l.link) links.push({ link: l.link, from: 'netlink' });
  }
  return { error: null, links, local };
}

/**
 * Runs the sweep. Returns { pages, links, failures: [{ site, file, link, from, result, address }], parseErrors }.
 * The computer reaches every network and has unlocked every hidden site, as the game's own link test resolves
 * links without an access check.
 */
export async function linkCheck({ extraSites = () => [] } = {}) {
  const [data, entries, snapshot] = await Promise.all([gameData(), loadIndex(), snapshotInfo()]);
  const os = { ...data.systems[0], networks: ALL_NETWORKS, namedAfterColony: false };
  const theme = makeTheme(os, data.strings, null);
  const colony = data.colonies.find(c => c.id === 'StableGarrison') || data.colonies[0];
  const net = new Network(entries, theme, colony, data.strings, { deep: true, extraSites });
  net.state = { discovered: [], unlocked: net.sites().filter(e => e.hidden).map(e => e.key) };
  net.save = () => {};
  const report = { pages: 0, links: 0, failures: [], parseErrors: [], hiddenLinks: [] };
  for (const entry of net.sites()) {
    const deeps = entry.networks.includes(DEEP);
    const files = entry.files.filter(f => /\.xml$/i.test(f));
    for (const page of entry.site.pages) {
      const file = page.file.replace(/^\.\//, '');
      if (!files.includes(file)) report.failures.push({ site: entry.address, file, link: `(page "${page.path}")`, from: 'site', result: 'missing file' });
    }
    for (const tab of entry.site.tabs) {
      const want = (tab.path || '').trim().replace(/^\/+|\/+$/g, '').toLowerCase();
      if (!entry.site.pages.some(p => p.path.trim().replace(/^\/+|\/+$/g, '').toLowerCase() === want)) {
        report.failures.push({ site: entry.address, file: 'tabs', link: `(tab "${tab.title}" to "${tab.path || ''}")`, from: 'tab', result: 'no such page' });
      }
    }
    for (const file of files) {
      const text = await net.rawText(entry, file);
      if (text === null) continue;
      report.pages++;
      const { error, links, local } = pageLinks(text);
      if (error) {
        report.parseErrors.push({ site: entry.address, file, error });
        continue;
      }
      for (const path of local) {
        report.links++;
        const repoPath = entry.repoDir ? entry.repoDir + path.slice(2) : null;
        const ok = entry.kind === 'user' ? entry.pkg && (path.slice(2) in entry.pkg.images || path.slice(2) in entry.pkg.other) : snapshot.files.size === 0 || snapshot.files.has(repoPath) || [...snapshot.files].some(f => f.startsWith(repoPath + '/'));
        if (!ok) report.failures.push({ site: entry.address, file, link: path, from: 'local file', result: 'missing file' });
      }
      for (const { link, from } of links) {
        report.links++;
        const lower = link.trim().toLowerCase();
        if (isCamera(lower)) {
          if (!deeps) report.failures.push({ site: entry.address, file, link, from, result: 'camera link outside the deep web' });
          continue;
        }
        if (lower === 'net://random' || lower.startsWith('sys://')) continue;
        const result = net.resolve(link, deeps, true);
        if (result.kind === 'page' || result.kind === 'ad' || result.kind === 'directory' || result.kind === 'deephome' || result.kind === 'denied') {
          if (result.kind === 'page' && result.entry.hidden && result.entry.key !== entry.key) report.hiddenLinks.push({ site: entry.address, file, link });
          continue;
        }
        report.failures.push({ site: entry.address, file, link, from, result: result.kind, address: result.address });
      }
    }
  }
  return report;
}

/** The report as text, grouped by site. */
export function formatReport(report) {
  const lines = [`${report.pages} pages, ${report.links} links and files checked, ${report.failures.length} broken, ${report.parseErrors.length} pages that do not parse.`];
  let site = null;
  for (const f of report.failures) {
    if (f.site !== site) {
      site = f.site;
      lines.push('', site);
    }
    lines.push(`  ${f.file}: ${f.link} (${f.from}) -> ${f.result}${f.address ? ` at ${f.address}` : ''}`);
  }
  for (const p of report.parseErrors) lines.push(`PARSE ${p.site} ${p.file}: ${p.error}`);
  if (report.hiddenLinks.length) {
    lines.push('', `${report.hiddenLinks.length} links lead into another hidden site (they open only once this computer has unlocked it through the ad maze, as in game):`);
    for (const h of report.hiddenLinks) lines.push(`  ${h.site} ${h.file}: ${h.link}`);
  }
  return lines.join('\n');
}
