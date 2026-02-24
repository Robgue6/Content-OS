import { useState } from 'react';
import {
  ArrowLeft, Telescope, Search, Loader2, TrendingUp, MessageSquare,
  Heart, Eye, Plus, Trash2, CheckCircle, AlertCircle, Lightbulb,
  ChevronRight, BarChart2, Target, XCircle, Microscope, Code2, Brain, Layers,
  Users, Hash, FileText, ChevronDown, ChevronUp, ImageOff, Play,
} from 'lucide-react';
import OpenAI from 'openai';
import type {
  BrandIdentity, CompetitorReport, CompetitorPost, CompetitorComment,
  CompetitorReportData, IntelActionablePost, MatrixIdea, AppLanguage,
  CommentAnalysis,
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
  const postType = String(raw.type ?? raw.media_type ?? 'image');
  const thumbnailRaw = String(raw.displayUrl ?? raw.thumbnailUrl ?? raw.thumbnail_url ?? raw.previewUrl ?? '');
  const videoRaw = String(raw.videoUrl ?? raw.video_url ?? raw.videoUrlHd ?? '');
  return {
    id: String(raw.id ?? raw.shortCode ?? Math.random()),
    shortCode: String(raw.shortCode ?? raw.code ?? ''),
    url: String(raw.url ?? raw.postUrl ?? `https://www.instagram.com/p/${raw.shortCode}/`),
    caption: String(raw.caption ?? raw.text ?? '').slice(0, 600),
    likesCount: likes,
    commentsCount: comments,
    videoViewCount: views,
    timestamp: String(raw.timestamp ?? raw.taken_at ?? ''),
    type: postType,
    engagementScore: calcEngagement({ likesCount: likes, commentsCount: comments, videoViewCount: views }),
    comments: [],
    thumbnailUrl: thumbnailRaw || undefined,
    videoUrl: videoRaw || undefined,
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

  return `You are a strategic content analyst and reverse engineering expert. Analyze the top-performing Instagram posts from @${handle} for a brand creator.

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
  ],
  "contentDNA": {
    "dominantHookType": "The hook pattern repeated across their top posts e.g. 'Contrarian claim + specific statistic'",
    "emotionalArc": "The typical emotional journey their content creates e.g. 'Fear → Curiosity → Insight → Relief'",
    "pacingPattern": "Content rhythm and delivery style e.g. 'One punchy point per second, no filler, hard cuts'",
    "ctaStyle": "How they typically close content and drive action",
    "uniqueFormula": "Their repeatable secret sauce in one sentence — what makes every top post work"
  },
  "postBreakdowns": [
    {
      "postIndex": 1,
      "hookFormula": "Hook type classification e.g. 'Pain point + contrarian twist + specific number'",
      "hookText": "The exact or closely paraphrased opening line from the caption",
      "psychologicalTrigger": "Primary psychological mechanism e.g. 'Loss aversion + curiosity gap'",
      "structureArc": "Full content arc e.g. 'Problem → Agitation → Unexpected insight → Social proof → CTA'",
      "whyItWorked": "Psychological explanation for why this specific post drove high engagement"
    }
  ],
  "replicationFormula": {
    "templateName": "A catchy name for this structural pattern e.g. 'The Pain-First Proof Formula'",
    "template": "Step-by-step fill-in-the-blank template e.g. '[State their biggest fear] → [Agitate with surprising detail] → [Deliver unexpected insight] → [Back with evidence] → [One clear CTA]'",
    "adaptedForYourBrand": "How to apply this exact template to the user's specific ICP, positioning and tone",
    "exampleHook": "A concrete ready-to-use opening hook written specifically for the user's brand voice and ICP"
  }
}

Rules:
- whatToDo: 3-4 tactics that ARE aligned with the user's ICP/positioning
- whatNotToDo: 2-3 patterns the competitor uses that DON'T fit this user's brand — be specific and honest
- actionablePosts: exactly 5 ideas adapting the competitor's winning formula to this user's brand
- theme/type for actionablePosts MUST exactly match from the provided lists
- postBreakdowns: one entry per post analyzed (${topPosts.length} total), postIndex is 1-based
- contentDNA and replicationFormula must be grounded in THESE specific posts, not generic platitudes
- replicationFormula.exampleHook must be written in the user's brand voice targeting their specific ICP
- Reference specific things from the posts and comments — no generic advice`;
}

// ── Comment Analysis prompt ────────────────────────────────────────────────

function buildCommentAnalysisPrompt(
  handle: string,
  topPosts: CompetitorPost[],
  brandIdentity: BrandIdentity,
  themes: string[],
  contentTypes: string[],
): string {
  const allComments = topPosts.map((post, i) => {
    const lines = post.comments.map(c => `  - "${c.text}"`).join('\n');
    return `POST ${i + 1} (${post.likesCount.toLocaleString()} likes · ${post.commentsCount.toLocaleString()} comments):\n${lines || '  (no comments scraped)'}`;
  }).join('\n\n');

  const totalComments = topPosts.reduce((sum, p) => sum + p.comments.length, 0);

  return `You are an expert community analyst and content strategist. Analyze ${totalComments} scraped comments from @${handle}'s top Instagram posts to extract deep audience intelligence for a brand creator.

=== USER'S BRAND IDENTITY ===
ICP: ${brandIdentity.icp || 'Not defined'}
Positioning: ${brandIdentity.positioning || 'Not defined'}
Voice & Tone: ${brandIdentity.tone || 'Not defined'}
Audience Pains: ${brandIdentity.empathyMap?.pains || 'Not defined'}
Audience Gains: ${brandIdentity.empathyMap?.gains || 'Not defined'}
Audience Fears: ${brandIdentity.empathyMap?.fears || 'Not defined'}
Audience Hopes: ${brandIdentity.empathyMap?.hopes || 'Not defined'}
Content Themes: ${themes.join(', ') || 'Not set'}
Content Formats: ${contentTypes.join(', ') || 'Not set'}

=== ALL SCRAPED COMMENTS ===
${allComments}

=== TASK ===
Return ONLY a valid JSON object with this exact structure:
{
  "sentimentSummary": "2-3 sentence paragraph on the emotional tone, engagement quality, and what drives this community",
  "audienceVocabulary": ["word or phrase 1", "word or phrase 2"],
  "recurringThemes": [
    {
      "category": "pain_point",
      "insight": "Clear statement of the recurring insight",
      "quotes": ["exact or near-exact comment excerpt", "another quote"],
      "frequency": "high"
    }
  ],
  "contentGaps": ["Specific topic or angle the audience keeps asking for but isn't getting", "..."],
  "scriptedIdeas": [
    {
      "title": "Post title in the user's brand voice",
      "hook": "Opening line — the exact first words of the video (make it punchy, under 15 words)",
      "bodyPoints": ["Key point 1 with specifics", "Key point 2", "Key point 3"],
      "cta": "Specific, single call to action",
      "why": "Why this will resonate with the user's ICP based on the comments",
      "theme": "MUST be exactly one of: ${themes.join(' | ')}",
      "type": "MUST be exactly one of: ${contentTypes.join(' | ')}"
    }
  ]
}

Rules:
- audienceVocabulary: 8-12 specific words/phrases this audience uses repeatedly — great for captions and hooks
- recurringThemes: 4-6 items, each a different category. category MUST be one of: pain_point | desire | question | praise | objection
- quotes: use ACTUAL text from the comments provided — do not fabricate
- frequency: "high" = appears in many comments, "medium" = several, "low" = notable but rare
- contentGaps: 3-4 specific unmet needs expressed by commenters — what they want but aren't getting
- scriptedIdeas: exactly 5 fully written, ready-to-use post ideas using the audience's own language
- bodyPoints: 3-4 specific, substantive bullet points — not placeholders, real content the creator can say
- theme/type for scriptedIdeas MUST exactly match from the provided lists
- Ground everything in the actual comments — no generic marketing advice`;
}

// ── Component ─────────────────────────────────────────────────────────────

type IntelView = 'list' | 'new' | 'loading' | 'report';
type LoadingStep = 'posts' | 'comments' | 'analysis';
type ReportTab = 'overview' | 'posts' | 'reverse' | 'audience' | 'actions';

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
  onUpdateReport: (id: string, reportData: CompetitorReportData) => Promise<void>;
  onAddToMatrix: (idea: Omit<MatrixIdea, 'id'>) => Promise<void>;
  onNavigateToMatrix: () => void;
}

export default function CompetitorIntel({
  brandIdentity, themes, contentTypes, reports, apifyApiKey,
  onAddReport, onDeleteReport, onUpdateReport, onAddToMatrix, onNavigateToMatrix,
}: Props) {
  const [view, setView] = useState<IntelView>('list');
  const [handle, setHandle] = useState('');
  const [loadingStep, setLoadingStep] = useState<LoadingStep>('posts');
  const [error, setError] = useState('');
  const [activeReport, setActiveReport] = useState<CompetitorReport | null>(null);
  const [reportTab, setReportTab] = useState<ReportTab>('overview');
  const [addedToMatrix, setAddedToMatrix] = useState<Set<number>>(new Set());
  const [commentAnalysisLoading, setCommentAnalysisLoading] = useState(false);
  const [commentAnalysisError, setCommentAnalysisError] = useState('');
  const [expandedScript, setExpandedScript] = useState<number | null>(null);
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());
  const [playingVideos, setPlayingVideos] = useState<Set<string>>(new Set());

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
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are a strategic content analyst. Return only valid JSON. No markdown, no preamble, no explanation — only the JSON object.' },
          { role: 'user', content: prompt },
        ],
      });

      const rawContent = aiResponse.choices[0].message.content ?? '{}';
      // Extract the outermost JSON object — handles fences, preamble, and trailing text
      const start = rawContent.indexOf('{');
      const end = rawContent.lastIndexOf('}');
      const jsonStr = start !== -1 && end > start
        ? rawContent.slice(start, end + 1)
        : rawContent.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();
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
    setCommentAnalysisError('');
    setExpandedScript(null);
    setView('report');
  };

  const runCommentAnalysis = async () => {
    if (!activeReport) return;
    const totalComments = activeReport.topPosts.reduce((s, p) => s + p.comments.length, 0);
    if (totalComments === 0) {
      setCommentAnalysisError('No comments were scraped for this report. Re-run the analysis to capture comments.');
      return;
    }
    setCommentAnalysisLoading(true);
    setCommentAnalysisError('');
    try {
      const orKey = import.meta.env.VITE_OPENROUTER_API_KEY as string;
      const openai = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: orKey,
        dangerouslyAllowBrowser: true,
      });
      const prompt = buildCommentAnalysisPrompt(
        activeReport.competitorHandle,
        activeReport.topPosts,
        brandIdentity,
        themes,
        contentTypes,
      );
      const aiResponse = await openai.chat.completions.create({
        model: 'arcee-ai/trinity-large-preview:free',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are a community analyst. Return only valid JSON, no markdown, no preamble.' },
          { role: 'user', content: prompt },
        ],
      });
      const raw = aiResponse.choices[0].message.content ?? '{}';
      const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
      const commentAnalysis = JSON.parse(s !== -1 && e > s ? raw.slice(s, e + 1) : raw) as CommentAnalysis;

      const updatedReportData: CompetitorReportData = { ...activeReport.report, commentAnalysis };
      setActiveReport(prev => prev ? { ...prev, report: updatedReportData } : prev);

      // Persist — find real DB ID (activeReport may have id='temp' right after creation)
      const realId = reports.find(r => r.competitorHandle === activeReport.competitorHandle)?.id;
      if (realId && realId !== 'temp') {
        await onUpdateReport(realId, updatedReportData);
      }
    } catch (e) {
      console.error('Comment analysis failed', e);
      setCommentAnalysisError(e instanceof Error ? e.message : 'Analysis failed. Please try again.');
    } finally {
      setCommentAnalysisLoading(false);
    }
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
          {(['overview', 'posts', 'reverse', 'audience', 'actions'] as ReportTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setReportTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                reportTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'overview' ? 'Strategy'
                : tab === 'posts' ? 'Top Posts'
                : tab === 'reverse' ? 'Reverse Eng.'
                : tab === 'audience' ? 'Audience Voice'
                : 'Action Plan'}
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
              <div key={post.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex flex-col lg:flex-row">
                  {/* Post media — native video/image, no redirect */}
                  {(post.videoUrl || post.thumbnailUrl) ? (
                    <div className="lg:w-72 shrink-0 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-200 overflow-hidden rounded-tl-xl rounded-bl-xl bg-slate-950">
                      <div className="flex-1 flex items-center justify-center min-h-56">
                        {post.videoUrl ? (
                          playingVideos.has(post.id) ? (
                            <video
                              src={post.videoUrl}
                              poster={post.thumbnailUrl}
                              controls
                              autoPlay
                              playsInline
                              className="w-full max-h-96 object-contain"
                            />
                          ) : post.thumbnailUrl && !brokenImages.has(post.id) ? (
                            <div
                              className="relative w-full cursor-pointer group"
                              onClick={() => setPlayingVideos(prev => new Set([...prev, post.id]))}
                            >
                              <img
                                src={post.thumbnailUrl}
                                alt={`Post #${i + 1} thumbnail`}
                                className="w-full max-h-96 object-cover"
                                onError={() => setBrokenImages(prev => new Set([...prev, post.id]))}
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/45 transition-colors">
                                <div className="w-14 h-14 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform duration-150">
                                  <Play className="w-6 h-6 text-slate-900 ml-1" />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <video
                              src={post.videoUrl}
                              controls
                              playsInline
                              preload="none"
                              className="w-full max-h-96 object-contain"
                            />
                          )
                        ) : !brokenImages.has(post.id) ? (
                          <img
                            src={post.thumbnailUrl}
                            alt={`Post #${i + 1} by @${competitorHandle}`}
                            className="w-full max-h-96 object-cover"
                            onError={() => setBrokenImages(prev => new Set([...prev, post.id]))}
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center w-full h-56">
                            <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center">
                              <ImageOff className="w-6 h-6 text-slate-500" />
                            </div>
                            <div>
                              <p className="text-xs font-medium text-slate-400">Image unavailable</p>
                              <p className="text-xs text-slate-500 mt-0.5">CDN link may have expired</p>
                            </div>
                            <a
                              href={post.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
                            >
                              View on Instagram ↗
                            </a>
                          </div>
                        )}
                      </div>
                      <div className="px-3 py-1.5 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
                        <span className="text-xs text-slate-400 capitalize font-medium">{post.type}</span>
                        {post.videoUrl && <span className="text-xs text-slate-600 ml-auto">▶ video</span>}
                      </div>
                    </div>
                  ) : post.shortCode ? (
                    <div className="lg:w-72 shrink-0 bg-slate-50 border-b lg:border-b-0 lg:border-r border-slate-200 flex items-center justify-center p-4">
                      <iframe
                        src={`https://www.instagram.com/p/${post.shortCode}/embed/`}
                        width="280"
                        height="380"
                        style={{ border: 0 }}
                        className="rounded-xl"
                        title={`Post #${i + 1} by @${competitorHandle}`}
                      />
                    </div>
                  ) : null}

                  {/* Metrics and analysis */}
                  <div className="flex-1 p-5 space-y-4">
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
                        className="text-xs text-slate-400 hover:text-indigo-600 transition-colors shrink-0"
                        title="Open on Instagram"
                      >
                        ↗
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
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Tab: Reverse Engineering ── */}
        {reportTab === 'reverse' && (
          <div className="space-y-6">
            {/* Content DNA */}
            {report.contentDNA && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Layers className="w-4 h-4 text-violet-500" />
                  <h2 className="text-sm font-semibold text-slate-700">Content DNA — @{competitorHandle}'s Repeatable Formula</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-rose-50 rounded-xl p-4 border border-rose-100">
                    <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide mb-1">Dominant Hook Type</p>
                    <p className="text-sm text-slate-800">{report.contentDNA.dominantHookType}</p>
                  </div>
                  <div className="bg-violet-50 rounded-xl p-4 border border-violet-100">
                    <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide mb-1">Emotional Arc</p>
                    <p className="text-sm text-slate-800">{report.contentDNA.emotionalArc}</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Pacing Pattern</p>
                    <p className="text-sm text-slate-800">{report.contentDNA.pacingPattern}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">CTA Style</p>
                    <p className="text-sm text-slate-800">{report.contentDNA.ctaStyle}</p>
                  </div>
                </div>
                {report.contentDNA.uniqueFormula && (
                  <div className="mt-4 bg-gradient-to-r from-violet-50 to-indigo-50 rounded-xl p-4 border border-violet-100">
                    <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide mb-1">Secret Sauce</p>
                    <p className="text-sm text-slate-900 font-medium">{report.contentDNA.uniqueFormula}</p>
                  </div>
                )}
              </div>
            )}

            {/* Hook-by-Hook Breakdowns */}
            {(report.postBreakdowns?.length ?? 0) > 0 && (
              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Microscope className="w-4 h-4 text-orange-500" />
                  Hook-by-Hook Breakdown
                </h2>
                {report.postBreakdowns!.map((breakdown, i) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold shrink-0">
                        #{breakdown.postIndex}
                      </div>
                      <p className="text-sm font-semibold text-slate-900">{breakdown.hookFormula}</p>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-3 border-l-4 border-orange-400">
                      <p className="text-xs font-semibold text-slate-500 mb-1">Opening Line</p>
                      <p className="text-sm text-slate-800 italic">"{breakdown.hookText}"</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Brain className="w-3.5 h-3.5 text-violet-500" />
                          <span className="text-xs font-semibold text-slate-600">Psychological Trigger</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{breakdown.psychologicalTrigger}</p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-blue-500" />
                          <span className="text-xs font-semibold text-slate-600">Structure Arc</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed font-mono">{breakdown.structureArc}</p>
                      </div>
                    </div>

                    <div className="bg-amber-50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-amber-700 mb-1">Why it worked</p>
                      <p className="text-xs text-slate-700 leading-relaxed">{breakdown.whyItWorked}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Replication Formula */}
            {report.replicationFormula && (
              <div className="bg-gradient-to-br from-indigo-900 to-violet-900 rounded-xl p-6 text-white space-y-4">
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-indigo-300" />
                  <p className="text-xs font-semibold text-indigo-300 uppercase tracking-wide">Replication Formula</p>
                </div>
                <p className="text-xl font-bold">{report.replicationFormula.templateName}</p>
                <div className="bg-white/10 rounded-xl p-4">
                  <p className="text-sm font-mono text-indigo-100 leading-relaxed">{report.replicationFormula.template}</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-indigo-300 mb-1">Adapted for your brand</p>
                    <p className="text-sm text-indigo-100 leading-relaxed">{report.replicationFormula.adaptedForYourBrand}</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4">
                    <p className="text-xs font-semibold text-indigo-300 mb-2">Ready-to-use hook for your ICP</p>
                    <p className="text-sm text-white font-medium italic">"{report.replicationFormula.exampleHook}"</p>
                  </div>
                </div>
              </div>
            )}

            {!report.contentDNA && !report.postBreakdowns?.length && !report.replicationFormula && (
              <div className="text-center py-14">
                <div className="w-12 h-12 mx-auto bg-slate-100 rounded-2xl flex items-center justify-center mb-3">
                  <Microscope className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-slate-500 font-medium text-sm">Reverse engineering not available</p>
                <p className="text-slate-400 text-xs mt-1">Run a new analysis to unlock the full Content DNA breakdown.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Audience Voice ── */}
        {reportTab === 'audience' && (
          <div className="space-y-6">
            {!activeReport.report.commentAnalysis ? (
              /* Empty state — trigger analysis */
              <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-5">
                <div className="w-14 h-14 mx-auto bg-indigo-100 rounded-2xl flex items-center justify-center">
                  <Users className="w-7 h-7 text-indigo-500" />
                </div>
                <div>
                  <p className="text-slate-800 font-semibold text-base">Deep Comment Analysis</p>
                  <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto leading-relaxed">
                    Run AI analysis on all {activeReport.topPosts.reduce((s, p) => s + p.comments.length, 0)} scraped comments to uncover audience psychology, content gaps, and 5 fully scripted post ideas.
                  </p>
                </div>
                {commentAnalysisError && (
                  <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3 text-left max-w-sm mx-auto">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-rose-700">{commentAnalysisError}</p>
                  </div>
                )}
                <button
                  onClick={runCommentAnalysis}
                  disabled={commentAnalysisLoading}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {commentAnalysisLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing comments…</>
                    : <><Users className="w-4 h-4" /> Analyze Audience Voice</>}
                </button>
              </div>
            ) : (
              <>
                {/* Sentiment Summary */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquare className="w-4 h-4 text-indigo-500" />
                    <h2 className="text-sm font-semibold text-slate-700">Community Sentiment</h2>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{activeReport.report.commentAnalysis.sentimentSummary}</p>
                </div>

                {/* Audience Vocabulary */}
                {(activeReport.report.commentAnalysis.audienceVocabulary?.length ?? 0) > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Hash className="w-4 h-4 text-violet-500" />
                      <h2 className="text-sm font-semibold text-slate-700">Audience Vocabulary — use these words in your captions & hooks</h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {activeReport.report.commentAnalysis.audienceVocabulary.map((word, i) => (
                        <span key={i} className="px-3 py-1.5 bg-violet-50 border border-violet-200 text-violet-800 rounded-full text-xs font-medium">
                          {word}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recurring Themes */}
                {(activeReport.report.commentAnalysis.recurringThemes?.length ?? 0) > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-4 h-4 text-orange-500" />
                      <h2 className="text-sm font-semibold text-slate-700">Recurring Themes from Comments</h2>
                    </div>
                    {activeReport.report.commentAnalysis.recurringThemes.map((theme, i) => {
                      const catColors: Record<string, string> = {
                        pain_point: 'bg-rose-100 text-rose-700',
                        desire: 'bg-emerald-100 text-emerald-700',
                        question: 'bg-blue-100 text-blue-700',
                        praise: 'bg-amber-100 text-amber-700',
                        objection: 'bg-orange-100 text-orange-700',
                      };
                      const freqColors: Record<string, string> = {
                        high: 'bg-rose-50 text-rose-600 border-rose-200',
                        medium: 'bg-amber-50 text-amber-600 border-amber-200',
                        low: 'bg-slate-50 text-slate-500 border-slate-200',
                      };
                      const catLabel: Record<string, string> = {
                        pain_point: 'Pain Point', desire: 'Desire', question: 'Question',
                        praise: 'Praise', objection: 'Objection',
                      };
                      return (
                        <div key={i} className="border-l-2 border-indigo-300 pl-4 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${catColors[theme.category] ?? 'bg-slate-100 text-slate-600'}`}>
                              {catLabel[theme.category] ?? theme.category}
                            </span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${freqColors[theme.frequency] ?? 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                              {theme.frequency} frequency
                            </span>
                          </div>
                          <p className="text-sm font-medium text-slate-900">{theme.insight}</p>
                          {theme.quotes?.length > 0 && (
                            <div className="space-y-1">
                              {theme.quotes.map((q, qi) => (
                                <p key={qi} className="text-xs text-slate-500 italic border-l-2 border-slate-200 pl-2">"{q}"</p>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Content Gaps */}
                {(activeReport.report.commentAnalysis.contentGaps?.length ?? 0) > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="w-4 h-4 text-rose-500" />
                      <h2 className="text-sm font-semibold text-slate-700">Content Gaps — what the audience wants but isn't getting</h2>
                    </div>
                    <div className="space-y-2">
                      {activeReport.report.commentAnalysis.contentGaps.map((gap, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <div className="w-5 h-5 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</div>
                          <p className="text-sm text-slate-700 leading-relaxed">{gap}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Scripted Post Ideas */}
                {(activeReport.report.commentAnalysis.scriptedIdeas?.length ?? 0) > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-600" />
                      <h2 className="text-sm font-semibold text-slate-700">5 Scripted Post Ideas — ready to film</h2>
                    </div>
                    {activeReport.report.commentAnalysis.scriptedIdeas.map((idea, i) => {
                      const isOpen = expandedScript === i;
                      return (
                        <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                          {/* Header row — always visible */}
                          <button
                            onClick={() => setExpandedScript(isOpen ? null : i)}
                            className="w-full flex items-start gap-3 p-5 text-left hover:bg-slate-50 transition-colors"
                          >
                            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                              {i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-900 leading-tight">{idea.title}</p>
                              <p className="text-xs text-slate-500 mt-1 italic line-clamp-1">"{idea.hook}"</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 mt-0.5">
                              <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-medium">{idea.theme}</span>
                              <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full font-medium">{idea.type}</span>
                              {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            </div>
                          </button>

                          {/* Expanded script */}
                          {isOpen && (
                            <div className="border-t border-slate-100 p-5 space-y-4 bg-slate-50">
                              {/* Hook */}
                              <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4">
                                <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-1">Hook — first 3 seconds</p>
                                <p className="text-sm text-slate-900 font-medium italic">"{idea.hook}"</p>
                              </div>

                              {/* Body */}
                              {idea.bodyPoints?.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Body</p>
                                  <div className="space-y-2">
                                    {idea.bodyPoints.map((pt, pi) => (
                                      <div key={pi} className="flex items-start gap-2.5">
                                        <span className="text-xs font-bold text-indigo-500 shrink-0 mt-0.5">{pi + 1}.</span>
                                        <p className="text-sm text-slate-700 leading-relaxed">{pt}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* CTA */}
                              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                                <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-1">CTA</p>
                                <p className="text-sm text-slate-800">{idea.cta}</p>
                              </div>

                              {/* Why */}
                              <div className="flex items-start gap-2 text-xs text-slate-500">
                                <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                                <p>{idea.why}</p>
                              </div>

                              {/* Add to matrix */}
                              <button
                                onClick={() => onAddToMatrix({ theme: idea.theme, type: idea.type, title: idea.title, done: false })}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors"
                              >
                                <Plus className="w-3 h-3" /> Add to Matrix
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Re-run button */}
                <button
                  onClick={() => {
                    setActiveReport(prev => prev ? { ...prev, report: { ...prev.report, commentAnalysis: undefined } } : prev);
                    setExpandedScript(null);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Re-run analysis
                </button>
              </>
            )}
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

