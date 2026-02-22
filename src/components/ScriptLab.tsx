import { useState, useEffect, useRef } from 'react';
import {
  X, Sparkles, Save, Loader2, Copy, CheckCheck, RotateCcw,
  Play, Pause, SkipBack, PanelRightOpen, PanelRightClose,
  Tv2, FileText, Maximize2, Minimize2, ChevronLeft, ChevronRight,
  Camera, Rocket, CalendarCheck, AlertTriangle,
} from 'lucide-react';
import OpenAI from 'openai';
import type { Post, Script, BrandIdentity } from '../types';

interface Props {
  post: Post | null;
  existingScript?: Script;
  brandIdentity: BrandIdentity;
  posts: Post[];
  onClose: () => void;
  onSave: (script: Omit<Script, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onSchedule: (postId: string, postDate: string, filmingDate?: string) => Promise<void>;
}

interface ScriptSections {
  hook: string;
  body: string;
  cta: string;
}

type PreviewMode = 'read' | 'teleprompter' | 'schedule';

export default function ScriptLab({ post, existingScript, brandIdentity, posts, onClose, onSave, onSchedule }: Props) {
  const [sections, setSections] = useState<ScriptSections>({
    hook: existingScript?.hook ?? '',
    body: existingScript?.body ?? '',
    cta: existingScript?.cta ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  // Preview panel
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('read');

  // Teleprompter
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(3);
  const teleprompterRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const speedRef = useRef(speed);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  useEffect(() => {
    if (!playing) { cancelAnimationFrame(animFrameRef.current); return; }
    const el = teleprompterRef.current;
    if (!el) return;
    const scroll = () => {
      el.scrollTop += speedRef.current * 0.4;
      if (el.scrollTop < el.scrollHeight - el.clientHeight) {
        animFrameRef.current = requestAnimationFrame(scroll);
      } else {
        setPlaying(false);
      }
    };
    animFrameRef.current = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [playing]);

  const resetTeleprompter = () => {
    setPlaying(false);
    if (teleprompterRef.current) teleprompterRef.current.scrollTop = 0;
  };

  // Fullscreen
  const panelRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      panelRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  useEffect(() => {
    if (existingScript) setSections({ hook: existingScript.hook, body: existingScript.body, cta: existingScript.cta });
  }, [existingScript]);

  useEffect(() => { if (!previewOpen) setPlaying(false); }, [previewOpen]);

  if (!post) return null;

  const generate = async () => {
    const orKey = import.meta.env.VITE_OPENROUTER_API_KEY as string;
    if (!orKey) { setError('OpenRouter API key is not configured.'); return; }
    setLoading(true); setError('');
    try {
      const openai = new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: orKey, dangerouslyAllowBrowser: true });
      const response = await openai.chat.completions.create({
        model: 'arcee-ai/trinity-large-preview:free',
        messages: [
          { role: 'system', content: buildSystem(brandIdentity) },
          { role: 'user', content: buildPrompt(post, brandIdentity) }
        ],
        response_format: { type: 'json_object' }
      });
      const raw = response.choices[0].message.content ?? '{}';
      const parsed: ScriptSections = JSON.parse(raw);
      setSections({ hook: parsed.hook ?? '', body: parsed.body ?? '', cta: parsed.cta ?? '' });
    } catch (e) {
      console.error(e);
      setError('Generation failed. Check your API key and try again.');
    } finally { setLoading(false); }
  };

  const handleSave = () => onSave({ postId: post.id, ...sections });

  const copyAll = async () => {
    await navigator.clipboard.writeText(`HOOK:\n${sections.hook}\n\nVALUE DELIVERY:\n${sections.body}\n\nCTA:\n${sections.cta}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
  const totalWords = wordCount(sections.hook) + wordCount(sections.body) + wordCount(sections.cta);
  const estSeconds = Math.round(totalWords / 2.5);
  const hasContent = sections.hook || sections.body || sections.cta;
  const fullScript = [sections.hook, sections.body, sections.cta].filter(Boolean).join('\n\n');

  const openSchedule = () => { setPreviewOpen(true); setPreviewMode('schedule'); };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`bg-white rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden transition-all duration-300 ${previewOpen ? 'max-w-5xl' : 'max-w-3xl'}`} style={{ maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Script Lab</span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs text-slate-500">{post.theme} · {post.type}</span>
            </div>
            <h2 className="text-base font-bold text-slate-900 leading-snug">{post.title}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openSchedule}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${previewOpen && previewMode === 'schedule'
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : 'text-slate-500 border-slate-200 hover:bg-slate-50'
                }`}
            >
              <CalendarCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Schedule</span>
            </button>
            <button
              onClick={() => { setPreviewOpen(p => !p); if (!previewOpen) setPreviewMode('read'); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${previewOpen && previewMode !== 'schedule'
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : 'text-slate-500 border-slate-200 hover:bg-slate-50'
                }`}
            >
              {previewOpen && previewMode !== 'schedule' ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
              <span className="hidden sm:inline">Preview</span>
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-100 bg-slate-50 shrink-0">
          <button onClick={generate} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Generating...' : hasContent ? 'Regenerate' : 'Generate Script'}
          </button>
          {hasContent && (
            <>
              <button onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <Save className="w-4 h-4" /> Save Draft
              </button>
              <button onClick={copyAll}
                className="flex items-center gap-2 px-3 py-2 text-slate-600 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
              >
                {copied ? <CheckCheck className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy All'}
              </button>
              <button onClick={() => setSections({ hook: '', body: '', cta: '' })}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors" title="Clear"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <div className="ml-auto text-xs text-slate-400">~{totalWords} words · ~{estSeconds}s read</div>
            </>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

          {/* Editor */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {error && <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-sm text-rose-700">{error}</div>}
            <ScriptSection label="Hook" sublabel="First 2 seconds — stop the scroll" color="rose"
              value={sections.hook} onChange={v => setSections(p => ({ ...p, hook: v }))}
              placeholder="Your opening line that makes people freeze mid-scroll..." rows={3} />
            <ScriptSection label="Value Delivery" sublabel="The core message — earn the watch" color="indigo"
              value={sections.body} onChange={v => setSections(p => ({ ...p, body: v }))}
              placeholder="The insight, story, or tutorial that delivers on the hook's promise..." rows={8} />
            <ScriptSection label="Call to Action" sublabel="What to do next" color="emerald"
              value={sections.cta} onChange={v => setSections(p => ({ ...p, cta: v }))}
              placeholder="Follow for more. Comment your take. Save this for later..." rows={2} />
            {!hasContent && !loading && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 text-center">
                <Sparkles className="w-6 h-6 text-indigo-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-indigo-700">Ready to generate</p>
                <p className="text-xs text-indigo-500 mt-1">Click "Generate Script" — the AI will use your Brand Identity to write a strategically-aligned script.</p>
              </div>
            )}
          </div>

          {/* Preview panel */}
          {previewOpen && (
            <div ref={panelRef} className={`w-80 shrink-0 border-l border-slate-200 flex flex-col bg-slate-50 ${isFullscreen ? 'fixed inset-0 w-full z-50' : ''}`}>

              {/* Panel header */}
              <div className="flex items-center border-b border-slate-200 bg-white shrink-0">
                {previewMode !== 'schedule' && (
                  <>
                    <button onClick={() => setPreviewMode('read')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors border-b-2 ${previewMode === 'read' ? 'border-indigo-500 text-indigo-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                      <FileText className="w-3.5 h-3.5" /> Reader
                    </button>
                    <button onClick={() => { setPreviewMode('teleprompter'); resetTeleprompter(); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors border-b-2 ${previewMode === 'teleprompter' ? 'border-indigo-500 text-indigo-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                      <Tv2 className="w-3.5 h-3.5" /> Teleprompter
                    </button>
                  </>
                )}
                {previewMode === 'schedule' && (
                  <div className="flex-1 flex items-center gap-2 px-4 py-3">
                    <CalendarCheck className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="text-xs font-semibold text-indigo-700">Schedule Post</span>
                  </div>
                )}
                <div className="flex items-center gap-1 px-2">
                  {previewMode !== 'schedule' && (
                    <button onClick={toggleFullscreen}
                      className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                      title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                    >
                      {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  <button onClick={() => { setPreviewOpen(false); resetTeleprompter(); }}
                    className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Reader */}
              {previewMode === 'read' && (
                <div className={`flex-1 overflow-y-auto p-5 space-y-4 ${isFullscreen ? 'flex flex-col items-center justify-start pt-12' : ''}`}>
                  {hasContent ? (
                    <div className={isFullscreen ? 'max-w-2xl w-full space-y-6' : 'space-y-4'}>
                      {sections.hook && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-rose-500 mb-2">Hook</p>
                          <p className={`text-slate-800 leading-relaxed font-semibold ${isFullscreen ? 'text-2xl' : 'text-sm'}`}>{sections.hook}</p>
                        </div>
                      )}
                      {sections.body && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 mb-2">Value Delivery</p>
                          <p className={`text-slate-700 leading-relaxed whitespace-pre-wrap ${isFullscreen ? 'text-xl' : 'text-sm'}`}>{sections.body}</p>
                        </div>
                      )}
                      {sections.cta && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-2">Call to Action</p>
                          <p className={`text-slate-800 leading-relaxed font-semibold ${isFullscreen ? 'text-2xl' : 'text-sm'}`}>{sections.cta}</p>
                        </div>
                      )}
                      <div className="pt-3 border-t border-slate-200">
                        <p className="text-[10px] text-slate-400 text-center">{totalWords} words · ~{estSeconds}s delivery</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center px-4 py-12">
                      <FileText className="w-8 h-8 mb-3 opacity-40" />
                      <p className="text-xs">Generate or write your script to see the preview here.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Teleprompter */}
              {previewMode === 'teleprompter' && (
                <div className="flex-1 flex flex-col overflow-hidden bg-slate-900">
                  <div ref={teleprompterRef} className="flex-1 overflow-y-auto px-6 py-8 scroll-smooth" style={{ scrollbarWidth: 'none' }}>
                    {hasContent ? (
                      <p className={`text-white leading-loose font-medium text-center whitespace-pre-wrap select-none ${isFullscreen ? 'text-4xl' : 'text-xl'}`}
                        style={{ lineHeight: isFullscreen ? '2.4' : '2.2' }}
                      >
                        {fullScript}
                      </p>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-slate-500 text-center">
                        <Tv2 className="w-8 h-8 mb-3 opacity-40" />
                        <p className="text-xs">Write your script first.</p>
                      </div>
                    )}
                    <div style={{ height: '80%' }} />
                  </div>
                  {hasContent && (
                    <div className="shrink-0 bg-slate-800 border-t border-slate-700 px-4 py-3 space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-slate-400 w-12">Speed</span>
                        <input type="range" min={1} max={10} value={speed} onChange={e => setSpeed(Number(e.target.value))}
                          className="flex-1 accent-indigo-500 h-1" />
                        <span className="text-[10px] text-slate-400 w-4 text-right">{speed}</span>
                      </div>
                      <div className="flex items-center justify-center gap-3">
                        <button onClick={resetTeleprompter}
                          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors" title="Reset"
                        >
                          <SkipBack className="w-4 h-4" />
                        </button>
                        <button onClick={() => setPlaying(p => !p)}
                          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${playing ? 'bg-rose-500 hover:bg-rose-600 text-white' : 'bg-indigo-500 hover:bg-indigo-600 text-white'}`}
                        >
                          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          {playing ? 'Pause' : 'Start'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Schedule tab */}
              {previewMode === 'schedule' && (
                <SchedulePanel
                  post={post}
                  allPosts={posts}
                  onSchedule={async (postDate, filmingDate) => {
                    await onSchedule(post.id, postDate, filmingDate);
                    setPreviewOpen(false);
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 shrink-0">
          <p className="text-xs text-slate-400">
            <span className="font-medium text-slate-500">Context:</span>{' '}
            {brandIdentity.icp ? `ICP: ${brandIdentity.icp.slice(0, 60)}...` : 'No Brand Identity set — generation will be generic.'}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Schedule Panel ─────────────────────────────────────────────────────── */

function SchedulePanel({ post, allPosts, onSchedule }: {
  post: Post;
  allPosts: Post[];
  onSchedule: (postDate: string, filmingDate?: string) => Promise<void>;
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
    setSaved(true);
    setSaving(false);
  };

  const postConflicts = postDate ? otherPosts.filter(p => p.date === postDate) : [];
  const filmConflicts = filmDate ? otherPosts.filter(p => p.filmingDate === filmDate || p.date === filmDate) : [];

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Date selectors */}
      <div className="space-y-2">
        <button onClick={() => setSelecting('film')}
          className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${selecting === 'film' ? 'border-blue-400 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:border-blue-200'}`}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${filmDate ? 'bg-blue-500' : 'bg-slate-100'}`}>
            <Camera className={`w-4 h-4 ${filmDate ? 'text-white' : 'text-slate-400'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-0.5">Film Date</p>
            <p className={`text-sm font-semibold ${filmDate ? 'text-slate-900' : 'text-slate-400'}`}>{filmDate || 'Tap to pick on calendar'}</p>
          </div>
          {filmDate && (
            <button onClick={e => { e.stopPropagation(); setFilmDate(''); }}
              className="p-1 rounded-full hover:bg-blue-100 text-slate-400 hover:text-rose-500 transition-colors"
            ><X className="w-3 h-3" /></button>
          )}
        </button>

        <button onClick={() => setSelecting('post')}
          className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${selecting === 'post' ? 'border-emerald-400 bg-emerald-50 shadow-sm' : 'border-slate-200 bg-white hover:border-emerald-200'}`}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${postDate ? 'bg-emerald-500' : 'bg-slate-100'}`}>
            <Rocket className={`w-4 h-4 ${postDate ? 'text-white' : 'text-slate-400'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-0.5">Post Date</p>
            <p className={`text-sm font-semibold ${postDate ? 'text-slate-900' : 'text-slate-400'}`}>{postDate || 'Tap to pick on calendar'}</p>
          </div>
        </button>
      </div>

      {/* Conflict warnings */}
      {postConflicts.length > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          <span>Post date conflicts with <strong>{postConflicts[0].title}</strong></span>
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
          <button onClick={() => setCalDate(new Date(year, month - 1, 1))}
            className="p-1 rounded hover:bg-slate-100 text-slate-500 transition-colors"
          ><ChevronLeft className="w-3.5 h-3.5" /></button>
          <p className="text-xs font-semibold text-slate-700">{monthName}</p>
          <button onClick={() => setCalDate(new Date(year, month + 1, 1))}
            className="p-1 rounded hover:bg-slate-100 text-slate-500 transition-colors"
          ><ChevronRight className="w-3.5 h-3.5" /></button>
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
              <button key={day} onClick={() => handleDay(ds)}
                className={`relative aspect-square flex flex-col items-center justify-center rounded-lg m-0.5 text-[11px] font-medium transition-colors ${isFilm ? 'bg-blue-500 text-white' :
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

      {/* Save */}
      <button onClick={save} disabled={saving || !postDate || saved}
        className="w-full py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarCheck className="w-4 h-4" />}
        {saved ? 'Scheduled!' : saving ? 'Saving...' : 'Save & Schedule'}
      </button>

      {filmDate && postDate && new Date(filmDate) > new Date(postDate) && (
        <p className="text-[11px] text-amber-600 text-center flex items-center justify-center gap-1">
          <AlertTriangle className="w-3 h-3" /> Film date is after post date
        </p>
      )}
    </div>
  );
}

/* ─── Script Section ─────────────────────────────────────────────────────── */

function ScriptSection({ label, sublabel, color, value, onChange, placeholder, rows }: {
  label: string; sublabel: string; color: 'rose' | 'indigo' | 'emerald';
  value: string; onChange: (v: string) => void; placeholder: string; rows: number;
}) {
  const colorMap = {
    rose: { badge: 'bg-rose-100 text-rose-700', border: 'border-rose-200', ring: 'focus:ring-rose-400' },
    indigo: { badge: 'bg-indigo-100 text-indigo-700', border: 'border-indigo-200', ring: 'focus:ring-indigo-500' },
    emerald: { badge: 'bg-emerald-100 text-emerald-700', border: 'border-emerald-200', ring: 'focus:ring-emerald-500' },
  };
  const c = colorMap[color];
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${c.badge}`}>{label}</span>
        <span className="text-xs text-slate-400">{sublabel}</span>
      </div>
      <textarea rows={rows} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className={`w-full px-3 py-2.5 rounded-xl border text-sm text-slate-900 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 transition-shadow leading-relaxed ${c.border} ${c.ring}`}
      />
    </div>
  );
}

function buildSystem(identity: BrandIdentity): string {
  return `You are an elite short-form content scriptwriter specializing in TikTok, Reels, and Shorts.

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

function buildPrompt(post: Post, identity: BrandIdentity): string {
  return `Write a short-form video script for:

TITLE: "${post.title}"
FORMAT: ${post.type}
THEME: ${post.theme}

Respond ONLY with a valid JSON object (no markdown, no explanation):
{
  "hook": "the opening 1-2 sentences that stop the scroll",
  "body": "the core value delivery — insight, story, or tutorial steps",
  "cta": "the closing call to action"
}

The hook must reference the audience's ${identity.empathyMap.pains ? 'pain: ' + identity.empathyMap.pains.split('\n')[0] : 'core challenge'}.`;
}


