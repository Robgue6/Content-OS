import { useState } from 'react';
import {
  ArrowLeft, Telescope, Search, Loader2, TrendingUp, MessageSquare,
  Heart, Eye, Plus, Trash2, CheckCircle, AlertCircle, Lightbulb,
  ChevronRight, BarChart2, Target, XCircle, FlaskConical, Calendar,
} from 'lucide-react';
import OpenAI from 'openai';
import type {
  BrandIdentity, CompetitorReport, CompetitorPost, CompetitorComment,
  CompetitorReportData, IntelActionablePost, MatrixIdea, AppLanguage,
} from '../types';

// ── Apify API helpers ──────────────────────────────────────────────────────

async function apifyRun(
  actorId: string,
  input: object,
  token: string,
): Promise<{ defaultDatasetId: string }> {
  const res = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/runs?waitForFinish=240`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    },
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => res.statusText);
    throw new Error(`Apify run failed (${res.status}): ${txt}`);
  }
  const data = await res.json();
  const run = data.data;
  if (run.status !== 'SUCCEEDED') {
    throw new Error(`Scrape did not finish (status: ${run.status}). Try again or check your Apify quota.`);
  }
  return { defaultDatasetId: run.defaultDatasetId };
}

async function apifyGetItems<T>(datasetId: string, token: string): Promise<T[]> {
  const res = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?format=json&clean=true&limit=50`,
    { headers: { 'Authorization': `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Failed to fetch dataset (${res.status})`);
  return res.json();
}

// ── Engagement scoring ─────────────────────────────────────────────────────

function calcEngagement(p: { likesCount?: number; commentsCount?: number; videoViewCount?: number }) {
  return (p.likesCount ?? 0) + (p.commentsCount ?? 0) * 3 + (p.videoViewCount ?? 0) * 0.05;
}

// ── Raw Apify post → CompetitorPost ───────────────────────────────────────

function mapPost(raw: Record<string, unknown>): CompetitorPost {
  const likes = Number(raw.likesCount ?? raw.likes ?? 0);
  const comments = Number(raw.commentsCount ?? raw.comments ?? 0);
  const views = Number(raw.videoViewCount ?? raw.videoPlayCount ?? raw.playCount ?? 0);
  return {
    id: String(raw.id ?? raw.shortCode ?? Math.random()),
    shortCode: String(raw.shortCode ?? raw.code ?? ''),
    url: String(raw.url ?? raw.postUrl ?? `https://www.instagram.com/p/${raw.shortCode}/`),
    caption: String(raw.caption ?? raw.text ?? '').slice(0, 600),
    likesCount: likes,
    commentsCount: comments,
    videoViewCount: views,
    timestamp: String(raw.timestamp ?? raw.taken_at ?? ''),
    type: String(raw.type ?? raw.media_type ?? 'image'),
    engagementScore: calcEngagement({ likesCount: likes, commentsCount: comments, videoViewCount: views }),
    comments: [],
  };
}

function mapComment(raw: Record<string, unknown>): CompetitorComment {
  return {
    id: String(raw.id ?? Math.random()),
    text: String(raw.text ?? raw.content ?? ''),
    ownerUsername: String(raw.ownerUsername ?? (raw.owner as Record<string, unknown>)?.username ?? 'unknown'),
    timestamp: String(raw.timestamp ?? ''),
  };
}

// ── AI prompt builder ─────────────────────────────────────────────────────

function buildIntelPrompt(
  handle: string,
  topPosts: CompetitorPost[],
  brandIdentity: BrandIdentity,
  themes: string[],
  contentTypes: string[],
): string {
  const postsText = topPosts.map((post, i) => {
    const comments = post.comments.slice(0, 20).map(c => `  - "${c.text}"`).join('\n');
    return `POST ${i + 1}: ${post.url}
Caption: ${post.caption || '(no caption)'}
Engagement: ${post.likesCount.toLocaleString()} likes · ${post.commentsCount.toLocaleString()} comments${post.videoViewCount ? ` · ${post.videoViewCount.toLocaleString()} views` : ''}
Format: ${post.type}
Top comments (${post.comments.length} scraped):
${comments || '  (none)'}`.trim();
  }).join('\n\n---\n\n');

  return `You are a strategic content analyst. Analyze the top-performing Instagram posts from @${handle} for a brand creator.

=== USER'S BRAND IDENTITY ===
ICP (Ideal Customer Profile): ${brandIdentity.icp || 'Not defined'}
Positioning: ${brandIdentity.positioning || 'Not defined'}
Voice & Tone: ${brandIdentity.tone || 'Not defined'}
Audience Pains: ${brandIdentity.empathyMap?.pains || 'Not defined'}
Audience Gains: ${brandIdentity.empathyMap?.gains || 'Not defined'}
Audience Fears: ${brandIdentity.empathyMap?.fears || 'Not defined'}
Audience Hopes: ${brandIdentity.empathyMap?.hopes || 'Not defined'}
Content Themes: ${themes.join(', ') || 'Not set'}
Content Formats: ${contentTypes.join(', ') || 'Not set'}

=== TOP PERFORMING POSTS FROM @${handle} ===
${postsText}

=== TASK ===
Return ONLY a valid JSON object with this exact structure (no markdown, no preamble):
{
  "overallAnalysis": "2-3 sentence strategic summary of what makes this competitor effective",
  "audienceSignals": ["3-4 key insights extracted from the comments about what the audience wants"],
  "whatToDo": [
    {
      "tactic": "Short actionable tactic name (max 8 words)",
      "reasoning": "Why this tactic is relevant to YOUR brand and ICP specifically",
      "evidence": "Direct evidence from the posts/comments that supports this",
      "icpAlignment": "aligned"
    }
  ],
  "whatNotToDo": [
    {
      "pattern": "Pattern used by the competitor to avoid",
      "reason": "Why this would conflict with your brand voice or positioning",
      "icpConflict": "How it misaligns with your ICP or empathy map"
    }
  ],
  "actionablePosts": [
    {
      "title": "Specific post title adapted for YOUR brand voice",
      "hook": "Opening hook line (first 3 seconds of the video)",
      "why": "Why this would resonate with YOUR ICP based on the empathy map",
      "theme": "MUST be exactly one of: ${themes.join(' | ')}",
      "type": "MUST be exactly one of: ${contentTypes.join(' | ')}",
      "angle": "Your unique differentiating angle vs the competitor"
    }
  ]
}

Rules:
- whatToDo: 3-4 tactics that ARE aligned with the user's ICP/positioning
- whatNotToDo: 2-3 patterns the competitor uses that DON'T fit this user's brand — be specific and honest
- actionablePosts: exactly 5 ideas adapting the competitor's winning formula to this user's brand
- theme/type for actionablePosts MUST exactly match from the provided lists
- Reference specific things from the posts and comments — no generic advice`;
}

// ── Component ─────────────────────────────────────────────────────────────

type IntelView = 'list' | 'new' | 'loading' | 'report';
type LoadingStep = 'posts' | 'comments' | 'analysis';
type ReportTab = 'overview' | 'posts' | 'actions';

const STEP_LABELS: Record<LoadingStep, string> = {
  posts: 'Fetching recent posts from Instagram…',
  comments: 'Scraping comments on top posts…',
  analysis: 'Generating AI-powered report…',
};
const STEPS: LoadingStep[] = ['posts', 'comments', 'analysis'];

interface Props {
  brandIdentity: BrandIdentity;
  themes: string[];
  contentTypes: string[];
  reports: CompetitorReport[];
  apifyApiKey: string;
  language: AppLanguage;
  onAddReport: (report: Omit<CompetitorReport, 'id' | 'createdAt'>) => Promise<void>;
  onDeleteReport: (id: string) => Promise<void>;
  onAddToMatrix: (idea: Omit<MatrixIdea, 'id'>) => Promise<void>;
  onNavigateToMatrix: () => void;
}

export default function CompetitorIntel({
  brandIdentity, themes, contentTypes, reports, apifyApiKey,
  onAddReport, onDeleteReport, onAddToMatrix, onNavigateToMatrix,
}: Props) {
  const [view, setView] = useState<IntelView>('list');
  const [handle, setHandle] = useState('');
  const [loadingStep, setLoadingStep] = useState<LoadingStep>('posts');
  const [error, setError] = useState('');
  const [activeReport, setActiveReport] = useState<CompetitorReport | null>(null);
  const [reportTab, setReportTab] = useState<ReportTab>('overview');
  const [addedToMatrix, setAddedToMatrix] = useState<Set<number>>(new Set());

  const noKey = !apifyApiKey;

  const runAnalysis = async () => {
    const cleanHandle = handle.replace(/^@/, '').trim();
    if (!cleanHandle) return;

    setError('');
    setView('loading');
    setLoadingStep('posts');

    try {
      // 1. Scrape posts
      const postsRun = await apifyRun(
        'apify~instagram-scraper',
        {
          directUrls: [`https://www.instagram.com/${cleanHandle}/`],
          resultsType: 'posts',
          resultsLimit: 20,
        },
        apifyApiKey,
      );

      const rawPosts = await apifyGetItems<Record<string, unknown>>(postsRun.defaultDatasetId, apifyApiKey);

      if (!rawPosts.length) throw new Error(`No posts found for @${cleanHandle}. Check the handle and try again.`);

      // 2. Score and pick top 3
      const allPosts = rawPosts.map(mapPost);
      const topPosts = [...allPosts]
        .sort((a, b) => b.engagementScore - a.engagementScore)
        .slice(0, 3);

      setLoadingStep('comments');

      // 3. Scrape comments for all top posts in parallel
      const commentRuns = await Promise.allSettled(
        topPosts.map(post =>
          apifyRun(
            'apify~instagram-comment-scraper',
            {
              directUrls: [post.url || `https://www.instagram.com/p/${post.shortCode}/`],
              resultsLimit: 50,
            },
            apifyApiKey,
          ),
        ),
      );

      // 4. Fetch comment data
      const commentData = await Promise.allSettled(
        commentRuns.map(result =>
          result.status === 'fulfilled'
            ? apifyGetItems<Record<string, unknown>>(result.value.defaultDatasetId, apifyApiKey)
            : Promise.resolve([]),
        ),
      );

      // 5. Attach comments to posts
      commentData.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          topPosts[i].comments = result.value.map(mapComment);
        }
      });

      setLoadingStep('analysis');

      // 6. AI analysis via OpenRouter
      const orKey = import.meta.env.VITE_OPENROUTER_API_KEY as string;
      const openai = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: orKey,
        dangerouslyAllowBrowser: true,
      });

      const prompt = buildIntelPrompt(cleanHandle, topPosts, brandIdentity, themes, contentTypes);

      const aiResponse = await openai.chat.completions.create({
        model: 'arcee-ai/trinity-large-preview:free',
        messages: [
          { role: 'system', content: 'You are a strategic content analyst. Return only valid JSON, no markdown fences.' },
          { role: 'user', content: prompt },
        ],
      });

      const rawContent = aiResponse.choices[0].message.content ?? '{}';
      // Strip possible markdown fences
      const jsonStr = rawContent.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();
      const reportData = JSON.parse(jsonStr) as CompetitorReportData;

      const newReport: Omit<CompetitorReport, 'id' | 'createdAt'> = {
        competitorHandle: cleanHandle,
        postsAnalyzed: allPosts.length,
        topPosts,
        report: reportData,
      };

      await onAddReport(newReport);

      // Show the saved report (it'll now be first in the list)
      setActiveReport({
        ...newReport,
        id: 'temp',
        createdAt: new Date().toISOString(),
      });
      setReportTab('overview');
      setAddedToMatrix(new Set());
      setView('report');
    } catch (e) {
      console.error('Intel analysis failed', e);
      const msg = e instanceof Error ? e.message : 'Unexpected error. Please try again.';
      setError(msg);
      setView('new');
    }
  };

  const openReport = (report: CompetitorReport) => {
    setActiveReport(report);
    setReportTab('overview');
    setAddedToMatrix(new Set());
    setView('report');
  };

  const addIdeaToMatrix = async (idea: IntelActionablePost, index: number) => {
    const theme = themes.find(t => t.toLowerCase() === idea.theme.toLowerCase()) ?? themes[0] ?? idea.theme;
    const type = contentTypes.find(t => t.toLowerCase() === idea.type.toLowerCase()) ?? contentTypes[0] ?? idea.type;
    await onAddToMatrix({ theme, type, title: idea.title, done: false });
    setAddedToMatrix(prev => new Set([...prev, index]));
  };

  // ── Render: no key warning ───────────────────────────────────────────────
  if (noKey && view === 'list') {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Competitor Intel</h1>
        <p className="text-slate-500 text-sm mb-6">Analyze what works for competitors and adapt it to your brand.</p>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 space-y-3">
          <div className="flex items-center gap-2 text-orange-700">
            <Telescope className="w-5 h-5" />
            <p className="font-semibold">Apify token required</p>
          </div>
          <p className="text-sm text-orange-600 leading-relaxed">
            Competitor Intel uses Apify to scrape Instagram data. Add your Apify API token
            in <strong>Settings</strong> to unlock this feature. A free plan includes enough
            credits for regular use.
          </p>
        </div>
      </div>
    );
  }

  // ── Render: loading ──────────────────────────────────────────────────────
  if (view === 'loading') {
    const stepIndex = STEPS.indexOf(loadingStep);
    return (
      <div className="p-6 max-w-xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Competitor Intel</h1>
        <p className="text-slate-500 text-sm mb-8">Analyzing <strong>@{handle.replace(/^@/, '')}</strong>…</p>
        <div className="bg-white rounded-xl border border-slate-200 p-8 space-y-6">
          <div className="flex items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-orange-100 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-orange-500 animate-spin" />
            </div>
          </div>
          <div className="space-y-4">
            {STEPS.map((step, i) => {
              const done = i < stepIndex;
              const active = i === stepIndex;
              return (
                <div key={step} className={`flex items-center gap-3 ${active ? 'text-slate-900' : done ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold
                    ${done ? 'bg-emerald-100' : active ? 'bg-orange-100' : 'bg-slate-100'}`}>
                    {done ? <CheckCircle className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className={`text-sm ${active ? 'font-medium' : ''}`}>{STEP_LABELS[step]}</span>
                  {active && <Loader2 className="w-3.5 h-3.5 animate-spin ml-auto text-orange-400" />}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-400 text-center">
            Instagram scraping takes 2–4 minutes. Please keep this tab open.
          </p>
        </div>
      </div>
    );
  }

  // ── Render: new analysis form ────────────────────────────────────────────
  if (view === 'new') {
    return (
      <div className="p-6 max-w-xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setView('list'); setError(''); setHandle(''); }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">New Analysis</h1>
            <p className="text-slate-500 text-sm">Enter a competitor's Instagram handle</p>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-xl p-4">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <p className="text-sm text-rose-700">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Instagram Handle</label>
            <div className="mt-2 flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">@</span>
                <input
                  type="text"
                  value={handle}
                  onChange={e => setHandle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handle.trim() && runAnalysis()}
                  placeholder="garyvee"
                  className="w-full pl-7 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                  autoFocus
                />
              </div>
              <button
                onClick={runAnalysis}
                disabled={!handle.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-40 shrink-0"
              >
                <Search className="w-4 h-4" />
                Analyze
              </button>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-slate-600">What happens:</p>
            <div className="space-y-1.5">
              {[
                'Scrapes their last 20 posts with engagement metrics',
                'Identifies the top 3 by engagement score',
                'Scrapes up to 50 comments per top post',
                'Runs AI analysis grounded in YOUR brand identity & ICP',
                'Returns: what to steal, what to avoid, 5 ready-to-use post ideas',
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-slate-500">
                  <ChevronRight className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: full report ──────────────────────────────────────────────────
  if (view === 'report' && activeReport) {
    const { report, topPosts, competitorHandle, postsAnalyzed, createdAt } = activeReport;

    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView('list')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-slate-900">@{competitorHandle}</h1>
            <p className="text-slate-500 text-sm">
              {postsAnalyzed} posts scraped · {topPosts.length} analyzed ·{' '}
              {new Date(createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          {(['overview', 'posts', 'actions'] as ReportTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setReportTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                reportTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'overview' ? 'Strategy' : tab === 'posts' ? 'Top Posts' : 'Action Plan'}
            </button>
          ))}
        </div>

        {/* ── Tab: Overview/Strategy ── */}
        {reportTab === 'overview' && (
          <div className="space-y-5">
            {/* Overall analysis */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <BarChart2 className="w-4 h-4 text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-700">Strategic Summary</h2>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{report.overallAnalysis}</p>
              {report.audienceSignals?.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Audience signals from comments</p>
                  {report.audienceSignals.map((signal, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-slate-600">
                      <MessageSquare className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                      {signal}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* What to DO */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <h2 className="text-sm font-semibold text-slate-700">What to DO — ICP-Aligned Tactics</h2>
              </div>
              <div className="space-y-4">
                {report.whatToDo?.map((item, i) => (
                  <div key={i} className="border-l-2 border-emerald-400 pl-4 space-y-1">
                    <p className="text-sm font-semibold text-slate-900">{item.tactic}</p>
                    <p className="text-xs text-slate-600 leading-relaxed">{item.reasoning}</p>
                    <div className="flex items-start gap-1.5 mt-1">
                      <span className="text-xs text-emerald-600 font-medium shrink-0">Evidence:</span>
                      <span className="text-xs text-slate-500">{item.evidence}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* What NOT to do */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <XCircle className="w-4 h-4 text-rose-500" />
                <h2 className="text-sm font-semibold text-slate-700">What NOT to Do — Brand Misalignments</h2>
              </div>
              <div className="space-y-4">
                {report.whatNotToDo?.map((item, i) => (
                  <div key={i} className="border-l-2 border-rose-300 pl-4 space-y-1">
                    <p className="text-sm font-semibold text-slate-900">{item.pattern}</p>
                    <p className="text-xs text-slate-600 leading-relaxed">{item.reason}</p>
                    <div className="flex items-start gap-1.5 mt-1">
                      <span className="text-xs text-rose-600 font-medium shrink-0">ICP conflict:</span>
                      <span className="text-xs text-slate-500">{item.icpConflict}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Top Posts ── */}
        {reportTab === 'posts' && (
          <div className="space-y-4">
            {topPosts.map((post, i) => (
              <div key={post.id} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold shrink-0">
                      #{i + 1}
                    </div>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Top post by engagement</span>
                  </div>
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium shrink-0"
                  >
                    View →
                  </a>
                </div>

                {/* Metrics */}
                <div className="flex gap-3 flex-wrap">
                  <Metric icon={<Heart className="w-3.5 h-3.5 text-rose-500" />} label={post.likesCount.toLocaleString()} sub="likes" />
                  <Metric icon={<MessageSquare className="w-3.5 h-3.5 text-indigo-500" />} label={post.commentsCount.toLocaleString()} sub="comments" />
                  {post.videoViewCount > 0 && (
                    <Metric icon={<Eye className="w-3.5 h-3.5 text-slate-500" />} label={post.videoViewCount.toLocaleString()} sub="views" />
                  )}
                  <Metric icon={<TrendingUp className="w-3.5 h-3.5 text-orange-500" />} label={Math.round(post.engagementScore).toLocaleString()} sub="score" />
                </div>

                {/* Caption */}
                {post.caption && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-4">{post.caption}</p>
                  </div>
                )}

                {/* Comments sample */}
                {post.comments.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-2">Sample comments ({post.comments.length} scraped)</p>
                    <div className="space-y-1.5">
                      {post.comments.slice(0, 5).map((c) => (
                        <div key={c.id} className="flex items-start gap-2">
                          <span className="text-xs font-medium text-slate-500 shrink-0">@{c.ownerUsername}:</span>
                          <span className="text-xs text-slate-600 line-clamp-1">{c.text}</span>
                        </div>
                      ))}
                      {post.comments.length > 5 && (
                        <p className="text-xs text-slate-400">+{post.comments.length - 5} more comments analyzed</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Tab: Action Plan ── */}
        {reportTab === 'actions' && (
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
              <Lightbulb className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
              <p className="text-xs text-orange-700 leading-relaxed">
                These 5 ideas adapt <strong>@{competitorHandle}</strong>'s winning formula to YOUR brand identity and ICP.
                Click "+ Matrix" to save an idea, or "+ Calendar" to plan it immediately.
              </p>
            </div>

            {report.actionablePosts?.map((idea, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <p className="text-sm font-semibold text-slate-900 leading-tight">{idea.title}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {addedToMatrix.has(i) ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                        <CheckCircle className="w-3.5 h-3.5" /> Added
                      </span>
                    ) : (
                      <button
                        onClick={() => addIdeaToMatrix(idea, i)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Matrix
                      </button>
                    )}
                  </div>
                </div>

                {/* Hook */}
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100 rounded-lg p-3">
                  <span className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Hook</span>
                  <p className="text-sm text-slate-800 font-medium mt-0.5 italic">"{idea.hook}"</p>
                </div>

                {/* Why + Angle */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="text-xs font-semibold text-slate-600">Why it works for your ICP</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{idea.why}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-xs font-semibold text-slate-600">Your differentiating angle</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{idea.angle}</p>
                  </div>
                </div>

                {/* Theme + Type chips */}
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full font-medium">{idea.theme}</span>
                  <span className="text-xs px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full font-medium">{idea.type}</span>
                </div>
              </div>
            ))}

            {addedToMatrix.size > 0 && (
              <button
                onClick={onNavigateToMatrix}
                className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-indigo-200 rounded-xl text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
                View {addedToMatrix.size} idea{addedToMatrix.size > 1 ? 's' : ''} in Strategy Matrix
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Render: list ─────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Competitor Intel</h1>
          <p className="text-slate-500 text-sm mt-1">Analyze what's working for competitors. Adapt it for your brand.</p>
        </div>
        <button
          onClick={() => { setView('new'); setHandle(''); setError(''); }}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors shrink-0"
        >
          <Search className="w-4 h-4" />
          New Analysis
        </button>
      </div>

      {reports.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-14 text-center space-y-4">
          <div className="w-12 h-12 mx-auto bg-orange-100 rounded-2xl flex items-center justify-center">
            <Telescope className="w-6 h-6 text-orange-500" />
          </div>
          <div>
            <p className="text-slate-700 font-semibold">No analyses yet</p>
            <p className="text-slate-400 text-sm mt-1">
              Enter a competitor's Instagram handle to generate your first intelligence report.
            </p>
          </div>
          <button
            onClick={() => { setView('new'); setHandle(''); setError(''); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors"
          >
            <Search className="w-4 h-4" />
            Analyze a Competitor
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map(report => (
            <div
              key={report.id}
              className="bg-white rounded-xl border border-slate-200 px-5 py-4 hover:border-orange-300 hover:shadow-md transition-all group flex items-center gap-4"
            >
              <button
                className="flex-1 text-left flex items-center gap-4"
                onClick={() => openReport(report)}
              >
                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                  <Telescope className="w-5 h-5 text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">@{report.competitorHandle}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {report.postsAnalyzed} posts · {report.report.actionablePosts?.length ?? 0} ideas ·{' '}
                    {new Date(report.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex gap-1.5">
                    <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-medium">
                      {report.report.whatToDo?.length ?? 0} tactics
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-rose-50 text-rose-700 rounded-full font-medium">
                      {report.report.whatNotToDo?.length ?? 0} avoid
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-orange-400 transition-colors" />
                </div>
              </button>
              <button
                onClick={() => onDeleteReport(report.id)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────

function Metric({ icon, label, sub }: { icon: React.ReactNode; label: string; sub: string }) {
  return (
    <div className="flex items-center gap-1.5 bg-slate-50 rounded-lg px-3 py-2">
      {icon}
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      <span className="text-xs text-slate-400">{sub}</span>
    </div>
  );
}

// Suppress unused import warnings for icons used conditionally
void Calendar;
void FlaskConical;
