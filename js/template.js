// "New from template": the LostAndFound example package (Content.CMU/Resources/ServerInfo/CMU14/ExtraNet/
// Packages/LostAndFound/), copied here so the editor works offline.

export const TEMPLATE_FILES = {
  'site.yml': `# A site package: this folder is the whole site. Drop a folder like it anywhere under
# /ServerInfo/CMU14/ExtraNet/ and the game picks it up. Titles may be plain text; root defaults to this
# folder; pages can use ./ for files next to them. The ExtraNet editor exports folders like this one.
- type: cmuNetSite
  id: CMUNetSitePackageLostAndFound
  address: lostfound.colony
  title: Colony Lost and Found
  networks:
  - CMUNetPublic
  style:
    background: "#EFE7D2"
    text: "#2B2418"
    heading: "#7A3E12"
    link: "#1D4E7A"
    font: Sans
  pages:
    "": index.xml
    rules: rules.xml
  tabs:
  - title: Found items
  - title: House rules
    path: rules
  board:
    postLabel: Report something found
    empty: Nothing handed in this shift.
    anyonePosts: true
    showTerminals: true
`,
  'index.xml': `<Document>
  <CMUNetStyle Background="#EFE7D2" Text="#2B2418" Heading="#7A3E12" Link="#1D4E7A" Font="Sans"/>
  # {colony} LOST AND FOUND
  <CMUNetSprite Rsi="/Textures/_RMC14/Objects/Fun/plushies.rsi" State="bee" Scale="3" Align="Left"/>
  Found something that is not yours? Post it below with where you found it. Lost something? Read the board, then ask at the terminal number on the posting.

  Read the [netlink="house rules" link="lostfound.colony/rules"] before posting.

  Bored on shift? [netlink="Surf somewhere random" link="net://random"]
</Document>
`,
  'rules.xml': `<Document>
  <CMUNetStyle Background="#EFE7D2" Text="#2B2418" Heading="#7A3E12" Link="#1D4E7A" Font="Sans"/>
  # HOUSE RULES
  - Describe the item, not the owner.
  - Say where you found it and when.
  - Weapons and ammunition go to the Marshals, not on this board.
  - Unclaimed items are recycled at the end of the shift.

  [netlink="Back to the board" link="lostfound.colony"]
</Document>
`,
};

export const TEMPLATE_FOLDER = 'LostAndFound';
