// Comprehensive plans/pricing URL database — keyed by normalized service name
const PLANS_URLS: Record<string, string> = {
  // Streaming
  netflix:      'https://www.netflix.com/signup/planform',
  hulu:         'https://www.hulu.com/plans',
  'disney+':    'https://www.disneyplus.com/welcome',
  disneyplus:   'https://www.disneyplus.com/welcome',
  max:          'https://www.max.com/plans',
  hbo:          'https://www.max.com/plans',
  'paramount+': 'https://www.paramountplus.com/plans',
  paramountplus:'https://www.paramountplus.com/plans',
  appletv:      'https://tv.apple.com/subscribe',
  'apple tv':   'https://tv.apple.com/subscribe',
  peacock:      'https://www.peacocktv.com/plans',
  crunchyroll:  'https://www.crunchyroll.com/welcome/plans',
  fubo:         'https://www.fubo.tv/stream/plans',
  dazn:         'https://www.dazn.com/en-IL/account/subscribe',
  mako:         'https://www.mako.co.il/mako-vod-purchase',
  hot:          'https://www.hot.net.il/packages',
  yes:          'https://www.yes.co.il/packages',
  curiositystream: 'https://curiositystream.com/pricing',

  // Music
  spotify:      'https://www.spotify.com/premium/',
  applemusic:   'https://www.apple.com/apple-music/',
  'apple music':'https://www.apple.com/apple-music/',
  youtubemusic: 'https://music.youtube.com/musicpremium',
  tidal:        'https://tidal.com/us/pricing',
  deezer:       'https://www.deezer.com/offers',
  amazonmusic:  'https://www.amazon.com/music/unlimited',

  // Cloud / Storage
  dropbox:      'https://www.dropbox.com/plans',
  googledrive:  'https://one.google.com/about/plans',
  googleone:    'https://one.google.com/about/plans',
  'google one': 'https://one.google.com/about/plans',
  icloud:       'https://www.apple.com/icloud/',
  onedrive:     'https://www.microsoft.com/en-us/microsoft-365/onedrive/compare-onedrive-plans',
  box:          'https://www.box.com/pricing',

  // Productivity
  notion:       'https://www.notion.so/pricing',
  evernote:     'https://evernote.com/pricing',
  todoist:      'https://todoist.com/pricing',
  clickup:      'https://clickup.com/pricing',
  monday:       'https://monday.com/pricing',
  asana:        'https://asana.com/pricing',
  airtable:     'https://airtable.com/pricing',
  trello:       'https://trello.com/pricing',
  basecamp:     'https://basecamp.com/pricing',
  linear:       'https://linear.app/pricing',
  jira:         'https://www.atlassian.com/software/jira/pricing',
  confluence:   'https://www.atlassian.com/software/confluence/pricing',

  // Design / Creative
  canva:        'https://www.canva.com/pricing/',
  figma:        'https://www.figma.com/pricing/',
  adobe:        'https://www.adobe.com/creativecloud/plans.html',
  midjourney:   'https://www.midjourney.com/plans',
  runway:       'https://runwayml.com/pricing/',
  'runway ai':  'https://runwayml.com/pricing/',
  capcut:       'https://www.capcut.com/pricing',
  descript:     'https://www.descript.com/pricing',
  invideo:      'https://ai.invideo.io/pricing',
  sketch:       'https://www.sketch.com/pricing/',
  framer:       'https://www.framer.com/pricing/',

  // AI / Tech
  openai:       'https://openai.com/pricing',
  chatgpt:      'https://openai.com/chatgpt/pricing/',
  anthropic:    'https://www.anthropic.com/pricing',
  claude:       'https://claude.ai/upgrade',
  perplexity:   'https://www.perplexity.ai/pro',
  github:       'https://github.com/pricing',
  gitlab:       'https://about.gitlab.com/pricing/',
  cursor:       'https://www.cursor.com/pricing',
  grammarly:    'https://www.grammarly.com/plans',
  jasper:       'https://www.jasper.ai/pricing',
  writesonic:   'https://writesonic.com/pricing',
  copy:         'https://www.copy.ai/pricing',
  'copy ai':    'https://www.copy.ai/pricing',

  // Communication
  zoom:         'https://zoom.us/pricing',
  slack:        'https://slack.com/intl/en-us/pricing',
  teams:        'https://www.microsoft.com/en-us/microsoft-teams/compare-microsoft-teams-options',
  discord:      'https://discord.com/nitro',
  loom:         'https://www.loom.com/pricing',
  intercom:     'https://www.intercom.com/pricing',
  hubspot:      'https://www.hubspot.com/pricing',

  // Microsoft / Google
  microsoft365: 'https://www.microsoft.com/en-us/microsoft-365/business/compare-all-plans',
  'microsoft 365': 'https://www.microsoft.com/en-us/microsoft-365/business/compare-all-plans',
  office365:    'https://www.microsoft.com/en-us/microsoft-365/business/compare-all-plans',
  google:       'https://workspace.google.com/pricing',
  youtube:      'https://www.youtube.com/premium',
  youtubepremium: 'https://www.youtube.com/premium',

  // Shopping / Services
  amazon:       'https://www.amazon.com/amazonprime',
  amazonprime:  'https://www.amazon.com/amazonprime',
  'amazon prime': 'https://www.amazon.com/amazonprime',
  duolingo:     'https://www.duolingo.com/plus',
  headspace:    'https://www.headspace.com/buy/headspace-subscription',
  calm:         'https://app.calm.com/signup',
  audible:      'https://www.audible.com/ep/whispersync',
  kindle:       'https://www.amazon.com/kindle-dbs/hz/subscribe/ku',
  patreon:      'https://www.patreon.com/pricing',
  substack:     'https://substack.com/pricing',
  nordvpn:      'https://nordvpn.com/pricing/',
  expressvpn:   'https://www.expressvpn.com/order',
  surfshark:    'https://surfshark.com/pricing',
  '1password':  'https://1password.com/sign-up/',
  lastpass:     'https://www.lastpass.com/pricing',
  dashlane:     'https://www.dashlane.com/pricing',
  bitwarden:    'https://bitwarden.com/pricing/',
  malwarebytes: 'https://www.malwarebytes.com/pricing',
  norton:       'https://us.norton.com/products',
};

export function lookupPlansUrl(serviceName: string): string | null {
  const key = serviceName.toLowerCase().replace(/[^a-z0-9+ ]/g, '').trim();
  // Exact match
  if (PLANS_URLS[key]) return PLANS_URLS[key];
  // Partial match — find first entry whose key contains the search term or vice versa
  for (const [k, url] of Object.entries(PLANS_URLS)) {
    if (key.includes(k) || k.includes(key)) return url;
  }
  return null;
}
