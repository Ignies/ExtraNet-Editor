// Banner Studio fonts. Each entry:
//   { id, name, family, weight, google, game, tones }
// family is the CSS family name; weight the weight the studio draws with; google the css2 "family=" value to
// load from fonts.googleapis.com (null for the game's own fonts); game the page font name the editor already
// loads from the repository (Sans, Display, Mono, Terminal, Pixel). Google fonts here are OFL: they only
// render the PNG, the game only ever gets the image. See README.md, "Banner Studio: adding art".

export const FONTS = [
  // The game's own page fonts, loaded from the repository's /Fonts.
  { id: 'game-sans', name: 'Noto Sans (game)', family: 'GameSans', weight: 700, google: null, game: 'Sans', tones: ['colony', 'corporate'] },
  { id: 'game-display', name: 'Noto Sans Display (game)', family: 'GameDisplay', weight: 700, google: null, game: 'Display', tones: ['corporate', 'tabloid'] },
  { id: 'game-mono', name: 'Roboto Mono (game)', family: 'GameMono', weight: 700, google: null, game: 'Mono', tones: ['terminal'] },
  { id: 'game-terminal', name: 'UAV OSD (game)', family: 'GameTerminal', weight: 400, google: null, game: 'Terminal', tones: ['terminal', 'military'] },
  { id: 'game-pixel', name: 'Cozette (game)', family: 'GamePixel', weight: 700, google: null, game: 'Pixel', tones: ['retro', 'terminal'] },

  // Google Fonts (SIL Open Font License).
  { id: 'press-start', name: 'Press Start 2P', family: 'Press Start 2P', weight: 400, google: 'Press+Start+2P', tones: ['retro', '80s'] },
  { id: 'vt323', name: 'VT323', family: 'VT323', weight: 400, google: 'VT323', tones: ['terminal', 'retro'] },
  { id: 'silkscreen', name: 'Silkscreen', family: 'Silkscreen', weight: 700, google: 'Silkscreen:wght@400;700', tones: ['retro'] },
  { id: 'orbitron', name: 'Orbitron', family: 'Orbitron', weight: 900, google: 'Orbitron:wght@400;700;900', tones: ['alien', 'corporate'] },
  { id: 'audiowide', name: 'Audiowide', family: 'Audiowide', weight: 400, google: 'Audiowide', tones: ['80s', 'sports'] },
  { id: 'bungee', name: 'Bungee', family: 'Bungee', weight: 400, google: 'Bungee', tones: ['tabloid', 'sports'] },
  { id: 'monoton', name: 'Monoton', family: 'Monoton', weight: 400, google: 'Monoton', tones: ['80s', 'neon'] },
  { id: 'righteous', name: 'Righteous', family: 'Righteous', weight: 400, google: 'Righteous', tones: ['80s'] },
  { id: 'russo-one', name: 'Russo One', family: 'Russo One', weight: 400, google: 'Russo+One', tones: ['military', 'sports'] },
  { id: 'black-ops', name: 'Black Ops One', family: 'Black Ops One', weight: 400, google: 'Black+Ops+One', tones: ['military'] },
  { id: 'share-tech-mono', name: 'Share Tech Mono', family: 'Share Tech Mono', weight: 400, google: 'Share+Tech+Mono', tones: ['terminal', 'alien'] },
  { id: 'major-mono', name: 'Major Mono Display', family: 'Major Mono Display', weight: 400, google: 'Major+Mono+Display', tones: ['alien', 'cult'] },
  { id: 'teko', name: 'Teko', family: 'Teko', weight: 600, google: 'Teko:wght@400;600;700', tones: ['sports', 'military'] },
  { id: 'bebas', name: 'Bebas Neue', family: 'Bebas Neue', weight: 400, google: 'Bebas+Neue', tones: ['tabloid', 'corporate'] },
  { id: 'anton', name: 'Anton', family: 'Anton', weight: 400, google: 'Anton', tones: ['tabloid', 'sports'] },
  { id: 'rubik-glitch', name: 'Rubik Glitch', family: 'Rubik Glitch', weight: 400, google: 'Rubik+Glitch', tones: ['cult', 'deep'] },
  { id: 'faster-one', name: 'Faster One', family: 'Faster One', weight: 400, google: 'Faster+One', tones: ['80s', 'sports'] },
  { id: 'wallpoet', name: 'Wallpoet', family: 'Wallpoet', weight: 400, google: 'Wallpoet', tones: ['military', 'deep'] },
  { id: 'michroma', name: 'Michroma', family: 'Michroma', weight: 400, google: 'Michroma', tones: ['corporate', 'alien'] },
  { id: 'oxanium', name: 'Oxanium', family: 'Oxanium', weight: 800, google: 'Oxanium:wght@400;800', tones: ['alien', 'colony'] },
  { id: 'courier-prime', name: 'Courier Prime', family: 'Courier Prime', weight: 700, google: 'Courier+Prime:wght@400;700', tones: ['typewriter', 'cult', 'colony'] },
  { id: 'creepster', name: 'Creepster', family: 'Creepster', weight: 400, google: 'Creepster', tones: ['cult'] },
  { id: 'pacifico', name: 'Pacifico', family: 'Pacifico', weight: 400, google: 'Pacifico', tones: ['80s', 'tabloid'] },
  { id: 'bangers', name: 'Bangers', family: 'Bangers', weight: 400, google: 'Bangers', tones: ['tabloid'] },
  { id: 'big-shoulders-stencil', name: 'Big Shoulders Stencil', family: 'Big Shoulders Stencil', weight: 800, google: 'Big+Shoulders+Stencil:wght@400;800', tones: ['military', 'colony'] },
  { id: 'nosifer', name: 'Nosifer', family: 'Nosifer', weight: 400, google: 'Nosifer', tones: ['horror', 'cult'] },
  { id: 'rubik-wet-paint', name: 'Rubik Wet Paint', family: 'Rubik Wet Paint', weight: 400, google: 'Rubik+Wet+Paint', tones: ['horror', 'deep'] },
  { id: 'caveat-brush', name: 'Caveat Brush', family: 'Caveat Brush', weight: 400, google: 'Caveat+Brush', tones: ['handwritten', 'cult', 'colony'] },
  { id: 'saira-stencil', name: 'Saira Stencil One', family: 'Saira Stencil One', weight: 400, google: 'Saira+Stencil+One', tones: ['military', 'industrial'] },
  { id: 'graduate', name: 'Graduate', family: 'Graduate', weight: 400, google: 'Graduate', tones: ['sports', 'varsity'] },
  { id: 'staatliches', name: 'Staatliches', family: 'Staatliches', weight: 400, google: 'Staatliches', tones: ['sports', 'corporate'] },
  { id: 'unifraktur', name: 'UnifrakturMaguntia', family: 'UnifrakturMaguntia', weight: 400, google: 'UnifrakturMaguntia', tones: ['newspaper', 'cult'] },
  { id: 'pixelify', name: 'Pixelify Sans', family: 'Pixelify Sans', weight: 700, google: 'Pixelify+Sans:wght@400;700', tones: ['retro', 'pixel'] },
  { id: 'sixtyfour', name: 'Sixtyfour', family: 'Sixtyfour', weight: 400, google: 'Sixtyfour', tones: ['retro', 'terminal'] },
];

export function getFont(id) {
  return FONTS.find(f => f.id === id) || FONTS[0];
}
