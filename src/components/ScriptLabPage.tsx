import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search, Sparkles, Save, Loader2, Copy, CheckCheck, RotateCcw,
  Play, Pause, SkipBack, FileText, Maximize2, Minimize2,
  Tv2, Camera, Rocket, CalendarCheck, AlertTriangle,
  ChevronLeft, ChevronRight, Bot, CheckCircle2, Circle,
  FlaskConical, X, Filter, ArrowRight,
} from 'lucide-react';
import OpenAI from 'openai';
import type { Post, Script, BrandIdentity, AppLanguage, AgentAction } from '../types';
import * as analytics from '../lib/analytics';

const LANGUAGE_NAMES: Record<AppLanguage, string> = { en: 'English', es: 'Spanish', fr: 'French' };

type FilterMode = 'all' | 'needs' | 'done' | 'agent';
type SortMode = 'date' | 'status';
type PreviewMode = 'read' | 'teleprompter' | 'schedule';

interface ScriptSections { hook: string; body: string; cta: string; }

interface AngleCard {
  type: string;
  emoji: string;
  hook: string;
  description: string;
  bestFor: string;
}

interface HookSuggestion {
  hook: string;
  principle: string;
  principleEmoji: string;
  why: string;
}

interface ScriptFix {
  section: 'hook' | 'body' | 'cta';
  original: string;
  proposed: string;
  reason: string;
}

interface ScriptReview {
  score: number;
  summary: string;
  strengths: string[];
  fixes: ScriptFix[];
}

interface Props {
  posts: Post[];
  scripts: Script[];
  brandIdentity: BrandIdentity;
  language: AppLanguage;
  agentActions: AgentAction[];
  initialPostId?: string | null;
  onSave: (script: Omit<Script, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onSchedule: (postId: string, postDate: string, filmingDate?: string) => Promise<void>;
  onClearInitialPost?: () => void;
}

export default function ScriptLabPage({
  posts, scripts, brandIdentity, language, agentActions,
  initialPostId, onSave, onSchedule, onClearInitialPost,
}: Props) {
  // Sidebar state
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [sort, setSort] = useState<SortMode>('date');
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);

  // Editor state
  const [selectedPostId, setSelectedPostId] = useState<string | null>(initialPostId ?? null);
  const [sections, setSections] = useState<ScriptSections>({ hook: '', body: '', cta: '' });
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // Angle Cards
  const [showAnglePicker, setShowAnglePicker] = useState(false);
  const [anglesLoading, setAnglesLoading] = useState(false);
  const [angleCards, setAngleCards] = useState<AngleCard[]>([]);
  const [chosenAngle, setChosenAngle] = useState<AngleCard | null>(null);

  // Hook generator
  const [hooksLoading, setHooksLoading] = useState(false);
  const [hookSuggestions, setHookSuggestions] = useState<HookSuggestion[]>([]);

  // Script reviewer
  const [reviewLoading, setReviewLoading] = useState(false);
  const [review, setReview] = useState<ScriptReview | null>(null);
  const [reviewStep, setReviewStep] = useState(0);

  // Preview panel
  const [previewMode, setPreviewMode] = useState<PreviewMode>('read');
  const [previewOpen, setPreviewOpen] = useState(true);

  // Teleprompter
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(3);
  const teleprompterRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const speedRef = useRef(speed);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  // Fullscreen
  const previewPanelRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) previewPanelRef.current?.requestFullscreen();
    else document.exitFullscreen();
  };
  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  // Teleprompter scroll
  useEffect(() => {
    if (!playing) { cancelAnimationFrame(animFrameRef.current); return; }
    const el = teleprompterRef.current;
    if (!el) return;
    const scroll = () => {
      el.scrollTop += speedRef.current * 0.4;
      if (el.scrollTop < el.scrollHeight - el.clientHeight) {
        animFrameRef.current = requestAnimationFrame(scroll);
      } else { setPlaying(false); }
    };
    animFrameRef.current = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [playing]);

  const resetTeleprompter = () => {
    setPlaying(false);
    if (teleprompterRef.current) teleprompterRef.current.scrollTop = 0;
  };

  // Agent-created post IDs
  const agentPostIds = useMemo(
    () => new Set(agentActions.filter(a => a.actionType === 'add_post').map(a => a.itemId)),
    [agentActions],
  );

  // Derived: script lookup
  const scriptByPostId = useMemo(() => {
    const map = new Map<string, Script>();
    scripts.forEach(s => map.set(s.postId, s));
    return map;
  }, [scripts]);

  // When initialPostId changes, select that post
  useEffect(() => {
    if (initialPostId) {
      setSelectedPostId(initialPostId);
      onClearInitialPost?.();
    }
  }, [initialPostId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load script when post selection changes
  const selectedPost = posts.find(p => p.id === selectedPostId) ?? null;
  const existingScript = selectedPost ? scriptByPostId.get(selectedPost.id) : undefined;

  useEffect(() => {
    if (existingScript) {
      setSections({ hook: existingScript.hook, body: existingScript.body, cta: existingScript.cta });
    } else {
      setSections({ hook: '', body: '', cta: '' });
    }
    setError('');
    setSaved(false);
    setPlaying(false);
    setShowAnglePicker(false);
    setAngleCards([]);
    setChosenAngle(null);
    setHookSuggestions([]);
    setReview(null);
    setReviewStep(0);
  }, [selectedPostId, existingScript?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Unique themes for theme filter chips
  const uniqueThemes = useMemo(
    () => [...new Set(posts.map(p => p.theme))].filter(Boolean).sort(),
    [posts],
  );

  // Filtered & sorted posts
  const filteredPosts = useMemo(() => {
    let list = posts.filter(p => {
      if (search) {
        const q = search.toLowerCase();
        if (!p.title.toLowerCase().includes(q) &&
            !p.theme.toLowerCase().includes(q) &&
            !p.type.toLowerCase().includes(q)) return false;
      }
      if (filter === 'needs') { if (scriptByPostId.has(p.id)) return false; }
      else if (filter === 'done')  { if (!scriptByPostId.has(p.id)) return false; }
      else if (filter === 'agent') { if (!agentPostIds.has(p.id)) return false; }
      if (selectedTheme && p.theme !== selectedTheme) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sort === 'date')   return (a.date ?? '').localeCompare(b.date ?? '');
      if (sort === 'status') {
        const order: Record<string, number> = { IDEA: 0, DRAFT: 1, SCHEDULED: 2 };
        return (order[a.status] ?? 0) - (order[b.status] ?? 0);
      }
      return 0;
    });

    return list;
  }, [posts, scripts, search, filter, sort, selectedTheme, agentPostIds, scriptByPostId]);

  // Stats
  const totalScripted = scripts.length;
  const totalNeed = posts.length - totalScripted;
  const agentCount = agentPostIds.size;

  // Script metrics
  const wordCount = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
  const totalWords = wordCount(sections.hook) + wordCount(sections.body) + wordCount(sections.cta);
  const estSeconds = Math.round(totalWords / 2.5);
  const hasContent = !!(sections.hook || sections.body || sections.cta);
  const fullScript = [sections.hook, sections.body, sections.cta].filter(Boolean).join('\n\n');

  // Section fill progress (0-3)
  const filledSections = [sections.hook, sections.body, sections.cta].filter(Boolean).length;

  const generate = async (angle?: AngleCard) => {
    if (!selectedPost) return;
    const orKey = import.meta.env.VITE_OPENROUTER_API_KEY as string;
    if (!orKey) { setError('OpenRouter API key is not configured.'); return; }
    const isRegenerate = hasContent;
    setLoading(true); setError('');
    try {
      const openai = new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: orKey, dangerouslyAllowBrowser: true });
      const response = await openai.chat.completions.create({
        model: 'arcee-ai/trinity-large-preview:free',
        messages: [
          { role: 'system', content: buildSystem(brandIdentity, language) },
          { role: 'user', content: buildPrompt(selectedPost, brandIdentity, angle) },
        ],
        response_format: { type: 'json_object' },
      });
      const raw = response.choices[0].message.content ?? '{}';
      const parsed: ScriptSections = JSON.parse(raw);
      const next = { hook: parsed.hook ?? '', body: parsed.body ?? '', cta: parsed.cta ?? '' };
      setSections(next);
      const wc = [next.hook, next.body, next.cta].join(' ').trim().split(/\s+/).filter(Boolean).length;
      analytics.trackScriptGenerated(selectedPost.theme, selectedPost.type, wc, isRegenerate);
    } catch (e) {
      console.error(e);
      setError('Generation failed. Check your API key and try again.');
      analytics.trackScriptGenerationFailed(String(e));
    } finally { setLoading(false); }
  };

  const generateAngles = async () => {
    if (!selectedPost) return;
    const orKey = import.meta.env.VITE_OPENROUTER_API_KEY as string;
    if (!orKey) { setError('OpenRouter API key is not configured.'); setShowAnglePicker(false); return; }
    setAnglesLoading(true); setAngleCards([]); setError('');
    try {
      const openai = new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: orKey, dangerouslyAllowBrowser: true });
      const response = await openai.chat.completions.create({
        model: 'arcee-ai/trinity-large-preview:free',
        messages: [
          { role: 'system', content: 'You are a short-form content strategist. Return ONLY valid JSON, no markdown.' },
          { role: 'user', content: buildAnglesPrompt(selectedPost, brandIdentity) },
        ],
        response_format: { type: 'json_object' },
      });
      const raw = response.choices[0].message.content ?? '{}';
      const parsed = JSON.parse(raw);
      setAngleCards((parsed.angles ?? []).slice(0, 3) as AngleCard[]);
    } catch (e) {
      console.error(e);
      setError('Could not generate angles. Try generating directly instead.');
      setShowAnglePicker(false);
    } finally { setAnglesLoading(false); }
  };

  const handleGenerateClick = async () => {
    if (showAnglePicker) {
      // User is in picker — clicking again = skip directly to generate
      setShowAnglePicker(false);
      generate();
      return;
    }
    setShowAnglePicker(true);
    await generateAngles();
  };

  const handleAnglePick = (card: AngleCard) => {
    setChosenAngle(card);
    setShowAnglePicker(false);
    generate(card);
  };

  const handleAngleSkip = () => {
    setShowAnglePicker(false);
    generate();
  };

  const generateHooks = async () => {
    if (!selectedPost) return;
    const orKey = import.meta.env.VITE_OPENROUTER_API_KEY as string;
    if (!orKey) { setError('OpenRouter API key is not configured.'); return; }
    setHooksLoading(true); setHookSuggestions([]);
    try {
      const openai = new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: orKey, dangerouslyAllowBrowser: true });
      const response = await openai.chat.completions.create({
        model: 'arcee-ai/trinity-large-preview:free',
        messages: [
          { role: 'system', content: 'You are an expert short-form content hook writer. Return ONLY valid JSON, no markdown.' },
          { role: 'user', content: buildHooksPrompt(selectedPost, brandIdentity) },
        ],
        response_format: { type: 'json_object' },
      });
      const raw = response.choices[0].message.content ?? '{}';
      const parsed = JSON.parse(raw);
      setHookSuggestions((parsed.hooks ?? []).slice(0, 5) as HookSuggestion[]);
    } catch (e) {
      console.error(e);
      setError('Hook generation failed. Try again.');
    } finally { setHooksLoading(false); }
  };

  const reviewScript = async () => {
    if (!selectedPost || !hasContent) return;
    const orKey = import.meta.env.VITE_OPENROUTER_API_KEY as string;
    if (!orKey) { setError('OpenRouter API key is not configured.'); return; }
    setReviewLoading(true); setReview(null); setReviewStep(0);
    try {
      const openai = new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: orKey, dangerouslyAllowBrowser: true });
      const response = await openai.chat.completions.create({
        model: 'arcee-ai/trinity-large-preview:free',
        messages: [
          { role: 'system', content: 'You are an elite short-form content editor. Return ONLY valid JSON, no markdown.' },
          { role: 'user', content: buildReviewPrompt(selectedPost, sections, brandIdentity) },
        ],
        response_format: { type: 'json_object' },
      });
      const raw = response.choices[0].message.content ?? '{}';
      const parsed = JSON.parse(raw) as ScriptReview;
      setReview({
        score: parsed.score ?? 5,
        summary: parsed.summary ?? '',
        strengths: parsed.strengths ?? [],
        fixes: (parsed.fixes ?? []).slice(0, 5) as ScriptFix[],
      });
    } catch (e) {
      console.error(e);
      setError('Review failed. Try again.');
    } finally { setReviewLoading(false); }
  };

  const applyReviewFix = (fix: ScriptFix) => {
    setSections(prev => ({ ...prev, [fix.section]: fix.proposed }));
  };

  const handleSave = () => {
    if (!selectedPost) return;
    onSave({ postId: selectedPost.id, ...sections });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const copyAll = async () => {
    await navigator.clipboard.writeText(`HOOK:\n${sections.hook}\n\nVALUE DELIVERY:\n${sections.body}\n\nCTA:\n${sections.cta}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    analytics.trackScriptCopied();
  };

  const statusColor = (status: string) => ({
    IDEA:      'bg-slate-400',
    DRAFT:     'bg-blue-500',
    SCHEDULED: 'bg-emerald-500',
  }[status] ?? 'bg-slate-300');

  const statusTextColor = (status: string) => ({
    IDEA:      'text-slate-500 bg-slate-100',
    DRAFT:     'text-blue-700 bg-blue-50',
    SCHEDULED: 'text-emerald-700 bg-emerald-50',
  }[status] ?? 'text-slate-500 bg-slate-100');

  return (
    <div className="flex h-full overflow-hidden bg-white">

      {/* ── LEFT SIDEBAR ─────────────────────────────────────────────────── */}
      <aside className="w-72 shrink-0 flex flex-col border-r border-slate-200 bg-slate-50 overflow-hidden">

        {/* Sidebar header */}
        <div className="px-4 pt-4 pb-3 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-2 mb-3">
            <FlaskConical className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-bold text-slate-900">Script Lab</span>
          </div>

          {/* Filter pills — these ARE the filters */}
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            {/* All */}
            <button
              onClick={() => setFilter('all')}
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                filter === 'all'
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
              }`}
            >
              All {posts.length}
            </button>
            {/* Scripted */}
            <button
              onClick={() => setFilter('done')}
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                filter === 'done'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              {totalScripted} scripted
            </button>
            {/* Need scripts */}
            {totalNeed > 0 && (
              <button
                onClick={() => setFilter('needs')}
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                  filter === 'needs'
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                }`}
              >
                {totalNeed} need scripts
              </button>
            )}
            {/* AI created */}
            {agentCount > 0 && (
              <button
                onClick={() => setFilter('agent')}
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                  filter === 'agent'
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100'
                }`}
              >
                <Bot className="w-2.5 h-2.5 inline mr-0.5" />{agentCount} AI
              </button>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search posts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent placeholder-slate-400 text-slate-900"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Theme chips */}
        {uniqueThemes.length > 0 && (
          <div className="px-3 py-2 border-b border-slate-200 bg-white">
            <div className="flex items-center gap-1 flex-wrap">
              {uniqueThemes.map(theme => (
                <button
                  key={theme}
                  onClick={() => setSelectedTheme(t => t === theme ? null : theme)}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                    selectedTheme === theme
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                  }`}
                >
                  {theme}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sort */}
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-200 bg-white">
          <Filter className="w-3 h-3 text-slate-400" />
          <span className="text-[10px] text-slate-400 font-medium">Sort:</span>
          {(['date', 'status'] as SortMode[]).map(s => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`text-[10px] px-1.5 py-0.5 rounded font-semibold capitalize transition-colors ${
                sort === s ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Post list */}
        <div className="flex-1 overflow-y-auto py-2">
          {filteredPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <FlaskConical className="w-6 h-6 text-slate-300 mb-2" />
              <p className="text-xs text-slate-400">
                {search ? 'No posts match your search.' : 'No posts in this category.'}
              </p>
            </div>
          ) : (
            filteredPosts.map(post => {
              const hasScript = scriptByPostId.has(post.id);
              const isAgent = agentPostIds.has(post.id);
              const isSelected = post.id === selectedPostId;
              const script = scriptByPostId.get(post.id);
              const scriptWords = script
                ? wordCount(script.hook) + wordCount(script.body) + wordCount(script.cta)
                : 0;

              return (
                <button
                  key={post.id}
                  onClick={() => setSelectedPostId(post.id)}
                  className={`w-full text-left px-3 py-2.5 transition-all relative group ${
                    isSelected
                      ? 'bg-indigo-50 border-r-2 border-indigo-500'
                      : 'hover:bg-slate-100 border-r-2 border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Status stripe */}
                    <div className={`w-0.5 self-stretch rounded-full shrink-0 mt-0.5 ${statusColor(post.status)}`} />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1 mb-0.5">
                        <p className={`text-xs font-semibold leading-snug truncate ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>
                          {post.title}
                        </p>
                        <div className="flex items-center gap-1 shrink-0">
                          {isAgent && (
                            <span className="p-0.5 rounded bg-violet-100">
                              <Bot className="w-2.5 h-2.5 text-violet-600" />
                            </span>
                          )}
                          {hasScript
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            : <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                          }
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">
                        {post.theme} · {post.type}
                        {post.date && <> · {post.date}</>}
                      </p>
                      {hasScript && scriptWords > 0 && (
                        <p className="text-[10px] text-emerald-600 font-medium mt-0.5">
                          {scriptWords}w · ~{Math.round(scriptWords / 2.5)}s
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* ── CENTER EDITOR ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedPost ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
              <FlaskConical className="w-8 h-8 text-indigo-400" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-1">Pick a post to start writing</h2>
            <p className="text-sm text-slate-500 max-w-xs">
              Select any post from the sidebar. The AI will use your brand identity to generate a strategically-aligned script.
            </p>
            {totalNeed > 0 && (
              <button
                onClick={() => setFilter('needs')}
                className="mt-5 flex items-center gap-2 px-4 py-2 bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold rounded-xl hover:bg-rose-100 transition-colors"
              >
                <Circle className="w-3.5 h-3.5" />
                {totalNeed} post{totalNeed > 1 ? 's' : ''} still need{totalNeed === 1 ? 's' : ''} scripts
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Post context bar */}
            <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-white">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-1.5 h-6 rounded-full shrink-0 ${statusColor(selectedPost.status)}`} />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate leading-snug">{selectedPost.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${statusTextColor(selectedPost.status)}`}>
                      {selectedPost.status}
                    </span>
                    <span className="text-[10px] text-slate-400">{selectedPost.theme} · {selectedPost.type}</span>
                    {selectedPost.date && <span className="text-[10px] text-slate-400">{selectedPost.date}</span>}
                    {agentPostIds.has(selectedPost.id) && (
                      <span className="flex items-center gap-0.5 text-[10px] text-violet-600 font-semibold">
                        <Bot className="w-2.5 h-2.5" /> AI created
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {hasContent && (
                  <span className="text-[11px] text-slate-400 font-medium">
                    {totalWords}w · ~{estSeconds}s
                  </span>
                )}
                <button
                  onClick={() => { setPreviewOpen(p => !p); if (!previewOpen) setPreviewMode('read'); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                    previewOpen ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  {previewOpen ? 'Hide Preview' : 'Preview'}
                </button>
                <button
                  onClick={() => { setPreviewOpen(true); setPreviewMode('schedule'); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                    previewOpen && previewMode === 'schedule'
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      : 'text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <CalendarCheck className="w-3.5 h-3.5" />
                  Schedule
                </button>
              </div>
            </div>

            {/* Toolbar */}
            <div className="shrink-0 flex items-center gap-2.5 px-5 py-2.5 border-b border-slate-100 bg-slate-50">
              <button
                onClick={handleGenerateClick}
                disabled={loading}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-60 ${
                  showAnglePicker
                    ? 'bg-slate-700 hover:bg-slate-800'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {loading || anglesLoading
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Sparkles className="w-3.5 h-3.5" />}
                {loading ? 'Generating…'
                  : anglesLoading ? 'Picking angles…'
                  : showAnglePicker ? 'Skip → Generate now'
                  : hasContent ? 'Regenerate'
                  : 'Generate Script'}
              </button>
              {/* Chosen angle badge */}
              {chosenAngle && !showAnglePicker && !loading && (
                <div className="flex items-center gap-1.5 text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-2.5 py-0.5">
                  <span>{chosenAngle.emoji}</span>
                  <span>{chosenAngle.type}</span>
                  <button
                    onClick={() => setChosenAngle(null)}
                    className="text-indigo-400 hover:text-indigo-700 transition-colors ml-0.5"
                    title="Clear angle"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              )}
              {hasContent && (
                <>
                  <button
                    onClick={handleSave}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                      saved
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700 border-transparent'
                    }`}
                  >
                    {saved ? <CheckCheck className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                    {saved ? 'Saved!' : 'Save Draft'}
                  </button>
                  <button
                    onClick={copyAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
                  >
                    {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'Copy All'}
                  </button>
                  <button
                    onClick={() => setSections({ hook: '', body: '', cta: '' })}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                    title="Clear all"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  {/* Review button */}
                  <button
                    onClick={reviewScript}
                    disabled={reviewLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-violet-700 border border-violet-200 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {reviewLoading
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Sparkles className="w-3.5 h-3.5" />}
                    {reviewLoading ? 'Reviewing…' : 'Review Script'}
                  </button>
                  {/* Progress dots */}
                  <div className="ml-auto flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400 font-medium">Sections:</span>
                    {[sections.hook, sections.body, sections.cta].map((s, i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full transition-colors ${s ? 'bg-indigo-500' : 'bg-slate-200'}`}
                        title={['Hook', 'Body', 'CTA'][i]}
                      />
                    ))}
                    <span className={`text-[10px] font-bold ml-1 ${filledSections === 3 ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {filledSections}/3
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Editor body */}
            <div className="flex flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
                {error && (
                  <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-xs text-rose-700">{error}</div>
                )}

                {showAnglePicker ? (
                  <AngleCardsPanel
                    cards={angleCards}
                    loading={anglesLoading}
                    isRegenerate={hasContent}
                    currentAngle={chosenAngle}
                    onPick={handleAnglePick}
                    onSkip={handleAngleSkip}
                  />
                ) : (
                  <>
                    <ScriptSection
                      label="Hook"
                      sublabel="First 2 seconds — stop the scroll"
                      accent="rose"
                      value={sections.hook}
                      onChange={v => setSections(p => ({ ...p, hook: v }))}
                      placeholder="Your opening line that makes people freeze mid-scroll…"
                      rows={3}
                      headerRight={
                        <button
                          onClick={generateHooks}
                          disabled={hooksLoading}
                          className="flex items-center gap-1 text-[10px] font-bold text-rose-600 hover:text-rose-800 transition-colors disabled:opacity-50"
                        >
                          {hooksLoading
                            ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            : <Sparkles className="w-2.5 h-2.5" />}
                          {hooksLoading ? 'Generating…' : hookSuggestions.length ? 'Refresh hooks' : 'Generate hooks'}
                        </button>
                      }
                    />
                    {/* Hook suggestions panel */}
                    {(hooksLoading || hookSuggestions.length > 0) && (
                      <HookSuggestionsPanel
                        loading={hooksLoading}
                        suggestions={hookSuggestions}
                        onApply={(h) => setSections(p => ({ ...p, hook: h }))}
                        onClose={() => setHookSuggestions([])}
                      />
                    )}
                    <ScriptSection
                      label="Value Delivery"
                      sublabel="The core message — earn the watch"
                      accent="indigo"
                      value={sections.body}
                      onChange={v => setSections(p => ({ ...p, body: v }))}
                      placeholder="The insight, story, or tutorial that delivers on the hook's promise…"
                      rows={8}
                    />
                    <ScriptSection
                      label="Call to Action"
                      sublabel="What to do next"
                      accent="emerald"
                      value={sections.cta}
                      onChange={v => setSections(p => ({ ...p, cta: v }))}
                      placeholder="Follow for more. Comment your take. Save this for later…"
                      rows={2}
                    />
                    {!hasContent && !loading && (
                      <div className="mt-2 bg-indigo-50 border border-indigo-100 rounded-xl p-5 text-center">
                        <Sparkles className="w-5 h-5 text-indigo-400 mx-auto mb-2" />
                        <p className="text-xs font-semibold text-indigo-700">Ready to generate</p>
                        <p className="text-[11px] text-indigo-500 mt-1">
                          Click "Generate Script" — the AI will suggest 3 strategic angles first, then write your script.
                        </p>
                        {brandIdentity.icp && (
                          <p className="text-[11px] text-indigo-400 mt-2 italic">
                            Context: {brandIdentity.icp.slice(0, 80)}…
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* ── RIGHT PREVIEW PANEL ─────────────────────────────────── */}
              {previewOpen && (
                <PreviewPanel
                  ref={previewPanelRef}
                  previewMode={previewMode}
                  setPreviewMode={setPreviewMode}
                  isFullscreen={isFullscreen}
                  toggleFullscreen={toggleFullscreen}
                  hasContent={hasContent}
                  sections={sections}
                  fullScript={fullScript}
                  totalWords={totalWords}
                  estSeconds={estSeconds}
                  playing={playing}
                  setPlaying={setPlaying}
                  speed={speed}
                  setSpeed={setSpeed}
                  teleprompterRef={teleprompterRef}
                  resetTeleprompter={resetTeleprompter}
                  onClose={() => setPreviewOpen(false)}
                  post={selectedPost}
                  allPosts={posts}
                  onSchedule={async (postDate, filmingDate) => {
                    await onSchedule(selectedPost.id, postDate, filmingDate);
                    setPreviewOpen(false);
                  }}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* Script Review Modal */}
      {review && (
        <ScriptReviewModal
          review={review}
          step={reviewStep}
          sections={sections}
          onApply={applyReviewFix}
          onNextStep={() => setReviewStep(s => s + 1)}
          onClose={() => { setReview(null); setReviewStep(0); }}
        />
      )}
    </div>
  );
}

/* ─── Preview Panel ──────────────────────────────────────────────────────── */

import { forwardRef } from 'react';

const PreviewPanel = forwardRef<HTMLDivElement, {
  previewMode: PreviewMode;
  setPreviewMode: (m: PreviewMode) => void;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  hasContent: boolean;
  sections: ScriptSections;
  fullScript: string;
  totalWords: number;
  estSeconds: number;
  playing: boolean;
  setPlaying: (p: boolean | ((prev: boolean) => boolean)) => void;
  speed: number;
  setSpeed: (s: number) => void;
  teleprompterRef: React.RefObject<HTMLDivElement | null>;
  resetTeleprompter: () => void;
  onClose: () => void;
  post: Post;
  allPosts: Post[];
  onSchedule: (postDate: string, filmingDate?: string) => Promise<void>;
}>(function PreviewPanel({
  previewMode, setPreviewMode, isFullscreen, toggleFullscreen,
  hasContent, sections, fullScript, totalWords, estSeconds,
  playing, setPlaying, speed, setSpeed,
  teleprompterRef, resetTeleprompter, onClose,
  post, allPosts, onSchedule,
}, ref) {
  return (
    <div
      ref={ref}
      className={`w-80 shrink-0 border-l border-slate-200 flex flex-col bg-slate-50 ${isFullscreen ? 'fixed inset-0 w-full z-50' : ''}`}
    >
      {/* Panel tabs */}
      <div className="flex items-center border-b border-slate-200 bg-white shrink-0">
        {previewMode !== 'schedule' ? (
          <>
            <button
              onClick={() => setPreviewMode('read')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-bold transition-colors border-b-2 ${
                previewMode === 'read' ? 'border-indigo-500 text-indigo-700' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> Reader
            </button>
            <button
              onClick={() => { setPreviewMode('teleprompter'); resetTeleprompter(); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-bold transition-colors border-b-2 ${
                previewMode === 'teleprompter' ? 'border-indigo-500 text-indigo-700' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Tv2 className="w-3.5 h-3.5" /> Teleprompter
            </button>
            <button
              onClick={() => setPreviewMode('schedule')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-bold border-b-2 border-transparent text-slate-400 hover:text-slate-600 transition-colors"
            >
              <CalendarCheck className="w-3.5 h-3.5" /> Schedule
            </button>
          </>
        ) : (
          <div className="flex-1 flex items-center gap-2 px-4 py-2.5">
            <CalendarCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-[11px] font-bold text-indigo-700">Schedule Post</span>
          </div>
        )}
        <div className="flex items-center gap-0.5 px-1.5">
          {previewMode !== 'schedule' && (
            <button onClick={toggleFullscreen} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}
          <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Reader */}
      {previewMode === 'read' && (
        <div className={`flex-1 overflow-y-auto p-5 ${isFullscreen ? 'flex flex-col items-center justify-start pt-12' : ''}`}>
          {hasContent ? (
            <div className={`space-y-5 ${isFullscreen ? 'max-w-2xl w-full' : ''}`}>
              {sections.hook && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-rose-500 mb-1.5">Hook</p>
                  <p className={`text-slate-800 leading-relaxed font-semibold ${isFullscreen ? 'text-2xl' : 'text-sm'}`}>{sections.hook}</p>
                </div>
              )}
              {sections.body && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-1.5">Value Delivery</p>
                  <p className={`text-slate-700 leading-relaxed whitespace-pre-wrap ${isFullscreen ? 'text-xl' : 'text-sm'}`}>{sections.body}</p>
                </div>
              )}
              {sections.cta && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-1.5">Call to Action</p>
                  <p className={`text-slate-800 leading-relaxed font-semibold ${isFullscreen ? 'text-2xl' : 'text-sm'}`}>{sections.cta}</p>
                </div>
              )}
              <div className="pt-3 border-t border-slate-200">
                <p className="text-[10px] text-slate-400 text-center">{totalWords} words · ~{estSeconds}s delivery</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-12 px-4">
              <FileText className="w-7 h-7 text-slate-300 mb-3" />
              <p className="text-xs text-slate-400">Generate or write your script to preview it here.</p>
            </div>
          )}
        </div>
      )}

      {/* Teleprompter */}
      {previewMode === 'teleprompter' && (
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-900">
          {/* Controls at the TOP for instant access */}
          <div className="shrink-0 bg-slate-800 border-b border-slate-700 px-4 py-2.5">
            {hasContent ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={resetTeleprompter}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors shrink-0"
                  title="Reset to top"
                >
                  <SkipBack className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    if (!playing) analytics.trackTeleprompterStarted(speed);
                    setPlaying((p: boolean) => !p);
                  }}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
                    playing ? 'bg-rose-500 hover:bg-rose-600 text-white' : 'bg-indigo-500 hover:bg-indigo-600 text-white'
                  }`}
                >
                  {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {playing ? 'Pause' : 'Start'}
                </button>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-[10px] text-slate-400 shrink-0">Speed</span>
                  <input
                    type="range" min={1} max={10} value={speed}
                    onChange={e => setSpeed(Number(e.target.value))}
                    className="flex-1 accent-indigo-500 h-1 min-w-0"
                  />
                  <span className="text-[10px] text-slate-400 w-3 text-right shrink-0">{speed}</span>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 text-center py-0.5">Write your script to use the teleprompter.</p>
            )}
          </div>
          <div
            ref={teleprompterRef}
            className="flex-1 overflow-y-auto px-6 py-8 scroll-smooth"
            style={{ scrollbarWidth: 'none' }}
          >
            {hasContent ? (
              <p
                className={`text-white leading-loose font-medium text-center whitespace-pre-wrap select-none ${isFullscreen ? 'text-4xl' : 'text-xl'}`}
                style={{ lineHeight: isFullscreen ? '2.4' : '2.2' }}
              >
                {fullScript}
              </p>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 text-center">
                <Tv2 className="w-8 h-8 mb-3 opacity-40" />
                <p className="text-xs">No script yet.</p>
              </div>
            )}
            <div style={{ height: '80%' }} />
          </div>
        </div>
      )}

      {/* Schedule */}
      {previewMode === 'schedule' && (
        <SchedulePanel
          post={post}
          allPosts={allPosts}
          onSchedule={onSchedule}
          onBack={() => setPreviewMode('read')}
        />
      )}
    </div>
  );
});

/* ─── Schedule Panel ─────────────────────────────────────────────────────── */

function SchedulePanel({
  post, allPosts, onSchedule, onBack,
}: {
  post: Post;
  allPosts: Post[];
  onSchedule: (postDate: string, filmingDate?: string) => Promise<void>;
  onBack: () => void;
}) {
  const [filmDate, setFilmDate] = useState(post.filmingDate ?? '');
  const [postDate, setPostDate] = useState(post.date ?? '');
  const [calDate, setCalDate] = useState(() => {
    const d = post.date ? new Date(post.date + 'T00:00:00') : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selecting, setSelecting] = useState<'film' | 'post'>('post');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = calDate.toLocaleString('default', { month: 'short', year: 'numeric' });
  const today = new Date().toISOString().split('T')[0];
  const toStr = (d: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const otherPosts = allPosts.filter(p => p.id !== post.id);
  const postingDays = new Set(otherPosts.map(p => p.date).filter(Boolean));
  const filmingDays = new Set(otherPosts.map(p => p.filmingDate).filter(Boolean) as string[]);

  const handleDay = (ds: string) => {
    if (selecting === 'film') setFilmDate(prev => prev === ds ? '' : ds);
    else setPostDate(ds);
  };

  const save = async () => {
    if (!postDate) return;
    setSaving(true);
    await onSchedule(postDate, filmDate || undefined);
    analytics.trackScriptScheduled(postDate, !!filmDate);
    setSaved(true);
    setSaving(false);
  };

  const postConflicts = postDate ? otherPosts.filter(p => p.date === postDate) : [];
  const filmConflicts = filmDate ? otherPosts.filter(p => p.filmingDate === filmDate || p.date === filmDate) : [];

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      <button onClick={onBack} className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 transition-colors mb-1">
        <ChevronLeft className="w-3 h-3" /> Back to preview
      </button>

      <div className="space-y-2">
        <button
          onClick={() => setSelecting('film')}
          className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
            selecting === 'film' ? 'border-blue-400 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:border-blue-200'
          }`}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${filmDate ? 'bg-blue-500' : 'bg-slate-100'}`}>
            <Camera className={`w-4 h-4 ${filmDate ? 'text-white' : 'text-slate-400'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-blue-600 mb-0.5">Film Date</p>
            <p className={`text-sm font-semibold ${filmDate ? 'text-slate-900' : 'text-slate-400'}`}>
              {filmDate || 'Tap to pick on calendar'}
            </p>
          </div>
          {filmDate && (
            <button
              onClick={e => { e.stopPropagation(); setFilmDate(''); }}
              className="p-1 rounded-full hover:bg-blue-100 text-slate-400 hover:text-rose-500 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </button>

        <button
          onClick={() => setSelecting('post')}
          className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
            selecting === 'post' ? 'border-emerald-400 bg-emerald-50 shadow-sm' : 'border-slate-200 bg-white hover:border-emerald-200'
          }`}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${postDate ? 'bg-emerald-500' : 'bg-slate-100'}`}>
            <Rocket className={`w-4 h-4 ${postDate ? 'text-white' : 'text-slate-400'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 mb-0.5">Post Date</p>
            <p className={`text-sm font-semibold ${postDate ? 'text-slate-900' : 'text-slate-400'}`}>
              {postDate || 'Tap to pick on calendar'}
            </p>
          </div>
        </button>
      </div>

      {postConflicts.length > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          <span>Conflicts with <strong>{postConflicts[0].title}</strong></span>
        </div>
      )}
      {filmConflicts.length > 0 && (
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800">
          <AlertTriangle className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
          <span>Film date conflicts with <strong>{filmConflicts[0].title}</strong></span>
        </div>
      )}

      {/* Mini calendar */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
          <button onClick={() => setCalDate(new Date(year, month - 1, 1))} className="p-1 rounded hover:bg-slate-100 text-slate-500 transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <p className="text-xs font-semibold text-slate-700">{monthName}</p>
          <button onClick={() => setCalDate(new Date(year, month + 1, 1))} className="p-1 rounded hover:bg-slate-100 text-slate-500 transition-colors">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-7 px-1">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} className="text-[9px] text-center text-slate-400 font-semibold py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 px-1 pb-2">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const ds = toStr(day);
            const isFilm = filmDate === ds;
            const isPost = postDate === ds;
            const isToday = ds === today;
            const hasPosting = postingDays.has(ds);
            const hasFilming = filmingDays.has(ds);
            return (
              <button
                key={day}
                onClick={() => handleDay(ds)}
                className={`relative aspect-square flex flex-col items-center justify-center rounded-lg m-0.5 text-[11px] font-medium transition-colors ${
                  isFilm ? 'bg-blue-500 text-white' :
                  isPost ? 'bg-emerald-500 text-white' :
                  isToday ? 'ring-1 ring-indigo-400 text-indigo-700 font-bold' :
                  'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {day}
                {(hasPosting || hasFilming) && !isFilm && !isPost && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                    {hasFilming && <span className="w-1 h-1 rounded-full bg-blue-400" />}
                    {hasPosting && <span className="w-1 h-1 rounded-full bg-emerald-400" />}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-center gap-4 px-3 pb-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />Film</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Post</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-slate-300" />Taken</span>
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving || !postDate || saved}
        className="w-full py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarCheck className="w-4 h-4" />}
        {saved ? 'Scheduled!' : saving ? 'Saving…' : 'Save & Schedule'}
      </button>

      {filmDate && postDate && new Date(filmDate) > new Date(postDate) && (
        <p className="text-[11px] text-amber-600 text-center flex items-center justify-center gap-1">
          <AlertTriangle className="w-3 h-3" /> Film date is after post date
        </p>
      )}
    </div>
  );
}

/* ─── Angle Cards Panel ──────────────────────────────────────────────────── */

function AngleCardsPanel({
  cards, loading, isRegenerate, currentAngle, onPick, onSkip,
}: {
  cards: AngleCard[];
  loading: boolean;
  isRegenerate: boolean;
  currentAngle: AngleCard | null;
  onPick: (card: AngleCard) => void;
  onSkip: () => void;
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-14 gap-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-indigo-500" />
          </div>
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center">
            <Loader2 className="w-2.5 h-2.5 text-white animate-spin" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-slate-800">Analysing your post…</p>
          <p className="text-xs text-slate-500 mt-1">Finding the 3 sharpest angles for this content</p>
        </div>
        {/* Skeleton cards */}
        <div className="w-full space-y-2.5 mt-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-4 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-slate-200 rounded w-1/3" />
                  <div className="h-3 bg-slate-200 rounded w-5/6" />
                  <div className="h-2.5 bg-slate-100 rounded w-2/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (cards.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-slate-900">
            {isRegenerate ? 'Try a different angle' : 'Choose your angle'}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            The AI will craft the full script from the frame you pick.
            {isRegenerate && currentAngle && (
              <span className="ml-1 text-indigo-600">Last used: {currentAngle.emoji} {currentAngle.type}</span>
            )}
          </p>
        </div>
        <button
          onClick={onSkip}
          className="shrink-0 flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-700 font-semibold transition-colors whitespace-nowrap"
        >
          Skip <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* Cards */}
      <div className="space-y-2.5">
        {cards.map((card, i) => {
          const isCurrent = currentAngle?.type === card.type;
          return (
            <button
              key={i}
              onClick={() => onPick(card)}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all group hover:shadow-md ${
                isCurrent
                  ? 'border-indigo-400 bg-indigo-50 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 transition-colors ${
                  isCurrent ? 'bg-indigo-100' : 'bg-slate-100 group-hover:bg-indigo-100'
                }`}>
                  {card.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-black uppercase tracking-wider ${
                      isCurrent ? 'text-indigo-700' : 'text-slate-600'
                    }`}>{card.type}</span>
                    {isCurrent && (
                      <span className="text-[9px] font-bold bg-indigo-200 text-indigo-700 px-1.5 py-0.5 rounded-full">
                        Last used
                      </span>
                    )}
                  </div>
                  <p className={`text-sm font-semibold leading-snug mb-1.5 italic ${
                    isCurrent ? 'text-indigo-900' : 'text-slate-800'
                  }`}>
                    "{card.hook}"
                  </p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{card.description}</p>
                  <p className={`text-[10px] font-bold mt-1.5 ${isCurrent ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-500'}`}>
                    Best for: {card.bestFor}
                  </p>
                </div>
                <ChevronRight className={`w-4 h-4 shrink-0 mt-0.5 transition-colors ${
                  isCurrent ? 'text-indigo-400' : 'text-slate-300 group-hover:text-indigo-400'
                }`} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Script Section ─────────────────────────────────────────────────────── */

function ScriptSection({
  label, sublabel, accent, value, onChange, placeholder, rows, headerRight,
}: {
  label: string; sublabel: string; accent: 'rose' | 'indigo' | 'emerald';
  value: string; onChange: (v: string) => void; placeholder: string; rows: number;
  headerRight?: React.ReactNode;
}) {
  const wordCount = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
  const wc = wordCount(value);

  const map = {
    rose:    { badge: 'bg-rose-100 text-rose-700',    border: 'border-rose-200',    ring: 'focus:ring-rose-400' },
    indigo:  { badge: 'bg-indigo-100 text-indigo-700', border: 'border-indigo-200', ring: 'focus:ring-indigo-500' },
    emerald: { badge: 'bg-emerald-100 text-emerald-700', border: 'border-emerald-200', ring: 'focus:ring-emerald-500' },
  }[accent];

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-baseline gap-2">
          <span className={`text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${map.badge}`}>{label}</span>
          <span className="text-[11px] text-slate-400">{sublabel}</span>
        </div>
        <div className="flex items-center gap-2">
          {headerRight}
          {wc > 0 && <span className="text-[10px] text-slate-400">{wc}w</span>}
        </div>
      </div>
      <textarea
        rows={rows}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-2.5 rounded-xl border text-sm text-slate-900 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 transition-shadow leading-relaxed ${map.border} ${map.ring}`}
      />
    </div>
  );
}

/* ─── Hook Suggestions Panel ─────────────────────────────────────────────── */

function HookSuggestionsPanel({
  loading, suggestions, onApply, onClose,
}: {
  loading: boolean;
  suggestions: HookSuggestion[];
  onApply: (hook: string) => void;
  onClose: () => void;
}) {
  const principleColors: Record<string, string> = {
    'Curiosity Gap':   'bg-amber-100 text-amber-800',
    'Pain Agitation':  'bg-rose-100 text-rose-800',
    'Contrarian':      'bg-purple-100 text-purple-800',
    'Social Proof':    'bg-blue-100 text-blue-800',
    'Identity Threat': 'bg-red-100 text-red-800',
    'FOMO':            'bg-orange-100 text-orange-800',
    'Pattern Break':   'bg-teal-100 text-teal-800',
    'Vulnerability':   'bg-pink-100 text-pink-800',
    'Specificity':     'bg-indigo-100 text-indigo-800',
    'Open Loop':       'bg-violet-100 text-violet-800',
  };

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-rose-200 bg-rose-50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-rose-500" />
          <span className="text-[11px] font-black uppercase tracking-wider text-rose-700">
            Psychology Hooks
          </span>
          {!loading && suggestions.length > 0 && (
            <span className="text-[10px] text-rose-500">{suggestions.length} options — click to apply</span>
          )}
        </div>
        {!loading && (
          <button onClick={onClose} className="p-1 rounded hover:bg-rose-100 text-rose-400 hover:text-rose-700 transition-colors">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="divide-y divide-rose-100">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="px-4 py-3 animate-pulse space-y-1.5">
              <div className="h-2.5 bg-rose-200 rounded w-1/4" />
              <div className="h-3 bg-rose-100 rounded w-full" />
              <div className="h-2.5 bg-rose-100 rounded w-3/4" />
            </div>
          ))
        ) : (
          suggestions.map((s, i) => {
            const colorClass = principleColors[s.principle] ?? 'bg-slate-100 text-slate-700';
            return (
              <div key={i} className="px-4 py-3 group hover:bg-white transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{s.principleEmoji}</span>
                      <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${colorClass}`}>
                        {s.principle}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800 leading-snug">"{s.hook}"</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed">{s.why}</p>
                  </div>
                  <button
                    onClick={() => onApply(s.hook)}
                    className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-rose-700 border border-rose-300 bg-white hover:bg-rose-600 hover:text-white hover:border-rose-600 px-2.5 py-1 rounded-lg transition-colors mt-0.5"
                  >
                    Use <ArrowRight className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ─── Script Review Modal ─────────────────────────────────────────────────── */

function ScriptReviewModal({
  review, step, sections, onApply, onNextStep, onClose,
}: {
  review: ScriptReview;
  step: number;
  sections: ScriptSections;
  onApply: (fix: ScriptFix) => void;
  onNextStep: () => void;
  onClose: () => void;
}) {
  const done = step >= review.fixes.length;
  const currentFix = !done ? review.fixes[step] : null;

  const scoreColor = review.score >= 8 ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
    : review.score >= 6 ? 'text-amber-600 bg-amber-50 border-amber-200'
    : 'text-rose-600 bg-rose-50 border-rose-200';

  const sectionLabel = { hook: 'Hook', body: 'Value Delivery', cta: 'Call to Action' };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900">Script Review</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {done
                  ? 'All suggestions reviewed'
                  : `Suggestion ${step + 1} of ${review.fixes.length}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Score */}
            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-sm font-black ${scoreColor}`}>
              {review.score}/10
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Summary + Strengths — always visible */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <p className="text-sm font-semibold text-slate-800 leading-relaxed">"{review.summary}"</p>
            {review.strengths.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {review.strengths.map((s, i) => (
                  <span key={i} className="flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                    <CheckCheck className="w-2.5 h-2.5" />{s}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Current fix card */}
          {!done && currentFix && (
            <div className="border-2 border-violet-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-violet-50 border-b border-violet-200 flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-violet-700">
                  Improve: {sectionLabel[currentFix.section]}
                </span>
              </div>
              <div className="p-4 space-y-3">
                {/* Before */}
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Before</p>
                  <p className="text-sm text-slate-500 leading-relaxed bg-slate-50 rounded-lg px-3 py-2 border border-slate-200 italic">
                    {currentFix.original || sections[currentFix.section] || '(empty)'}
                  </p>
                </div>
                {/* After */}
                <div>
                  <p className="text-[10px] font-bold text-violet-600 uppercase tracking-wider mb-1">Proposed</p>
                  <p className="text-sm text-slate-800 leading-relaxed font-medium bg-violet-50 rounded-lg px-3 py-2 border border-violet-200">
                    {currentFix.proposed}
                  </p>
                </div>
                {/* Why */}
                <p className="text-[11px] text-slate-500 leading-relaxed bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  <span className="font-bold text-amber-700">Why: </span>{currentFix.reason}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 px-4 pb-4">
                <button
                  onClick={() => { onApply(currentFix); onNextStep(); }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-xl transition-colors"
                >
                  <CheckCheck className="w-4 h-4" /> Apply this change
                </button>
                <button
                  onClick={onNextStep}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-800 border border-slate-200 hover:border-slate-300 rounded-xl transition-colors"
                >
                  Skip <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Done state */}
          {done && (
            <div className="text-center py-6 space-y-3">
              <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCheck className="w-6 h-6 text-emerald-600" />
              </div>
              <p className="text-sm font-bold text-slate-800">All suggestions reviewed</p>
              <p className="text-xs text-slate-500">Your script has been updated with the changes you applied.</p>
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-700 transition-colors"
              >
                Close review
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── AI prompt builders ─────────────────────────────────────────────────── */

function buildSystem(identity: BrandIdentity, language: AppLanguage): string {
  return `You are an elite short-form content scriptwriter specializing in TikTok, Reels, and Shorts.

LANGUAGE: Write the entire script in ${LANGUAGE_NAMES[language]}. Do not use any other language.

BRAND CONTEXT:
- ICP: ${identity.icp || 'Not defined'}
- Positioning: ${identity.positioning || 'Not defined'}
- Voice & Tone: ${identity.tone || 'Not defined'}

AUDIENCE EMPATHY MAP:
- Pains: ${identity.empathyMap.pains || 'Not defined'}
- Gains: ${identity.empathyMap.gains || 'Not defined'}
- Fears: ${identity.empathyMap.fears || 'Not defined'}
- Hopes: ${identity.empathyMap.hopes || 'Not defined'}

RULES:
1. Every hook must create immediate tension or curiosity
2. The body must reference at least one element from the Empathy Map
3. Match the Voice & Tone exactly
4. Keep scripts under 150 words total for 60-second delivery
5. Never use filler phrases like "In today's video..."`;
}

function buildPrompt(post: Post, identity: BrandIdentity, angle?: AngleCard): string {
  const angleBlock = angle
    ? `\nCHOSEN ANGLE: ${angle.type} — ${angle.description}\nHOOK DIRECTION: Adapt (don't copy) this opening: "${angle.hook}"\nBuild the entire script leaning into the ${angle.type} frame.\n`
    : `\nThe hook must reference the audience's ${identity.empathyMap.pains ? 'pain: ' + identity.empathyMap.pains.split('\n')[0] : 'core challenge'}.\n`;

  return `Write a short-form video script for:

TITLE: "${post.title}"
FORMAT: ${post.type}
THEME: ${post.theme}
${angleBlock}
Respond ONLY with a valid JSON object (no markdown, no explanation):
{
  "hook": "the opening 1-2 sentences that stop the scroll",
  "body": "the core value delivery — insight, story, or tutorial steps",
  "cta": "the closing call to action"
}`;
}

function buildHooksPrompt(post: Post, identity: BrandIdentity): string {
  return `Generate exactly 5 DISTINCT, high-converting hooks for this short-form video post.

POST TITLE: "${post.title}"
FORMAT: ${post.type}
THEME: ${post.theme}
ICP: ${identity.icp || 'Not defined'}
AUDIENCE PAINS: ${identity.empathyMap.pains || 'Not defined'}
AUDIENCE HOPES: ${identity.empathyMap.hopes || 'Not defined'}
VOICE & TONE: ${identity.tone || 'Not defined'}

Each hook must use a DIFFERENT psychological principle. Choose from:
- Pattern Interrupt: Breaks the viewer's autopilot scrolling with the unexpected
- Curiosity Gap: Opens an information loop that demands to be closed
- Social Proof: Leverages authority, numbers, or consensus
- Fear of Missing Out (FOMO): Activates loss-aversion or urgency
- Direct Challenge: Speaks directly to the viewer's identity or assumptions
- Empathy Mirror: Reflects the viewer's exact frustration back at them
- Contrarian Flip: Challenges a widely-held belief in the niche
- Transformation Promise: Implies a before/after journey in one line

Return ONLY this JSON (no markdown, no explanation):
{
  "hooks": [
    {
      "hook": "The full hook text — punchy, specific, max 2 sentences",
      "principle": "Pattern Interrupt",
      "principleEmoji": "⚡",
      "why": "One sentence explaining why this hook works psychologically for this audience"
    }
  ]
}`;
}

function buildReviewPrompt(post: Post, sections: ScriptSections, identity: BrandIdentity): string {
  return `Review this short-form video script and provide structured optimization feedback.

POST TITLE: "${post.title}"
FORMAT: ${post.type}
THEME: ${post.theme}
ICP: ${identity.icp || 'Not defined'}
AUDIENCE PAINS: ${identity.empathyMap.pains || 'Not defined'}
AUDIENCE HOPES: ${identity.empathyMap.hopes || 'Not defined'}
VOICE & TONE: ${identity.tone || 'Not defined'}

CURRENT SCRIPT:
[HOOK]
${sections.hook || '(empty)'}

[BODY]
${sections.body || '(empty)'}

[CTA]
${sections.cta || '(empty)'}

Evaluate on: scroll-stopping power, ICP relevance, tone match, clarity, and CTA strength.

Return ONLY this JSON (no markdown, no explanation):
{
  "score": 78,
  "summary": "One concise sentence summarizing the script's overall quality",
  "strengths": [
    "One specific strength",
    "Another specific strength"
  ],
  "fixes": [
    {
      "section": "hook",
      "original": "The exact text from the script that should change",
      "proposed": "The improved replacement text",
      "reason": "Why this change will perform better"
    }
  ]
}

Rules:
- Score is 0-100 (be honest, not generous)
- Include 2-3 strengths
- Include 1-4 fixes only where genuinely needed (don't invent issues)
- section must be "hook", "body", or "cta"
- original must exactly match text from the script above`;
}

function buildAnglesPrompt(post: Post, identity: BrandIdentity): string {
  return `Generate exactly 3 DISTINCT strategic angles for this short-form video post.

POST TITLE: "${post.title}"
FORMAT: ${post.type}
THEME: ${post.theme}
ICP: ${identity.icp || 'Not defined'}
AUDIENCE PAINS: ${identity.empathyMap.pains || 'Not defined'}
VOICE & TONE: ${identity.tone || 'Not defined'}

Pick the 3 most strategic angles for this specific post from these archetypes:
- Pain First: Open with the audience's core frustration to create immediate empathy
- Transformation: Before/after personal story arc — "I used to X, then Y happened"
- Direct Value: Tactical numbered list or step-by-step "here's exactly how to..."
- Curiosity Gap: Open a loop the viewer must watch to close
- Contrarian: Challenge a widely held belief in the niche
- Social Proof: Lead with a striking data point, result, or validation
- Identity: Speak directly to who they aspire to become
- Urgency: Create FOMO or time-sensitive stakes

Return ONLY this JSON (no markdown, no explanation):
{
  "angles": [
    {
      "type": "Pain First",
      "emoji": "😤",
      "hook": "One punchy sample hook sentence using this angle — make it feel real and specific",
      "description": "One sentence on this angle's emotional strategy",
      "bestFor": "Cold audience · Discovery feed"
    },
    {
      "type": "Transformation",
      "emoji": "🔄",
      "hook": "...",
      "description": "...",
      "bestFor": "..."
    },
    {
      "type": "Direct Value",
      "emoji": "🎯",
      "hook": "...",
      "description": "...",
      "bestFor": "..."
    }
  ]
}`;
}
