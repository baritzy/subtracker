// Comprehensive cancel URL database — keyed by normalized service name
const CANCEL_URLS: Record<string, string> = {
  // Streaming
  netflix:      'https://www.netflix.com/cancelplan',
  hulu:         'https://secure.hulu.com/account',
  'disney+':    'https://www.disneyplus.com/account/subscription',
  disneyplus:   'https://www.disneyplus.com/account/subscription',
  max:          'https://www.max.com/account',
  hbo:          'https://www.max.com/account',
  'paramount+': 'https://www.paramountplus.com/account/membership',
  paramountplus:'https://www.paramountplus.com/account/membership',
  appletv:      'https://tv.apple.com/settings',
  'apple tv':   'https://tv.apple.com/settings',
  peacock:      'https://www.peacocktv.com/account/overview',
  crunchyroll:  'https://www.crunchyroll.com/account/membership',
  fubo:         'https://www.fubo.tv/account/subscription',
  dazn:         'https://www.dazn.com/en-IL/account/subscription',
  mako:         'https://www.mako.co.il/mako-vod-purchase',
  hot:          'https://www.hot.net.il/contact',
  yes:          'https://www.yes.co.il/content/general/page/contact',

  // Music
  spotify:      'https://www.spotify.com/account/subscription/cancel',
  applemusic:   'https://appleid.apple.com/account/manage',
  'apple music':'https://appleid.apple.com/account/manage',
  youtubemusic: 'https://music.youtube.com/paid_memberships',
  tidal:        'https://account.tidal.com/subscription',
  deezer:       'https://www.deezer.com/account',
  amazonmusic:  'https://www.amazon.com/mc/pipelines/payments',

  // Cloud / Storage
  dropbox:      'https://www.dropbox.com/account/plan',
  googledrive:  'https://myaccount.google.com/subscriptions',
  icloud:       'https://appleid.apple.com/account/manage',
  onedrive:     'https://account.microsoft.com/services',
  box:          'https://account.box.com/settings',

  // Productivity
  notion:       'https://www.notion.so/my-account',
  evernote:     'https://www.evernote.com/Settings.action',
  todoist:      'https://todoist.com/prefs/account',
  clickup:      'https://app.clickup.com/settings/billing',
  monday:       'https://monday.com/account/billing',
  asana:        'https://app.asana.com/admin/billing',
  airtable:     'https://airtable.com/account',
  notion2:      'https://www.notion.so/my-account',

  // Design / Creative
  canva:        'https://www.canva.com/settings/billing',
  figma:        'https://www.figma.com/settings',
  adobe:        'https://account.adobe.com/plans',
  midjourney:   'https://www.midjourney.com/account',
  runway:       'https://app.runwayml.com/account',
  'runway ai':  'https://app.runwayml.com/account',
  capcut:       'https://www.capcut.com/my-account',
  descript:     'https://www.descript.com/settings/billing',
  invideo:      'https://ai.invideo.io/workspace/billing',

  // AI / Tech
  openai:       'https://platform.openai.com/account/billing',
  chatgpt:      'https://chat.openai.com/#settings/DataControls',
  anthropic:    'https://console.anthropic.com/settings/billing',
  claude:       'https://claude.ai/settings',
  perplexity:   'https://www.perplexity.ai/settings/account',
  github:       'https://github.com/settings/billing',
  gitlab:       'https://gitlab.com/-/profile/billings',
  cursor:       'https://www.cursor.com/settings',
  grammarly:    'https://account.grammarly.com/subscription',
  jasper:       'https://app.jasper.ai/settings/billing',

  // Communication
  zoom:         'https://zoom.us/billing',
  slack:        'https://slack.com/billing',
  teams:        'https://account.microsoft.com/services',
  discord:      'https://discord.com/settings/subscriptions',
  loom:         'https://www.loom.com/settings/billing',

  // Microsoft / Google
  microsoft365: 'https://account.microsoft.com/services',
  'microsoft 365': 'https://account.microsoft.com/services',
  office365:    'https://account.microsoft.com/services',
  google:       'https://myaccount.google.com/subscriptions',
  googleone:    'https://one.google.com/storage',
  'google one': 'https://one.google.com/storage',
  youtube:      'https://www.youtube.com/paid_memberships',
  youtubepremium: 'https://www.youtube.com/paid_memberships',

  // Shopping / Services
  amazon:       'https://www.amazon.com/mc/pipelines/payments',
  amazonprime:  'https://www.amazon.com/mc/pipelines/payments',
  'amazon prime': 'https://www.amazon.com/mc/pipelines/payments',
  duolingo:     'https://www.duolingo.com/settings/coach',
  headspace:    'https://www.headspace.com/settings',
  calm:         'https://app.calm.com/settings',
  audible:      'https://www.audible.com/account/membership',
  kindle:       'https://www.amazon.com/mc/pipelines/payments',
  patreon:      'https://www.patreon.com/settings/membership',
  substack:     'https://substack.com/settings',
  nordvpn:      'https://my.nordaccount.com/dashboard/nordvpn/subscriptions',
  expressvpn:   'https://www.expressvpn.com/support/troubleshooting/cancel-subscription',
  '1password':  'https://my.1password.com/profile',
  lastpass:     'https://account.lastpass.com/',
  dashlane:     'https://app.dashlane.com/settings/account',
};

// Hebrew name → English key mapping
const HEBREW_TO_ENGLISH: Record<string, string> = {
  'נטפליקס': 'netflix',
  'ספוטיפיי': 'spotify',
  'ספוטיפי': 'spotify',
  'יוטיוב': 'youtube',
  'יוטיוב פרימיום': 'youtubepremium',
  'גוגל': 'google',
  'גוגל וואן': 'google one',
  'מיקרוסופט': 'microsoft365',
  'אפל': 'icloud',
  'אייקלאוד': 'icloud',
  'אפל מיוזיק': 'apple music',
  'אפל טיוי': 'appletv',
  'אמזון': 'amazon',
  'פריים': 'amazon prime',
  'פריים וידאו': 'amazon prime',
  'דיסני': 'disney+',
  'דיסני פלוס': 'disney+',
  'מקס': 'max',
  'הוט': 'hot',
  'יס': 'yes',
  'סלקום': 'cellcom',
  'פרטנר': 'partner',
  'בזק': 'bezeq',
  'קנבה': 'canva',
  'פיגמה': 'figma',
  'אדובי': 'adobe',
  'נושן': 'notion',
  'נוטיון': 'notion',
  'זום': 'zoom',
  'סלאק': 'slack',
  'דיסקורד': 'discord',
  'גיטהאב': 'github',
  'קרסר': 'cursor',
  'קאפקאט': 'capcut',
  'קפקאט': 'capcut',
  'צ\'אטג\'יפיטי': 'chatgpt',
  'צ\'אט ג\'יפיטי': 'chatgpt',
  'אופן AI': 'openai',
  'אופן אי-איי': 'openai',
  'קלוד': 'claude',
  'פרפלקסיטי': 'perplexity',
  'דואולינגו': 'duolingo',
  'גרמרלי': 'grammarly',
  'נורד': 'nordvpn',
  'נורד וי-פי-אן': 'nordvpn',
  'דרופבוקס': 'dropbox',
};

export function lookupCancelUrl(serviceName: string): string | null {
  const trimmed = serviceName.trim();

  // Try Hebrew normalization first
  const englishName = HEBREW_TO_ENGLISH[trimmed] ?? serviceName;

  const key = englishName.toLowerCase().replace(/[^a-z0-9+ ]/g, '').trim();
  if (!key) return null;
  // Exact match
  if (CANCEL_URLS[key]) return CANCEL_URLS[key];
  // Partial match — find first entry whose key contains the search term or vice versa
  for (const [k, url] of Object.entries(CANCEL_URLS)) {
    if (key.includes(k) || k.includes(key)) return url;
  }
  return null;
}
