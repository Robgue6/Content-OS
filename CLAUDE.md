# Content Pilot — Claude Code Context

## What this project is
Content Pilot is a strategic editorial workspace for short-form content creators (TikTok, Reels, Shorts).
It bridges brand strategy with daily production using Gemini AI.

## Tech stack
- **Framework**: React 19 + TypeScript (Vite)
- **Styling**: Tailwind CSS v4 (via @tailwindcss/vite plugin — no tailwind.config.js needed)
- **Icons**: lucide-react
- **Charts**: recharts
- **AI**: @google/genai (Gemini 2.0 Flash)
- **Backend/Auth/DB**: Supabase (@supabase/supabase-js)

## Supabase project
- **Project name**: content-pilot
- **Org**: tinysaasy (id: ttoqnsrickegnjighged)
- **Project ref**: yxqdzzssasadajuuukzq
- **URL**: https://yxqdzzssasadajuuukzq.supabase.co
- **Anon key**: in .env.local (VITE_SUPABASE_ANON_KEY) — never hardcode
- **Auth**: Email + Password only
- **RLS**: Enabled on all tables. All policies use `user_id = auth.uid()` or `id = auth.uid()` (profiles)

## Database schema

### profiles
```sql
id uuid PK → auth.users(id)
brand_identity jsonb     -- BrandIdentity object
themes text[]            -- content themes e.g. ['Growth','Mindset']
content_types text[]     -- formats e.g. ['Tutorial','Story']
ai_enabled boolean       -- feature flag for AI idea generation in matrix
gemini_api_key text      -- user's Gemini API key (RLS-protected)
updated_at timestamptz
```
Auto-created on signup via `on_auth_user_created` trigger with default themes/types.

### posts
```sql
id uuid PK
user_id uuid → auth.users
title text, date date, status text (IDEA|DRAFT|SCHEDULED)
theme text, type text, script_id uuid
created_at timestamptz
```

### scripts
```sql
id uuid PK
user_id uuid → auth.users
post_id uuid → posts (unique — one script per post)
hook text, body text, cta text
created_at, updated_at timestamptz
```

### matrix_ideas
```sql
id uuid PK
user_id uuid → auth.users
theme text, type text, title text, done boolean
created_at timestamptz
```

### roi_campaigns
```sql
id uuid PK
user_id uuid → auth.users
post_id uuid (nullable — post may be deleted)
post_title text          -- denormalized for display
target_cost_per_follower numeric  -- user's "good ROI" threshold e.g. 0.50
platform text            -- instagram|tiktok|facebook|other
status text              -- active|paused|stopped
created_at timestamptz
```

### roi_entries
```sql
id uuid PK
user_id uuid → auth.users
campaign_id uuid → roi_campaigns
date date
spend numeric            -- euros spent that day
followers_gained integer -- new followers gained that day
notes text
created_at timestamptz
```

## Source file structure
```
src/
  App.tsx                   -- root component, auth gate, all state + Supabase mutations
  types.ts                  -- all TypeScript interfaces (AppState, Post, Script, MatrixIdea, RoiCampaign, RoiEntry)
  main.tsx                  -- React entry point
  index.css                 -- @import "tailwindcss" only
  lib/
    supabase.ts             -- createClient singleton
    db.ts                   -- all typed CRUD functions for every table
  hooks/
    useAuth.ts              -- session + user state via onAuthStateChange
  components/
    Dashboard.tsx           -- KPI cards, Recharts bar+pie, identity alert
    BrandIdentity.tsx       -- ICP, empathy map (4 quadrants), tone/positioning
    StrategyMatrix.tsx      -- 2D theme×type grid, persistent task-list ideas, AI generate flag
    ContentCalendar.tsx     -- monthly calendar view, post CRUD, status tracking
    ScriptLab.tsx           -- modal: hook/body/CTA editor + Gemini generation
    Settings.tsx            -- AI flag toggle, Gemini key (saved to Supabase), sign out
    RoiTracker.tsx          -- ad ROI tracker with campaigns, daily entries, decision signals
    auth/
      AuthPage.tsx          -- email+password login/signup
```

## State management pattern
- All data lives in Supabase, loaded on auth in App.tsx via Promise.all
- Local React state mirrors DB for instant UI updates (optimistic)
- Every mutation: update local state first, then async DB call
- No localStorage for data (only used previously, now fully removed)
- Gemini API key: stored in `profiles.gemini_api_key` (NOT localStorage)

## Key data flows

### Auth flow
```
useAuth() → session? → No → <AuthPage /> → Yes → load all data from Supabase
```

### Script generation
```
ScriptLab modal → GoogleGenAI({ apiKey: geminiApiKey }) → gemini-2.0-flash
System instruction injects: ICP + empathy map (pains/gains/fears/hopes) + tone
Returns JSON: { hook, body, cta }
```

### ROI decision logic
```
For each campaign entry: costPerFollower = spend / followersGained
Compare to campaign.targetCostPerFollower:
  GREEN  = cost ≤ target           → "ROI is Good — consider scaling budget"
  YELLOW = cost ≤ target × 1.5    → "ROI is Marginal — monitor closely"
  RED    = cost > target × 1.5    → "ROI is Negative — pause or try new creative"
```

### Matrix AI generation (feature-flagged)
```
Settings → aiEnabled toggle → saved to profiles.ai_enabled
StrategyMatrix: shows "Generate with AI" only when aiEnabled === true
Calls gemini-2.0-flash with brand context system instruction
Returns 3 titles, appended to matrix_ideas table
```

## Critical rules for future edits
1. **Tailwind v4**: uses `@import "tailwindcss"` in index.css — no config file needed, no `tailwind.config.js`
2. **Supabase RLS**: every new table must have RLS enabled + policy for `user_id = auth.uid()`
3. **No localStorage**: all persistence is Supabase. Do not re-introduce localStorage for data
4. **Optimistic updates**: always update local state before awaiting DB call to keep UI snappy
5. **AppState type**: when adding new data to app, add to both `types.ts` AppState AND App.tsx state variables AND load in the `Promise.all` on auth
6. **AI model**: always use `gemini-2.0-flash` (not gemini-flash-preview or older versions)
7. **Default themes/types**: set in the DB trigger, not hardcoded in frontend (frontend reads from profile)
8. **Script Lab**: modal is triggered by `scriptLabPostId` in App.tsx state, opened via `openLab(postId)`
9. **Build command**: `npm run build` — must pass `tsc -b` with zero errors before considering done
10. **Token**: never store or log the Supabase service role key or access token `sbp_*` in any file

## Navigation tabs
dashboard | identity | matrix | calendar | lab | roi
(NavTab type in types.ts must include all tabs)

## Commands
```bash
npm run dev      # start dev server on localhost:5173
npm run build    # TypeScript check + Vite production build
```
