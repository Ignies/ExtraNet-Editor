// WeyBay's shop tag (<CMUNetShop Catalog="CMUWeyBayCatalog"/>), ported from CMUNetShop.cs: the balance of the card in
// the reader and its orders, tracked to the pickup, then the catalogue by heading: each item's picture, name, line,
// price and delivery time, with a BUY button that charges the card. Optional colours: Text, Accent, Muted, Panel.
//
// What the server does (CMUShopSystem) is done here in the browser: a purchase comes out of the emulator's wallet
// (wallet.js, the sportsbook's), the order is kept in this browser and moves from being packed to the freight run
// to waiting at the pickup in real time, and WeyBay's mails land in the terminal's inbox. In game the parcel is a
// real crate on the pickup pallet; here it only says where it would be. The catalogue is the game's shop.yml, and
// the pictures are the items' sprites (data/shop_items.json, from the snapshot).

import { el } from '../util.js';
import { hexColour } from '../markup.js';
import { bundled } from '../repo.js';
import { spriteCanvas } from '../sprites.js';
import { L, prototypes } from './data.js';
import { readBalance, writeBalance } from './wallet.js';

/** The English strings, for a repository whose locale does not have them yet. */
const FALLBACK = {
  'cmu-shop-category-misc': 'EVERYTHING ELSE',
  'cmu-shop-buy': 'BUY',
  'cmu-shop-price': '${ $price }  -  arrives in about { $minutes } min',
  'cmu-shop-balance': 'Card in the reader: ${ $balance }',
  'cmu-shop-balance-none': 'Put your ID card in the reader to shop.',
  'cmu-shop-your-orders': 'YOUR ORDERS',
  'cmu-shop-no-orders': 'No orders yet.',
  'cmu-shop-order-line': '#{ $id } { $item }: { $status }',
  'cmu-shop-order-processing': 'being packed, about { $minutes } min',
  'cmu-shop-order-transit': 'on the freight run, about { $minutes } min',
  'cmu-shop-order-arrived': 'waiting at { $where }',
  'cmu-shop-no-card': 'WeyBay needs an ID card in the reader.',
  'cmu-shop-no-funds': 'Not enough on the card.',
  'cmu-shop-too-many': 'You already have { $count } orders on the way.',
  'cmu-shop-bought': 'Ordered: { $item }.',
  'cmu-shop-mail-from': 'WeyBay',
  'cmu-shop-mail-paid-subject': 'Order confirmed: { $item }',
  'cmu-shop-mail-paid-body': 'Thanks for shopping with WeyBay. { $item } is paid for (${ $price }) and on its way, in about { $minutes } min. We will mail you when it lands.',
  'cmu-shop-mail-arrived-subject': 'Your { $item } has arrived',
  'cmu-shop-mail-arrived-body': 'Your { $item } is waiting on the WeyBay pickup pallet at { $where }, in a crate with your name on it. Please collect it soon.',
};

/** CMUShopLimits.OpenOrders: orders an account can have on their way at once. */
const OPEN_ORDERS = 5;
/** The page asks again this often while it is up, so orders move along on their own. */
const REFRESH = 5000;
/** Where the emulator's pickup pallet stands: the area the shop's pages send people to. */
const PICKUP_AREA = 'Logistics';
const ORDERS_KEY = 'extranet-emulator-shop-orders';
/** WeyBay's mail, kept for the inbox of whoever it was sent to. */
export const MAIL_KEY = 'extranet-emulator-shop-mail';

const STYLE_ID = 'emu-shop-style';
const STYLE = `
.emu-shop { display: flex; flex-direction: column; gap: 6px; margin: 6px 0; min-width: 0; }
.emu-shop-list { display: flex; flex-direction: column; min-width: 0; }
.emu-shop-orders { gap: 2px; }
.emu-shop-catalogue { gap: 4px; }
.emu-shop-label { white-space: pre; overflow: hidden; min-width: 0; }
.emu-shop-heading { margin-top: 6px; }
.emu-shop-item { display: flex; flex-direction: row; gap: 8px; padding: 4px 6px; min-width: 0; }
.emu-shop-picture { flex: none; width: 48px; height: 48px; display: grid; place-items: center; }
.emu-shop-picture > canvas { grid-area: 1 / 1; image-rendering: pixelated; }
.emu-shop-words { flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0; }
.emu-shop-buy { flex: none; align-self: center; border: 0; padding: 3px 10px; font: inherit; color: #FFFFFF; cursor: pointer; white-space: pre; }
.emu-shop-buy:hover { filter: brightness(1.12); }
`;

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  document.head.append(el('style', { id: STYLE_ID, text: STYLE }));
}

function say(strings, id, vars) {
  return L(strings[id] === undefined ? FALLBACK : strings, id, vars);
}

/** Color.TryFromHex, else the default. */
function colour(args, key, fallback) {
  return hexColour(args[key]) ? args[key] : fallback;
}

let catalogs = null;

/** Every cmuShopCatalog, by id. */
function loadCatalogs() {
  if (!catalogs) {
    catalogs = prototypes('shop.yml', 'cmuShopCatalog').then(list => new Map(list.map(c => [c.id, c])));
    catalogs.catch(() => {
      catalogs = null;
    });
  }
  return catalogs;
}

// ---------------------------------------------------------------- the orders the server keeps

let memory = { next: 1, orders: [] };

function readOrders() {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    if (raw === null) return { next: 1, orders: [] };
    const value = JSON.parse(raw);
    return { next: Number(value?.next) || 1, orders: Array.isArray(value?.orders) ? value.orders : [] };
  } catch {
    return memory;
  }
}

function writeOrders(value) {
  memory = value;
  try {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(value));
  } catch {
    // kept in memory
  }
}

/** Whether any order is on its way, so the emulator knows to keep checking. */
export function ordersPending() {
  try {
    return localStorage.getItem(ORDERS_KEY) !== null && readOrders().orders.some(o => o.state !== 'arrived');
  } catch {
    return false;
  }
}

/** Keeps a mail for its recipient's inbox, and hands it to the open session. */
function sendMail(mail, ctx) {
  try {
    const all = JSON.parse(localStorage.getItem(MAIL_KEY) || '[]');
    all.unshift(mail);
    localStorage.setItem(MAIL_KEY, JSON.stringify(all.slice(0, 50)));
  } catch {
    // only the open session gets it
  }
  if (ctx.mail) ctx.mail(mail);
}

/**
 * CMUShopSystem.Update: an order halfway there is on the freight run; one that is due arrives, at the pickup, and
 * its buyer is mailed. ctx: { strings, mail(mail), time() }. Returns whether anything changed.
 */
export async function deliverDue(ctx = {}) {
  const items = await bundled('shop_items.json').catch(() => ({}));
  // read, moved on and written back in one go, so two callers never deliver an order twice
  const state = readOrders();
  const now = Date.now();
  let changed = false;
  for (const order of state.orders) {
    if (order.state === 'arrived') continue;
    if (now >= order.due) {
      const strings = ctx.strings || {};
      const name = items[order.item]?.name || order.item;
      order.state = 'arrived';
      order.where = PICKUP_AREA;
      sendMail({
        from: say(strings, 'cmu-shop-mail-from'),
        to: order.buyer,
        subject: say(strings, 'cmu-shop-mail-arrived-subject', { item: name }),
        body: say(strings, 'cmu-shop-mail-arrived-body', { item: name, where: order.where }),
        time: ctx.time ? ctx.time() : '',
      }, ctx);
      changed = true;
    } else if (now >= order.ordered + (order.due - order.ordered) / 2 && order.state !== 'transit') {
      order.state = 'transit';
      changed = true;
    }
  }
  if (changed) writeOrders(state);
  return changed;
}

// ---------------------------------------------------------------- the tag

/** The item's sprite layers, drawn as EntityPrototypeView draws them: 48 by 48, at 1.5. */
function picture(info) {
  const box = el('span.emu-shop-picture');
  for (const layer of info?.layers || []) {
    const slot = el('span');
    box.append(slot);
    spriteCanvas(layer.rsi, layer.state, 1.5).then(canvas => slot.replaceWith(canvas)).catch(() => slot.remove());
  }
  return box;
}

/**
 * The tag. args: its attributes. style: the page style. ctx: { strings, session() -> { account, buyer } | null,
 * mail(mail), popup(text, caution), time() }. session is who the card in the reader belongs to; a guest, or a
 * terminal with no card, has none. Resolves to null when the catalogue is unknown, as TryParseTag fails.
 */
export async function createShop(args = {}, style = {}, ctx = {}) {
  injectStyle();
  const strings = ctx.strings || {};
  const t = (id, vars) => say(strings, id, vars);
  const [all, items] = await Promise.all([loadCatalogs(), bundled('shop_items.json').catch(() => ({}))]);
  const catalog = args.Catalog !== undefined ? all.get(args.Catalog) : null;
  if (!catalog) return null;
  const entries = Array.isArray(catalog.entries) ? catalog.entries : [];

  const text = colour(args, 'Text', '#1C1C1C');
  const accent = colour(args, 'Accent', '#D4342C');
  const muted = colour(args, 'Muted', '#6A6A6A');
  const panel = colour(args, 'Panel', '#F2EEE4');

  const label = (value, colourValue, extra = '') => {
    const node = el(`div.emu-shop-label${extra}`, { text: value });
    node.style.color = colourValue;
    return node;
  };
  const heading = value => label(value, accent, '.emu-shop-heading');
  const nameOf = id => items[id]?.name || id;

  const balance = label('', text);
  const orders = el('div.emu-shop-list.emu-shop-orders');
  const catalogue = el('div.emu-shop-list.emu-shop-catalogue');
  const root = el('div.emu-shop', {}, balance, heading(t('cmu-shop-your-orders')), orders, catalogue);

  // BuildCatalogue: a heading per category, in the order they first come, then each item in its panel
  const groups = new Map();
  entries.forEach((entry, index) => {
    const category = entry.category || 'cmu-shop-category-misc';
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push([entry, index]);
  });
  for (const [category, group] of groups) {
    catalogue.append(heading(t(category)));
    for (const [entry, index] of group) {
      const info = items[entry.item];
      const buy = el('button.emu-shop-buy', { type: 'button', text: t('cmu-shop-buy') });
      buy.style.background = accent;
      buy.addEventListener('click', () => order(index));
      const blurb = entry.blurb ? t(entry.blurb) : (info?.description || '');
      const minutes = Math.ceil(Number(entry.minutes ?? 5));
      const words = el('div.emu-shop-words', {},
        label(nameOf(entry.item), text),
        label(blurb, muted),
        label(t('cmu-shop-price', { price: Number(entry.price) || 0, minutes }), accent));
      const row = el('div.emu-shop-item', {}, picture(info), words, buy);
      row.style.background = panel;
      catalogue.append(row);
    }
  }

  /** CMUShopSystem.SendState: the card's balance, or none, and the account's last ten orders. */
  const show = () => {
    const session = ctx.session ? ctx.session() : null;
    balance.textContent = session ? t('cmu-shop-balance', { balance: readBalance() }) : t('cmu-shop-balance-none');
    const mine = session ? readOrders().orders.filter(o => o.buyer === session.buyer).sort((a, b) => b.id - a.id).slice(0, 10) : [];
    orders.replaceChildren();
    if (!mine.length) {
      orders.append(label(t('cmu-shop-no-orders'), muted));
      return;
    }
    const now = Date.now();
    for (const o of mine) {
      const minutes = Math.max(0, Math.ceil((o.due - now) / 60000));
      const status = o.state === 'arrived'
        ? t('cmu-shop-order-arrived', { where: o.where })
        : o.state === 'transit' ? t('cmu-shop-order-transit', { minutes }) : t('cmu-shop-order-processing', { minutes });
      orders.append(label(t('cmu-shop-order-line', { id: o.id, item: nameOf(o.item), status }), o.state === 'arrived' ? accent : text));
    }
  };

  const popup = (value, caution = false) => ctx.popup && ctx.popup(value, caution);

  /** CMUShopSystem.OnBuy: needs a card, room for another order and the money, then charges it and mails. */
  function order(index) {
    const entry = entries[index];
    const session = ctx.session ? ctx.session() : null;
    if (!entry) return;
    if (!session) {
      popup(t('cmu-shop-no-card'), true);
      return;
    }
    const state = readOrders();
    if (state.orders.filter(o => o.buyer === session.buyer && o.state !== 'arrived').length >= OPEN_ORDERS) {
      popup(t('cmu-shop-too-many', { count: OPEN_ORDERS }), true);
      return;
    }
    const price = Number(entry.price) || 0;
    const money = readBalance();
    if (money < price) {
      popup(t('cmu-shop-no-funds'), true);
      return;
    }
    writeBalance(money - price);
    const now = Date.now();
    const minutes = Number(entry.minutes ?? 5);
    state.orders.push({ id: state.next++, buyer: session.buyer, item: entry.item, ordered: now, due: now + minutes * 60000, state: 'processing', where: '' });
    writeOrders(state);
    const name = nameOf(entry.item);
    sendMail({
      from: t('cmu-shop-mail-from'),
      to: session.buyer,
      subject: t('cmu-shop-mail-paid-subject', { item: name }),
      body: t('cmu-shop-mail-paid-body', { item: name, price, minutes: Math.ceil(minutes) }),
      time: ctx.time ? ctx.time() : '',
    }, ctx);
    popup(t('cmu-shop-bought', { item: name }));
    show();
  }

  // EnteredTree asks for the state; FrameUpdate asks again every few seconds while the page is up
  show();
  const created = Date.now();
  const timer = setInterval(() => {
    // left the page, or never placed on one
    if (!root.isConnected && (root.dataset.seen || Date.now() - created > 60000)) {
      clearInterval(timer);
      return;
    }
    if (root.isConnected) root.dataset.seen = '1';
    deliverDue(ctx).finally(show);
  }, REFRESH);
  return root;
}
