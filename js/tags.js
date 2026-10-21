// Attribute rules of each document tag, taken from their TryParseTag methods. "error" means the game shows a
// parser error box instead of the tag (and CMUExtraNetTest fails); "warning" means the game quietly ignores or
// falls back on the value.

import { hexColour, parseFloatInvariant, enumValue, FONTS, BACKGROUND_MODES, H_ALIGN, V_ALIGN } from './markup.js';
import { ARCADE_GAMES } from './blocks.js';

const PLACEHOLDER_TAGS = new Set([
  'CMUNetRecipes', 'CMUNetArcade', 'CMUNetSportsbook', 'CMUNetSpaceGpt', 'CMUNetMarket', 'CMUNetCmbPanel',
  'CMUNetSearch', 'CMUNetTape', 'CMUGuideZoomImage', 'CMUGuideOutfitEmbed', 'CommandButton', 'GuideEntityEmbed', 'GuideLawsetEmbed',
  'GuideLawsetListEmbed', 'GuideMicrowaveEmbed', 'GuideMicrowaveGroupEmbed', 'GuideReagentEmbed',
  'GuideReagentGroupEmbed', 'GuideTechDisciplineEmbed', 'GuideTechnologyEmbed',
]);

export function isPlaceholderTag(name) {
  return PLACEHOLDER_TAGS.has(name);
}

/** Attributes each tag reads. Others are ignored by the game (CMUNetStyle rejects them). */
const KNOWN_ATTRIBUTES = {
  Document: [],
  Box: ['Margin', 'Orientation', 'HorizontalAlignment', 'VerticalAlignment'],
  ColorBox: ['Margin', 'HorizontalAlignment', 'VerticalAlignment', 'Color', 'OutlineThickness', 'OutlineColor'],
  Table: ['Columns'],
  CMUGuideImage: ['Path', 'MaxHeight'],
  CMUNetStyle: ['Background', 'Text', 'Heading', 'Link', 'Font', 'BackgroundImage', 'BackgroundMode'],
  CMUNetSprite: ['Rsi', 'State', 'Scale', 'Align'],
  CMUNetBlink: ['Rate'],
  CMUNetMarquee: ['Text', 'Speed', 'Color'],
  CMUNetPopup: ['Title', 'Text', 'Link', 'LinkText', 'Icon', 'X', 'Y', 'Delay', 'Background', 'Accent'],
  CMUNetAd: ['Id', 'Flip'],
  CMUNetWallpaper: ['Id'],
  CMUNetArcade: ['Game'],
  CMUNetSportsbook: [],
  CMUNetSearch: ['Text', 'Link', 'Background', 'Muted'],
  CMUNetTape: ['Shelf', 'Live'],
};

const csharpFloat = value => parseFloatInvariant(value) !== null;

/** Checks a tag's attributes. Returns { errors: [], warnings: [] }. */
export function checkTag(node) {
  const a = node.args;
  const errors = [];
  const warnings = [];
  const has = key => Object.prototype.hasOwnProperty.call(a, key);
  const needs = key => {
    if (!has(key)) errors.push(`<${node.name}> needs ${key}="..."`);
  };
  const float = (key, level = errors) => {
    if (has(key) && !csharpFloat(a[key])) level.push(`${key}="${a[key]}" in <${node.name}> is not a number (use a dot for decimals)`);
  };
  const colour = (key, level = errors) => {
    if (has(key) && !hexColour(a[key])) level.push(`${key}="${a[key]}" in <${node.name}> is not a colour like #FFD24A`);
  };
  const oneOf = (key, names, level = errors) => {
    if (has(key) && !enumValue(a[key], names)) level.push(`${key}="${a[key]}" in <${node.name}> must be one of ${names.join(', ')}`);
  };

  const known = KNOWN_ATTRIBUTES[node.name];
  if (known && node.name !== 'CMUNetStyle') {
    for (const key of Object.keys(a)) {
      if (!known.includes(key)) warnings.push(`<${node.name}> ignores ${key}=; it reads ${known.length ? known.join(', ') : 'no attributes'}`);
    }
  }

  switch (node.name) {
    case 'Document':
      break;
    case 'CMUNetStyle':
      for (const key of Object.keys(a)) {
        if (['Background', 'Text', 'Heading', 'Link'].includes(key)) colour(key);
        else if (key === 'Font') oneOf(key, FONTS);
        else if (key === 'BackgroundMode') oneOf(key, BACKGROUND_MODES);
        else if (key !== 'BackgroundImage') errors.push(`<CMUNetStyle> does not take ${key}=; it takes ${KNOWN_ATTRIBUTES.CMUNetStyle.join(', ')}`);
      }
      break;
    case 'CMUNetSprite':
      needs('Rsi');
      needs('State');
      float('Scale');
      if (has('Rsi') && !/\.rsi\/?$/.test(a.Rsi)) errors.push(`Rsi="${a.Rsi}" must be a .rsi folder`);
      oneOf('Align', H_ALIGN, warnings);
      break;
    case 'CMUNetBlink':
      float('Rate');
      break;
    case 'CMUNetMarquee':
      needs('Text');
      float('Speed');
      colour('Color');
      break;
    case 'CMUNetPopup':
      needs('Title');
      needs('Text');
      for (const key of ['X', 'Y', 'Delay']) float(key, warnings);
      colour('Background', warnings);
      colour('Accent', warnings);
      break;
    case 'CMUNetAd':
      needs('Id');
      if (has('Flip') && !/^(true|false)$/i.test(a.Flip.trim())) warnings.push(`Flip="${a.Flip}" in <CMUNetAd> should be true or false`);
      break;
    case 'CMUNetWallpaper':
      needs('Id');
      break;
    case 'CMUNetArcade':
      // no Game puts every cabinet in tabs; a Game the enum does not know fails TryParseTag
      oneOf('Game', ARCADE_GAMES);
      break;
    case 'CMUNetSearch':
      // Color.TryFromHex: a colour it cannot read falls back on the tag's default
      for (const key of ['Text', 'Link', 'Background', 'Muted']) colour(key, warnings);
      break;
    case 'CMUNetTape':
      // int.TryParse, clamped to 0..12; anything but "false" keeps the live list
      if (has('Shelf') && !/^\s*[-+]?\d+\s*$/.test(a.Shelf)) warnings.push(`Shelf="${a.Shelf}" in <CMUNetTape> is not a whole number and is ignored (6 tapes)`);
      else if (has('Shelf') && (parseInt(a.Shelf, 10) < 0 || parseInt(a.Shelf, 10) > 12)) warnings.push(`Shelf="${a.Shelf}" in <CMUNetTape> is kept between 0 and 12`);
      if (has('Live') && !/^(true|false)$/i.test(a.Live)) warnings.push(`Live="${a.Live}" in <CMUNetTape> should be true or false; only false hides the live list`);
      break;
    case 'CMUGuideImage':
      needs('Path');
      if (has('MaxHeight') && !(parseFloatInvariant(a.MaxHeight) > 0)) warnings.push(`MaxHeight="${a.MaxHeight}" in <CMUGuideImage> is not a positive number and is ignored`);
      if (has('Path') && !/\.png$/i.test(a.Path)) warnings.push(`Path="${a.Path}" in <CMUGuideImage> should be a .png`);
      break;
    case 'Box':
      float('Margin');
      oneOf('Orientation', ['Horizontal', 'Vertical']);
      oneOf('HorizontalAlignment', H_ALIGN);
      oneOf('VerticalAlignment', V_ALIGN);
      break;
    case 'ColorBox':
      float('Margin');
      colour('Color');
      float('OutlineThickness');
      colour('OutlineColor');
      oneOf('HorizontalAlignment', H_ALIGN);
      oneOf('VerticalAlignment', V_ALIGN);
      break;
    case 'Table':
      if (!has('Columns') || !/^\s*[-+]?\d+\s*$/.test(a.Columns)) errors.push('<Table> needs Columns="2" (a whole number)');
      break;
    default:
      break;
  }

  if (node.children.length && ['CMUNetStyle', 'CMUNetSprite', 'CMUNetMarquee', 'CMUNetPopup', 'CMUNetAd', 'CMUGuideImage', 'CMUNetWallpaper', 'CMUNetSearch', 'CMUNetTape'].includes(node.name)) {
    warnings.push(`<${node.name}> is meant to be self closing (<${node.name} .../>); its children are added as controls inside it`);
  }
  return { errors, warnings };
}

/** The page style a CMUNetStyle tag sets, or null when the game would reject the tag. */
export function styleFromTag(node) {
  if (checkTag(node).errors.length) return null;
  const a = node.args;
  const out = {};
  if (a.Background) out.background = a.Background;
  if (a.Text) out.text = a.Text;
  if (a.Heading) out.heading = a.Heading;
  if (a.Link) out.link = a.Link;
  if (a.Font) out.font = a.Font;
  if (a.BackgroundImage) out.backgroundImage = a.BackgroundImage;
  if (a.BackgroundMode) out.backgroundMode = a.BackgroundMode;
  return out;
}
