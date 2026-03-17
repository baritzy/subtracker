// company name (lowercase) → domain
const COMPANY_DOMAINS: Record<string, string> = {
  // Streaming
  netflix: 'netflix.com',
  spotify: 'spotify.com',
  hulu: 'hulu.com',
  'disney+': 'disneyplus.com',
  disney: 'disneyplus.com',
  max: 'max.com',
  'paramount+': 'paramountplus.com',
  paramount: 'paramountplus.com',
  'apple tv': 'apple.com',
  'apple tv+': 'apple.com',
  'amazon prime': 'amazon.com',
  'prime video': 'amazon.com',
  twitch: 'twitch.tv',
  youtube: 'youtube.com',
  'youtube premium': 'youtube.com',
  deezer: 'deezer.com',
  tidal: 'tidal.com',
  'apple music': 'apple.com',

  // Apple / Google / Microsoft
  apple: 'apple.com',
  icloud: 'icloud.com',
  'google one': 'one.google.com',
  'google workspace': 'workspace.google.com',
  'google drive': 'drive.google.com',
  google: 'google.com',
  microsoft: 'microsoft.com',
  'office 365': 'microsoft.com',
  'microsoft 365': 'microsoft.com',
  xbox: 'xbox.com',

  // AI
  openai: 'openai.com',
  chatgpt: 'openai.com',
  anthropic: 'anthropic.com',
  claude: 'anthropic.com',
  midjourney: 'midjourney.com',
  runway: 'runwayml.com',
  'runway ml': 'runwayml.com',
  pika: 'pika.art',
  sora: 'openai.com',
  'stable diffusion': 'stability.ai',
  stability: 'stability.ai',
  'stability ai': 'stability.ai',
  perplexity: 'perplexity.ai',
  'perplexity ai': 'perplexity.ai',
  elevenlabs: 'elevenlabs.io',
  'eleven labs': 'elevenlabs.io',
  heygen: 'heygen.com',
  'hey gen': 'heygen.com',
  synthesia: 'synthesia.io',
  descript: 'descript.com',
  capcut: 'capcut.com',
  higgsfield: 'higgsfield.ai',
  'higgsfield ai': 'higgsfield.ai',
  kling: 'klingai.com',
  'kling ai': 'klingai.com',
  suno: 'suno.com',
  udio: 'udio.com',
  luma: 'lumalabs.ai',
  'luma ai': 'lumalabs.ai',
  ideogram: 'ideogram.ai',
  leonardo: 'leonardo.ai',
  'leonardo ai': 'leonardo.ai',
  'adobe firefly': 'adobe.com',
  gemini: 'gemini.google.com',
  copilot: 'microsoft.com',
  grok: 'x.ai',
  'generate:biomedia': 'generate.video',

  // Design / Productivity
  adobe: 'adobe.com',
  figma: 'figma.com',
  canva: 'canva.com',
  sketch: 'sketch.com',
  framer: 'framer.com',
  webflow: 'webflow.com',
  notion: 'notion.so',
  obsidian: 'obsidian.md',
  evernote: 'evernote.com',
  todoist: 'todoist.com',
  'things 3': 'culturedcode.com',
  things: 'culturedcode.com',

  // Dev tools
  github: 'github.com',
  gitlab: 'gitlab.com',
  cursor: 'cursor.sh',
  vercel: 'vercel.com',
  netlify: 'netlify.com',
  'digital ocean': 'digitalocean.com',
  digitalocean: 'digitalocean.com',
  cloudflare: 'cloudflare.com',
  aws: 'aws.amazon.com',
  heroku: 'heroku.com',
  'railway': 'railway.app',
  supabase: 'supabase.com',
  firebase: 'firebase.google.com',
  linear: 'linear.app',
  jira: 'atlassian.com',
  atlassian: 'atlassian.com',
  trello: 'trello.com',
  asana: 'asana.com',
  monday: 'monday.com',
  'monday.com': 'monday.com',

  // Communication
  zoom: 'zoom.us',
  slack: 'slack.com',
  discord: 'discord.com',
  'microsoft teams': 'microsoft.com',

  // Cloud storage
  dropbox: 'dropbox.com',

  // Social
  twitter: 'x.com',
  x: 'x.com',
  linkedin: 'linkedin.com',
  facebook: 'facebook.com',
  instagram: 'instagram.com',
  tiktok: 'tiktok.com',

  // Security / VPN
  nordvpn: 'nordvpn.com',
  expressvpn: 'expressvpn.com',
  '1password': '1password.com',
  lastpass: 'lastpass.com',
  bitwarden: 'bitwarden.com',

  // Gaming
  playstation: 'playstation.com',
  'ps plus': 'playstation.com',
  nintendo: 'nintendo.com',
  steam: 'steampowered.com',

  // Israeli companies
  partner: 'partner.co.il',
  'פרטנר': 'partner.co.il',
  cellcom: 'cellcom.co.il',
  'סלקום': 'cellcom.co.il',
  hot: 'hot.net.il',
  'הוט': 'hot.net.il',
  yes: 'yes.co.il',
  'יס': 'yes.co.il',
  bezeq: 'bezeq.co.il',
  'בזק': 'bezeq.co.il',
  'yes+': 'yes.co.il',
  walla: 'walla.co.il',
  '012': '012.net.il',

  // Hebrew names for international services
  'נטפליקס': 'netflix.com',
  'ספוטיפיי': 'spotify.com',
  'ספוטיפי': 'spotify.com',
  'יוטיוב': 'youtube.com',
  'גוגל': 'google.com',
  'מיקרוסופט': 'microsoft.com',
  'אפל': 'apple.com',
  'אייקלאוד': 'icloud.com',
  'אמזון': 'amazon.com',
  'פריים': 'amazon.com',
  'פריים וידאו': 'amazon.com',
  'דיסני': 'disneyplus.com',
  'דיסני פלוס': 'disneyplus.com',
  'מקס': 'max.com',
  'דרופבוקס': 'dropbox.com',
  'נושן': 'notion.so',
  'נוטיון': 'notion.so',
  'פיגמה': 'figma.com',
  'קנבה': 'canva.com',
  'אדובי': 'adobe.com',
  'זום': 'zoom.us',
  'סלאק': 'slack.com',
  'דיסקורד': 'discord.com',
  'גיטהאב': 'github.com',
  'קרסר': 'cursor.sh',
  'קאפקאט': 'capcut.com',
  'קפקאט': 'capcut.com',
  'צ\'אטג\'יפיטי': 'openai.com',
  'צ\'אט ג\'יפיטי': 'openai.com',
  'אופן AI': 'openai.com',
  'אופן אי-איי': 'openai.com',
  'קלוד': 'anthropic.com',
  'פרפלקסיטי': 'perplexity.ai',
  'מידג\'רני': 'midjourney.com',
  'פלייסטיישן': 'playstation.com',
  'נינטנדו': 'nintendo.com',
  'סטים': 'steampowered.com',
  'דואולינגו': 'duolingo.com',
  'גרמרלי': 'grammarly.com',
  'לינקדין': 'linkedin.com',
  'פייסבוק': 'facebook.com',
  'אינסטגרם': 'instagram.com',
  'טיקטוק': 'tiktok.com',

  // Food & Beverage
  'coca cola': 'coca-cola.com',
  'coca-cola': 'coca-cola.com',
  cocacola: 'coca-cola.com',
  pepsi: 'pepsi.com',
  starbucks: 'starbucks.com',

  // Other
  duolingo: 'duolingo.com',
  grammarly: 'grammarly.com',
  amazon: 'amazon.com',
};

export function toClearbitUrl(domain: string): string {
  return `https://logo.clearbit.com/${domain}`;
}

export function toFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

export function lookupLogoUrl(companyName: string): string | null {
  const key = companyName.toLowerCase().trim();

  // 1. Exact match → Clearbit (high quality), with favicon as fallback handled in UI
  if (COMPANY_DOMAINS[key]) return toClearbitUrl(COMPANY_DOMAINS[key]);

  // 2. Partial match
  for (const [name, domain] of Object.entries(COMPANY_DOMAINS)) {
    if (key.includes(name) || name.includes(key)) {
      return toClearbitUrl(domain);
    }
  }

  // 3. Smart guess for single-word or short names → Google Favicon
  // Remove common suffixes and spaces
  const normalized = key
    .replace(/\s+(ai|inc|ltd|co|corp|llc|technologies|tech|software|systems|solutions|group|app|apps)$/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();

  if (normalized.length >= 3) {
    // If original name ends with "ai", try .ai TLD
    const endsWithAI = /\bai$/.test(key.trim()) || key.endsWith(' ai');
    const domain = endsWithAI ? `${normalized}.ai` : `${normalized}.com`;
    return toFaviconUrl(domain);
  }

  return null;
}
