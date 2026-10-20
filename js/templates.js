// Starter layouts, modelled on the game's own sites (Bruises, FrontierLeaf, ColonyTattler, VexStarr, Children,
// MyBunk and VectorQuest). Each becomes ordinary blocks once picked. Sprites are ones those sites already use.

const doc = body => `<Document>\n${body.replace(/^\n/, '').replace(/\s+$/, '')}\n</Document>\n`;

export const TEMPLATES = [
  {
    id: 'blank',
    name: 'Blank page',
    blurb: 'A heading and a paragraph.',
    style: { background: '#0B1630', text: '#D8E6FF', heading: '#FFD24A', link: '#7FD3FF', font: 'Sans' },
    pages: [{ path: '', tab: 'Home', xml: doc(`
  # {colony} NEW SITE
  Write the page here. Drag blocks from the left onto the page.
`) }],
  },
  {
    id: 'forum',
    name: 'Forum or board',
    blurb: 'Rules, pinned threads and round postings under the front page.',
    style: { background: '#17110F', text: '#D8D0C6', heading: '#D9574A', link: '#8DB6DA', font: 'Sans' },
    board: { postLabel: 'Start a thread', empty: 'Nothing posted this shift.', posters: [], posterWhitelist: null, anyonePosts: true, showTerminals: true, bounties: false, leaks: false, hijackable: false, extra: null },
    pages: [
      { path: '', tab: 'Board', xml: doc(`
  <CMUNetMarquee Text="READ THE RULES  ///  BE KIND  ///  NO REAL NAMES  ///  KEEP A COPY OFF THE NETWORK" Speed="50" Color="#D9574A"/>
  # {colony} NIGHT SHIFT BOARD
  [italic]Where the night shift talks when the day shift is asleep.[/italic]

  Anyone at a colony terminal may post. Read the rules first. Be decent, keep it short, and do not post anyone's real name.

  ## PINNED
  - [netlink="Board rules" link="nightshift.colony/rules"] [color=#7A6F68]locked, written by the mods[/color]
  - [netlink="Lost and found" link="lostfound.colony"] [color=#7A6F68]for anything you picked up on shift[/color]

  ## RECENT THREADS
  - Who keeps leaving the canteen lights on? [color=#7A6F68]12 replies[/color]
  - Pump house hatch rattling again [color=#7A6F68]4 replies[/color]

  ## NEW POSTS
  [color=#7A6F68]Posts run below, newest last.[/color]
`) },
      { path: 'rules', tab: 'Rules', xml: doc(`
  # BOARD RULES
  - No real names, yours or anyone else's.
  - One thread per topic. Search before you post.
  - Nothing you would not say to the Marshal's face.

  [netlink="Back to the board" link="nightshift.colony"]
`) },
    ],
    address: 'nightshift.colony',
  },
  {
    id: 'shop',
    name: 'Shop or brand',
    blurb: 'A banner row of products, who we are, what we sell, and the store.',
    style: { background: '#EFE6D2', text: '#2B2416', heading: '#4E6E1A', link: '#8A3A12', font: 'Mono' },
    pages: [
      { path: '', tab: 'Home', xml: doc(`
  # FRONTIER GOODS COOPERATIVE
  [italic]Colony made, colony priced. Owned by the people who make it.[/italic]

  <Box>
    <CMUNetSprite Rsi="/Textures/Objects/Specific/Hydroponics/tobacco.rsi" State="stage-3" Scale="3"/>
    <CMUNetSprite Rsi="/Textures/Objects/Specific/Hydroponics/tobacco.rsi" State="harvest" Scale="3"/>
    <CMUNetSprite Rsi="/Textures/Objects/Specific/Hydroponics/tobacco.rsi" State="dried" Scale="3"/>
  </Box>

  ## WHO WE ARE
  A handful of workers on {colony} who were tired of paying freight on things we can make ourselves.

  ## WHAT WE BELIEVE
  - Colony made is better than freighted.
  - Every member gets one vote.
  - Profits go back to the makers.

  <CMUNetAd Id="CMUDeepAdMre"/>

  ## THE CO-OP
  - [netlink="The store" link="frontiergoods.coop/store"]

  [color=#7A6A4A]Prices in colony credits. No refunds on anything that has been in a vent.[/color]
`) },
      { path: 'store', tab: 'Store', xml: doc(`
  # THE STORE
  Open every shift change, behind the canteen.

  <Box HorizontalAlignment="Stretch" VerticalAlignment="Top">
    <Box Orientation="Vertical" HorizontalAlignment="Stretch" VerticalAlignment="Top" Margin="4">
      ## THIS WEEK
      - Cured leaf, by the pouch.
      - Rolling papers.
    </Box>
    <Box Orientation="Vertical" HorizontalAlignment="Stretch" VerticalAlignment="Top" Margin="4">
      ## HOURS
      Shift change, every shift. Closed during alerts.
    </Box>
  </Box>

  [netlink="Back home" link="frontiergoods.coop"]
`) },
    ],
    address: 'frontiergoods.coop',
  },
  {
    id: 'news',
    name: 'News',
    blurb: 'A ticker, a breaking line, the lead story and what else is inside.',
    style: { background: '#FFF1F6', text: '#1A1A1A', heading: '#D0105A', link: '#1440A0', font: 'Sans' },
    pages: [
      { path: '', tab: 'Front page', xml: doc(`
  <CMUNetMarquee Text="EXCLUSIVE  ///  YOUR HEADLINE HERE  ///  ANOTHER ONE  ///  WE SAW IT FIRST" Speed="95" Color="#D0105A"/>
  # THE {colony} GAZETTE
  <CMUNetBlink Rate="0.5">
    [color=#D0105A][bold]BREAKING: SOMETHING HAPPENED ON {colony}[/bold][/color]
  </CMUNetBlink>

  [italic]All the news that fits, from the landing pad to the lower levels.[/italic]

  <Box>
    <CMUNetSprite Rsi="/Textures/Objects/Devices/travel_camera.rsi" State="icon" Scale="3"/>
  </Box>

  ## THIS WEEK'S BIG ONE
  [bold]THE LEAD STORY.[/bold] Two or three sentences that tell the whole story. Who, what, where, and why anyone on the colony should care.

  ## ALSO INSIDE
  - [bold]Second story.[/bold] One line about it.
  - [bold]Third story.[/bold] One line about it.

  ## READ ON
  - [netlink="Letters to the editor" link="gazette.colony/letters"]
`) },
      { path: 'letters', tab: 'Letters', xml: doc(`
  # LETTERS
  [italic]Letters are edited for length and for anything the Marshal would not like.[/italic]

  [bold]To the editor,[/bold] the canteen coffee has got worse. Signed, a reader on the night shift.
`) },
    ],
    address: 'gazette.colony',
  },
  {
    id: 'fan',
    name: 'Celebrity fan page',
    blurb: 'A message from the star, latest news, numbers and links.',
    style: { background: '#1E0F1E', text: '#F5E6F0', heading: '#FF5FD2', link: '#FFD27A', font: 'Sans' },
    pages: [{ path: '', tab: 'Home', xml: doc(`
  <CMUNetMarquee Text="NEW SEASON CONFIRMED  ///  NOW ON HOLO ACROSS THE CORE AND THE OUTER VEIL  ///  FAN CLUB MEMBERSHIP OPEN" Speed="60" Color="#FF5FD2"/>
  # STAR NAME
  [italic]Official site of the star of the holo serials. Approved by the star, run by the fan club.[/italic]

  <CMUNetSprite Rsi="/Textures/_RMC14/Objects/Misc/Bouqets/rose.rsi" State="icon" Scale="3"/>

  ## A MESSAGE FROM THE STAR
  Hello, {colony}. I know the holo reels reach you weeks late. Thank you for staying up.

  ## LATEST NEWS
  - [bold]New season confirmed.[/bold] One line about it.
  - [bold]Charity gala.[/bold] One line about it.

  ## IN NUMBERS
  - [bold]9[/bold] seasons
  - [bold]3[/bold] awards

  <CMUNetPopup Title="FAN CLUB" Text="Join the fan club for signed holo stills." X="0.9" Y="0.1" Delay="2"/>
`) }],
    address: 'starname.holo',
  },
  {
    id: 'cult',
    name: 'Cult or deep forum',
    blurb: 'A deep web board: dark colours, a slow ticker, a blinking warning and pinned threads.',
    style: { background: '#0C0A0F', text: '#CBC3CF', heading: '#B98FD9', link: '#86D1A4', font: 'Sans' },
    deep: true,
    board: { postLabel: 'Speak softly', empty: 'The room is quiet tonight.', posters: [], posterWhitelist: null, anyonePosts: true, showTerminals: false, bounties: false, leaks: false, hijackable: false, extra: null },
    pages: [{ path: '', tab: 'The room', xml: doc(`
  <CMUNetMarquee Text="leave the door open  ///  you are not alone  ///  leave the door open" Speed="35" Color="#6E5A7E"/>
  <CMUNetSprite Rsi="/Textures/_RMC14/Structures/Xenos/xeno_egg.rsi" State="egg" Scale="3"/>
  # THE QUIET ROOM
  [italic]For those who saw something in the dark, and could not look away.[/italic]

  You found us because you looked. Sit down. The room is warm.

  <CMUNetBlink Rate="1.6">
    [color=#B98FD9][bold]YOU ARE NOT ALONE.[/bold][/color]
  </CMUNetBlink>

  ## WHAT WE BELIEVE
  - Everything we built, we built out of fear.
  - We do not open doors that are not ours to open.

  ## PINNED
  - [netlink="What we believe" link="quietroom.deep"] [color=#6E5A7E]locked[/color]

  ## NEW POSTS
  [color=#6E5A7E]Anyone may post. No places, no names.[/color]
`) }],
    address: 'quietroom.deep',
  },
  {
    id: 'retro',
    name: '80s retro page',
    blurb: 'A loud ticker, a row of sprites, a terminal font and a wallpaper to take home.',
    style: { background: '#0B0B05', text: '#9BE15D', heading: '#FF6600', link: '#FFE14D', font: 'Terminal' },
    pages: [{ path: '', tab: 'Home', xml: doc(`
  <CMUNetMarquee Text="WELCOME TO THE INFORMATION SUPERCORRIDOR  ///  1,204,377 COLONISTS AND COUNTING  ///  BEST VIEWED ON A SEEGSON TERMINAL" Speed="60" Color="#FF6600"/>
  <Box>
    <CMUNetSprite Rsi="/Textures/Effects/hearts.rsi" State="hearts" Scale="2"/>
    <CMUNetSprite Rsi="/Textures/_RMC14/Objects/Consumable/Drinks/coffee_cup.rsi" State="icon-3" Scale="2"/>
    <CMUNetSprite Rsi="/Textures/Objects/Fun/Instruments/guitar.rsi" State="icon" Scale="2"/>
  </Box>
  # RAD ZONE
  [italic]A place for friends on the night shift.[/italic]

  <CMUNetBlink Rate="0.5">
    [bold]*** YOU ARE VISITOR NUMBER 000451 ***[/bold]
  </CMUNetBlink>

  Welcome, {colony}. Sign the guestbook, pick your Top 8 and find out who has been reading your profile at three in the morning.

  ## COOL LINKS
  - [netlink="Surf somewhere random" link="net://random"]

  <CMUNetWallpaper Id="CMUWallpaperSynthwave"/>
`) }],
    address: 'radzone.net',
  },
];

export function templateById(id) {
  return TEMPLATES.find(t => t.id === id) || TEMPLATES[0];
}
