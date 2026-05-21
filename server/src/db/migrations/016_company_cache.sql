-- Company cache: stores verified company data (logos, cancel URLs, plans URLs)
-- Populated by smart search and user uploads. Shared across all users.
CREATE TABLE IF NOT EXISTS company_cache (
    id SERIAL PRIMARY KEY,
    name_key TEXT NOT NULL UNIQUE,        -- normalized lookup key (lowercase, trimmed)
    company_name TEXT NOT NULL,            -- display name
    domain TEXT,                           -- verified website domain
    logo_url TEXT,                         -- best known logo URL
    logo_source TEXT DEFAULT 'auto',       -- 'auto' | 'user_upload' | 'override'
    cancel_url TEXT,                       -- cancellation page URL
    plans_url TEXT,                        -- plans/pricing page URL
    verified BOOLEAN DEFAULT FALSE,        -- true if website was verified
    search_count INTEGER DEFAULT 1,        -- how many times this was searched
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_cache_name ON company_cache(name_key);
CREATE INDEX IF NOT EXISTS idx_company_cache_domain ON company_cache(domain);

-- Daily quota tracking for external API calls
CREATE TABLE IF NOT EXISTS api_quota (
    id SERIAL PRIMARY KEY,
    date TEXT NOT NULL UNIQUE,             -- YYYY-MM-DD
    google_searches INTEGER DEFAULT 0,
    alert_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
