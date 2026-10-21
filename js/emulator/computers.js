// The machines a colony has, and the casing each is built in. The game decides the casing per computer:
// CMUPersonalComputerComponent.Casing when the computer sets one (the law enforcers' desks in computers.yml), else
// its OS's own (CMUComputerOsPrototype.Casing: Seegson beige by default, Weyland-Yutani gunmetal, Marshals navy).
// CMUPersonalComputerWindow.Boot: "The computer's own casing beats its OS's." A bridged console (bridge.yml,
// CMUComputerBridgeServerSystem) runs the PC OS with its own window as a program, found by name, and keeps no
// guests; its OS comes from the first match up its parents in the bridge's os list, else the colony's.
//
// The faction casings and the laptop are drawn and ready, but no computer in game is built in them yet (the laptop
// only in CMUComputerFeaturesTest); the emulator's Casing list puts any machine in any of them. Likewise the
// Tactical, Ministry, Clinical and Police shells have no OS yet: PREVIEW_SYSTEMS are emulator-only OSes, one per
// faction whose icons and logo the game ships, so each shell can be seen. Their names and lines are written here,
// not the game's.

/** CMUComputerCasing, in the game's order: every casing with art in Textures/CMU14/PersonalComputers/Machine/. */
export const CASINGS = [
  ['Seegson', 'Seegson beige'],
  ['Weyland', 'Weyland-Yutani gunmetal'],
  ['Cmb', 'Colonial Marshal Bureau navy'],
  ['Security', 'Colony security grey'],
  ['Rangers', 'CWPS rangers green'],
  ['Nspa', 'NSPA black'],
  ['Upp', 'UPP olive'],
  ['Uscm', 'USCM gunmetal'],
  ['Twe', 'Three World Empire red'],
  ['Iasf', 'IASF aerospace grey'],
  ['Hyperdyne', 'Hyperdyne clinical white'],
  ['Prodigy', 'Prodigy gloss black'],
  ['Kelland', 'Kelland Mining steel'],
  ['Lasalle', 'LaSalle Bionational teal'],
  ['Laptop', 'Laptop'],
];

/** CMUComputerPrinting.CanPrint: desk machines have a printer; laptops do not. */
export function canPrint(casing) {
  return String(casing || '').toLowerCase() !== 'laptop';
}

const SEC = ['CMUNetPublic', 'CMUNetSecurity'];

/**
 * The computers and bridged consoles, from computers.yml, prop_computers.yml, surveillance_camera.yml and the
 * consoles bridge.yml picks up. os: the computer's OS (null keeps the OS picked in the bar); casing: its own casing
 * (null: the OS's); networks: its own list, replacing the OS's (a bridged console's extra networks go on top of
 * its OS's); home: its own home page; guests: false where the computer turns guests off; apps: its console
 * programs, each a window of its own named after the console.
 */
export const MACHINES = [
  { id: 'RMCPersonalDesktop', name: 'personal desktop', group: 'desk', os: null },
  { id: 'CMUPersonalDesktopWeyland', name: 'corporate desktop', group: 'desk', os: 'CMUOsWeyland' },
  { id: 'CMUPersonalDesktopMarshal', name: "marshal's desktop", group: 'desk', os: 'CMUOsCMB', casing: 'Cmb' },
  { id: 'CMUPersonalDesktopSecurity', name: 'security desktop', group: 'desk', os: 'CMUOsSeegson', casing: 'Security', home: 'security.seegson.net', guests: false, networks: SEC },
  { id: 'CMUPersonalDesktopRangers', name: 'ranger station desktop', group: 'desk', os: 'CMUOsSeegson', casing: 'Rangers', guests: false },
  { id: 'CMUPersonalDesktopNSPA', name: 'NSPA desktop', group: 'desk', os: 'CMUOsSeegson', casing: 'Nspa', guests: false },
  { id: 'Laptop', name: 'laptop', group: 'desk', os: null, casing: 'Laptop', note: 'the laptop casing; no laptop item runs the OS yet' },
  // Bridged consoles: the PC OS with the console's own window as a program, no guests.
  { id: 'CMUMonitorCameraColonyCMB', name: 'colony security cameras', group: 'console', os: 'CMUOsCMB', guests: false, apps: [{ kind: 'cameras', network: 'CMB' }], note: 'the Marshals\' bureau terminal; its camera window is a program on it' },
  { id: 'CMUMonitorCameraColonyGovfor', name: 'colony security cameras', suffix: 'Govfor', group: 'console', os: 'CMUOsSeegson', guests: false, extraNetworks: ['CMUNetSecurity'], apps: [{ kind: 'cameras', network: 'GOVFOR' }] },
  { id: 'CMUMonitorCameraColonyWEYU', name: 'colony security cameras', suffix: 'We-Yu', group: 'console', os: 'CMUOsWeyland', guests: false, apps: [{ kind: 'cameras', network: 'WEYU' }] },
  { id: 'AUDepartmentConsoleSecurity', name: 'Security Department Console', group: 'console', os: 'CMUOsSeegson', guests: false, extraNetworks: ['CMUNetSecurity'], apps: [{ kind: 'department', department: 'Security' }] },
  { id: 'AU14CorporateConsoleBase', name: 'corporate affairs console', group: 'console', os: 'CMUOsWeyland', guests: false, apps: [{ kind: 'corporate' }] },
  { id: 'CMASRSConsole', name: 'ASRS console', group: 'console', os: 'CMUOsSeegson', guests: false, apps: [{ kind: 'requisitions' }] },
  { id: 'CMUResearchDataTerminal', name: 'research data terminal', group: 'console', os: 'CMUOsSeegson', guests: false, apps: [{ kind: 'research' }] },
];

export function machineById(id) {
  return MACHINES.find(m => m.id === id) || MACHINES[0];
}

/** The casing the machine is built in: the emulator's pick, else the computer's own, else its OS's. */
export function casingOf(machine, os, picked) {
  return picked || machine.casing || os.casing || 'Seegson';
}

function preview(id, shell, colours, more) {
  return {
    id,
    shell,
    preview: true,
    namedAfterColony: false,
    homePage: 'colony.seegson.net',
    networks: ['CMUNetPublic'],
    documents: [],
    bootLines: [],
    ...colours,
    ...more,
  };
}

/**
 * Emulator-only OSes for the four shells the game has no OS for yet (CMUComputerShellStyle). Colours are the
 * faction icons' own (Icons/cmuos<faction>_*.png); the logos are the game's (Logos/<faction>.png).
 */
export const PREVIEW_SYSTEMS = [
  preview('CMUOsUscm', 'Tactical', { phosphor: '#9CBF6E', background: '#070A05', accent: '#9CBF6E' }, {
    name: 'USCM TACNET', startLabel: 'TACNET', casing: 'Uscm', logos: ['/Textures/CMU14/PersonalComputers/Logos/uscm.png'],
    homePage: 'command.govfor.mil',
    shellTitle: 'United States Colonial Marine Corps', shellSubtitle: 'TACTICAL NETWORK - AUTHORIZED PERSONNEL ONLY',
    shellStatus: 'TERMINAL {$id} STANDING BY', bootLines: ['USCM TACNET MILITARY OPERATING SYSTEM', 'CRYPTO LINK ESTABLISHED', 'ALL STATIONS REPORTING'],
  }),
  preview('CMUOsIasf', 'Tactical', { phosphor: '#C4CCD6', background: '#080A0E', accent: '#7FA2E0' }, {
    name: 'IASF FLIGHTNET', startLabel: 'FLIGHTNET', casing: 'Iasf', logos: ['/Textures/CMU14/PersonalComputers/Logos/iasf.png'],
    shellTitle: 'Imperial Armed Space Force', shellSubtitle: 'FLIGHT OPERATIONS', shellStatus: 'STATION {$id} ON WATCH',
    bootLines: ['IASF FLIGHTNET', 'SQUADRON ROSTER LOADED'],
  }),
  preview('CMUOsKelland', 'Tactical', { phosphor: '#F4C21A', background: '#0A0906', accent: '#F4C21A' }, {
    name: 'KELLAND MINEOPS', startLabel: 'MINEOPS', casing: 'Kelland', logos: ['/Textures/CMU14/PersonalComputers/Logos/kelland.png'],
    shellTitle: 'Kelland Mining Company', shellSubtitle: 'SHAFT CONTROL - WEAR YOUR HARD HAT', shellStatus: 'SHAFT TERMINAL {$id} OK',
    bootLines: ['KELLAND MINEOPS', 'SEISMIC SENSORS NOMINAL'],
  }),
  preview('CMUOsClf', 'Tactical', { phosphor: '#6CC04A', background: '#090A07', accent: '#D42A24' }, {
    name: 'FREE COLONY NET', startLabel: 'FREENET', logos: ['/Textures/CMU14/PersonalComputers/Logos/clf.png'],
    shellTitle: 'Colonial Liberation Front', shellSubtitle: 'THE COLONIES FOR THE COLONISTS', shellStatus: 'CELL TERMINAL {$id} SECURE',
    bootLines: ['FREE COLONY NET', 'ROUTING THROUGH THE RELAY'],
  }),
  preview('CMUOsUpp', 'Ministry', { phosphor: '#E8463A', background: '#100403', accent: '#C8282A' }, {
    name: 'UPP STATENET', startLabel: 'STATENET', casing: 'Upp', logos: ['/Textures/CMU14/PersonalComputers/Logos/upp.png'],
    shellTitle: 'Union of Progressive Peoples', shellSubtitle: 'Ministry of Space Colonization', shellMark: '*',
    shellTicker: ['DIRECTIVE: Report all foreign transmissions to the political officer.', 'DIRECTIVE: Terminal {$id} is state property. Use it well.', 'DIRECTIVE: The quota is the people\'s promise.'],
    bootLines: ['UPP STATENET', 'MINISTRY DIRECTORY LOADED'],
  }),
  preview('CMUOsTwe', 'Ministry', { phosphor: '#E2B33C', background: '#070A18', accent: '#8A2A36' }, {
    name: 'TWE CROWNNET', startLabel: 'CROWNNET', casing: 'Twe', logos: ['/Textures/CMU14/PersonalComputers/Logos/twe.png'],
    shellTitle: 'Three World Empire', shellSubtitle: 'Imperial Colonial Office', shellMark: '+',
    shellTicker: ['NOTICE: By order of the Colonial Office, terminal {$id} is open for official business.', 'NOTICE: Long live the Empire.'],
    bootLines: ['TWE CROWNNET', 'OFFICE OF THE GOVERNOR'],
  }),
  preview('CMUOsHyperdyne', 'Clinical', { phosphor: '#E6EEF4', background: '#0C1622', accent: '#7FB0DC' }, {
    name: 'Hyperdyne OS', startLabel: 'Hyperdyne', casing: 'Hyperdyne', logos: ['/Textures/CMU14/PersonalComputers/Logos/hyperdyne.png'],
    shellTitle: 'Hyperdyne Systems', bootLines: ['Hyperdyne OS', 'Synthetic diagnostics ready'],
  }),
  preview('CMUOsProdigy', 'Clinical', { phosphor: '#EEF0F4', background: '#0A0A0E', accent: '#38D0FF' }, {
    name: 'Prodigy', startLabel: 'Prodigy', casing: 'Prodigy', logos: ['/Textures/CMU14/PersonalComputers/Logos/prodigy.png'],
    shellTitle: 'Prodigy', bootLines: ['Prodigy', 'Welcome back'],
  }),
  preview('CMUOsLasalle', 'Clinical', { phosphor: '#4FD8B0', background: '#04120E', accent: '#4FD8B0' }, {
    name: 'LaSalle Bionet', startLabel: 'Bionet', casing: 'Lasalle', logos: ['/Textures/CMU14/PersonalComputers/Logos/lasalle.png'],
    shellTitle: 'LaSalle Bionational', bootLines: ['LaSalle Bionet', 'Sample catalogue synchronized'],
  }),
  preview('CMUOsSecurity', 'Police', { phosphor: '#4A86F0', background: '#040A18', accent: '#4A86F0' }, {
    name: 'COLONY SECURITY CASE SYSTEM', startLabel: 'CASES', casing: 'Security', logos: ['/Textures/CMU14/PersonalComputers/Logos/security.png'],
    homePage: 'security.seegson.net', networks: SEC,
    shellTitle: 'Colony Security', shellSubtitle: 'Case management system',
    shellTicker: ['BOLO: unregistered access tuner reported in the colony', 'Curfew in force from 22:00', 'Terminal {$id}: log every arrest'],
    bootLines: ['COLONY SECURITY CASE SYSTEM', 'WARRANT INDEX LOADED'],
  }),
  preview('CMUOsRangers', 'Police', { phosphor: '#D4C07E', background: '#080D06', accent: '#8AA66E' }, {
    name: 'CWPS PATROL', startLabel: 'PATROL', casing: 'Rangers', logos: ['/Textures/CMU14/PersonalComputers/Logos/rangers.png'],
    shellTitle: 'Colonial Wilderness Preservation Service', shellSubtitle: 'Patrol logs and permits',
    shellTicker: ['Fire risk: HIGH in the outer sectors', 'Hunting permits expire at the end of the cycle'],
    bootLines: ['CWPS PATROL', 'PERMIT REGISTER LOADED'],
  }),
  preview('CMUOsNspa', 'Police', { phosphor: '#E8505A', background: '#0A0304', accent: '#E04450' }, {
    name: 'NSPA WARRANTS', startLabel: 'NSPA', casing: 'Nspa', logos: ['/Textures/CMU14/PersonalComputers/Logos/nspa.png'],
    shellTitle: 'Neroid Sector Policing Authority', shellSubtitle: 'Warrants and case files',
    shellTicker: ['Wanted: contact the duty constable', 'Terminal {$id} is monitored'],
    bootLines: ['NSPA WARRANTS', 'SECTOR INDEX ONLINE'],
  }),
  preview('CMUOsCMBPolice', 'Police', { phosphor: '#8FC4FF', background: '#050A14', accent: '#8FC4FF' }, {
    name: 'CMB CASE FILES', startLabel: 'CMB', casing: 'Cmb', logos: ['/Textures/CMU14/PersonalComputers/Logos/cmb.png'],
    icons: 'cmuoscmb', homePage: 'cmb.bureau', networks: ['CMUNetPublic', 'CMUNetCMB', 'CMUNetSecurity'],
    shellTitle: 'Colonial Marshal Bureau', shellSubtitle: 'Case files',
    shellTicker: ['All deep lookups are traced', 'Faxes go to the Marshal Office'],
    bootLines: ['CMB CASE FILES', 'BUREAU LINK UP'],
  }),
];
