import { useState, useRef, useEffect } from 'react';
import {
  Plus, Sparkles, CalendarPlus, X, Loader2, Check, Pencil, Trash2,
  Camera, Rocket, FlaskConical, Maximize2, Minimize2, Lightbulb,
} from 'lucide-react';
import OpenAI from 'openai';
import type { AppState, BrandIdentity, MatrixIdea, Post } from '../types';

const HUES = [
  { bg: 'bg-violet-50', border: 'border-violet-200/60', text: 'text-violet-700', bar: 'bg-violet-400', glass: 'bg-violet-50/80' },
  { bg: 'bg-rose-50', border: 'border-rose-200/60', text: 'text-rose-700', bar: 'bg-rose-400', glass: 'bg-rose-50/80' },
  { bg: 'bg-teal-50', border: 'border-teal-200/60', text: 'text-teal-700', bar: 'bg-teal-400', glass: 'bg-teal-50/80' },
  { bg: 'bg-amber-50', border: 'border-amber-200/60', text: 'text-amber-700', bar: 'bg-amber-400', glass: 'bg-amber-50/80' },
  { bg: 'bg-sky-50', border: 'border-sky-200/60', text: 'text-sky-700', bar: 'bg-sky-400', glass: 'bg-sky-50/80' },
  { bg: 'bg-indigo-50', border: 'border-indigo-200/60', text: 'text-indigo-700', bar: 'bg-indigo-400', glass: 'bg-indigo-50/80' },
] as const;
type Hue = typeof HUES[number];

interface Props {
  state: AppState;
  onAddTheme: (theme: string) => void;
  onRemoveTheme: (theme: string) => void;
  onAddContentType: (type: string) => void;
  onRemoveContentType: (type: string) => void;
  onPlanPost: (post: Omit<Post, 'id'>) => void;
  onAddIdea: (idea: Omit<MatrixIdea, 'id'>) => void;
  onUpdateIdea: (id: string, patch: Partial<MatrixIdea>) => void;
  onDeleteIdea: (id: string) => void;
  onOpenLab: (postId: string) => void;
  onAddAndOpenLab: (post: Omit<Post, 'id'>) => void;
  apiKey: string;
}

type PlanTarget = { title: string; theme: string; type: string; openLabAfter: boolean };

export default function StrategyMatrix({
  state, onAddTheme, onRemoveTheme, onAddContentType, onRemoveContentType,
  onPlanPost, onAddIdea, onUpdateIdea, onDeleteIdea, onOpenLab, onAddAndOpenLab, apiKey,
}: Props) {
  const { themes, contentTypes, brandIdentity, matrixIdeas, aiEnabled, posts, scripts } = state;
  const [loadingCells, setLoadingCells] = useState<Record<string, boolean>>({});
  const [newTheme, setNewTheme] = useState('');
  const [newType, setNewType] = useState('');
  const [planTarget, setPlanTarget] = useState<PlanTarget | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [conceptsTarget, setConceptsTarget] = useState<{ id: string; title: string } | null>(null);
  const [concepts, setConcepts] = useState<string[]>([]);
  const [loadingConcepts, setLoadingConcepts] = useState(false);

  const cellKey = (theme: string, type: string) => `${theme}||${type}`;
  const ideasForCell = (theme: string, type: string) =>
    matrixIdeas.filter(i => i.theme === theme && i.type === type);

  const getLinkedPost = (title: string, theme: string, type: string): Post | undefined =>
    posts.find(p => p.title === title && p.theme === theme && p.type === type);

  const hasScript = (postId: string) =>
    scripts.some(s => s.postId === postId && (s.hook || s.body || s.cta));

  const generateIdeas = async (theme: string, type: string) => {
    if (!apiKey) { alert('Please set your Gemini API key in Settings first.'); return; }
    const key = cellKey(theme, type);
    setLoadingCells(prev => ({ ...prev, [key]: true }));
    try {
      const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
      const prompt = `Generate 3 punchy, viral-ready short-form video TITLES for a "${type}" format video about the theme "${theme}".
Return a JSON object with a "titles" key containing an array of 3 strings.
Example: {"titles": ["Title 1", "Title 2", "Title 3"]}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: buildSystemContext(brandIdentity) },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      });

      const raw = response.choices[0].message.content ?? '{"titles": []}';
      const { titles }: { titles: string[] } = JSON.parse(raw);
      titles.slice(0, 3).forEach(title => onAddIdea({ theme, type, title, done: false }));
    } catch (e) {
      console.error(e);
      onAddIdea({ theme, type, title: '⚠ Could not generate. Check your API key.', done: false });
    } finally {
      setLoadingCells(prev => ({ ...prev, [key]: false }));
    }
  };

  const generateConcepts = async (idea: { id: string; title: string }) => {
    if (!apiKey) { alert('Please set your OpenAI API key in Settings first.'); return; }
    setLoadingConcepts(true);
    setConceptsTarget(idea);
    setConcepts([]);
    try {
      const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
      const prompt = `Based on this Brand Identity:
ICP: ${brandIdentity.icp}
Tone: ${brandIdentity.tone}

And this specific video idea: "${idea.title}"

Generate 3 unique and strategic "Script Concepts" or "Strategic Angles" for this video.
Return a JSON object with a "concepts" key containing an array of 3 strings. Each string should be 1-2 sentences explaining the angle.`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });

      const raw = response.choices[0].message.content ?? '{}';
      const parsed: { concepts: string[] } = JSON.parse(raw);
      setConcepts(parsed.concepts || []);
    } catch (e) {
      console.error(e);
      setConcepts(['Failed to generate concepts. Check your OpenAI API key.']);
    } finally {
      setLoadingConcepts(false);
    }
  };

  const handlePlan = (theme: string, type: string, title: string) =>
    setPlanTarget({ title, theme, type, openLabAfter: false });

  const handleScript = (theme: string, type: string, title: string) => {
    const linked = getLinkedPost(title, theme, type);
    if (linked) onOpenLab(linked.id);
    else setPlanTarget({ title, theme, type, openLabAfter: true });
  };

  const confirmPlan = (postDate: string, filmingDate?: string) => {
    if (!planTarget) return;
    const post: Omit<Post, 'id'> = {
      title: planTarget.title, date: postDate, filmingDate,
      status: 'IDEA', theme: planTarget.theme, type: planTarget.type,
    };
    if (planTarget.openLabAfter) onAddAndOpenLab(post);
    else onPlanPost(post);
    setPlanTarget(null);
  };

  const addTheme = () => {
    const t = newTheme.trim();
    if (t && !themes.includes(t)) { onAddTheme(t); setNewTheme(''); }
  };
  const addType = () => {
    const t = newType.trim();
    if (t && !contentTypes.includes(t)) { onAddContentType(t); setNewType(''); }
  };

  const totalIdeas = matrixIdeas.length;
  const totalDone = matrixIdeas.filter(i => i.done).length;

  const board = (
    <div className={`${isFullscreen ? 'flex flex-col gap-5 h-full p-6' : 'p-6 max-w-7xl mx-auto space-y-5'}`}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Strategy Matrix</h1>
          <p className="text-slate-500 text-sm mt-1">
            {totalIdeas > 0
              ? `${totalDone} of ${totalIdeas} ideas scripted or done · ${themes.length} themes × ${contentTypes.length} formats`
              : 'Cross-reference themes and formats. Click an idea to write its script.'}
          </p>
        </div>
        <button
          onClick={() => setIsFullscreen(f => !f)}
          className="shrink-0 flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-500 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all hover:shadow-sm"
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen workspace'}
        >
          {isFullscreen
            ? <><Minimize2 className="w-3.5 h-3.5" /> Exit fullscreen</>
            : <><Maximize2 className="w-3.5 h-3.5" /> Fullscreen</>
          }
        </button>
      </div>

      {/* ── Manage bar ─────────────────────────────────────────────── */}
      <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-sm shadow-slate-100 px-5 py-3.5 flex items-center gap-4 flex-wrap">

        {/* Themes */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 shrink-0">Themes</span>
          {themes.map((t, i) => {
            const h = HUES[i % HUES.length];
            return (
              <span key={t} className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full leading-none border ${h.glass} ${h.border} ${h.text} backdrop-blur-sm`}>
                {t}
                <button onClick={() => onRemoveTheme(t)} className="opacity-40 hover:opacity-100 hover:text-rose-500 transition-all ml-0.5">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            );
          })}
          <div className="flex items-center gap-1">
            <input type="text" value={newTheme} onChange={e => setNewTheme(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTheme()} placeholder="Add theme"
              className="w-24 text-[11px] px-2.5 py-1 rounded-full border border-slate-200 bg-slate-50/80 focus:outline-none focus:ring-1 focus:ring-indigo-300 focus:bg-white transition placeholder-slate-300"
            />
            <button onClick={addTheme} className="w-5 h-5 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center justify-center shrink-0">
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="w-px h-6 bg-slate-200/60 shrink-0" />

        {/* Formats */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 shrink-0">Formats</span>
          {contentTypes.map(t => (
            <span key={t} className="flex items-center gap-1 bg-slate-100/80 text-slate-600 text-[11px] font-semibold px-2.5 py-1 rounded-full leading-none border border-slate-200/60 backdrop-blur-sm">
              {t}
              <button onClick={() => onRemoveContentType(t)} className="opacity-40 hover:opacity-100 hover:text-rose-500 transition-all ml-0.5">
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
          <div className="flex items-center gap-1">
            <input type="text" value={newType} onChange={e => setNewType(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addType()} placeholder="Add format"
              className="w-24 text-[11px] px-2.5 py-1 rounded-full border border-slate-200 bg-slate-50/80 focus:outline-none focus:ring-1 focus:ring-violet-300 focus:bg-white transition placeholder-slate-300"
            />
            <button onClick={addType} className="w-5 h-5 rounded-full bg-violet-600 text-white hover:bg-violet-700 transition-colors flex items-center justify-center shrink-0">
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>

        {!aiEnabled && (
          <span className="ml-auto text-[11px] text-slate-400 border border-slate-200/60 bg-slate-50/80 backdrop-blur-sm px-3 py-1 rounded-full shrink-0">
            ✦ AI off — enable in Settings
          </span>
        )}
        {aiEnabled && (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-indigo-500 bg-indigo-50/80 border border-indigo-100 backdrop-blur-sm px-3 py-1 rounded-full shrink-0">
            <Sparkles className="w-3 h-3" /> AI on
          </span>
        )}
      </div>

      {/* ── Board ──────────────────────────────────────────────────── */}
      {themes.length > 0 && contentTypes.length > 0 ? (
        <div className={`${isFullscreen ? 'flex-1 min-h-0' : ''}`}>
          {/* Gradient backdrop for glass depth */}
          <div className="relative rounded-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-100/20 via-slate-50/10 to-indigo-100/20 pointer-events-none" />
            <div className={`relative overflow-auto rounded-2xl ${isFullscreen ? 'max-h-[calc(100vh-240px)]' : 'max-h-[calc(100vh-260px)]'}`}>
              <table
                className="border-separate w-full"
                style={{ borderSpacing: '5px', minWidth: `${130 + contentTypes.length * 190}px` }}
              >
                <colgroup>
                  <col style={{ width: '128px' }} />
                  {contentTypes.map(t => <col key={t} />)}
                </colgroup>

                {/* Sticky glass column headers */}
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className="rounded-xl bg-white/70 backdrop-blur-2xl border border-slate-200/50 shadow-sm py-2.5 px-3 text-left align-middle">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Theme</span>
                    </th>
                    {contentTypes.map(type => (
                      <th key={type} className="rounded-xl bg-white/70 backdrop-blur-2xl border border-slate-200/50 shadow-sm py-3 px-3 text-center">
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-100 border border-indigo-100/60 flex items-center justify-center shadow-sm">
                            <span className="text-sm font-bold text-indigo-600">{type[0].toUpperCase()}</span>
                          </div>
                          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide leading-none truncate max-w-full px-1" title={type}>
                            {type}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {themes.map((theme, ti) => {
                    const hue = HUES[ti % HUES.length];
                    const allIdeas = contentTypes.flatMap(type => ideasForCell(theme, type));
                    const doneCt = allIdeas.filter(i => i.done).length;
                    return (
                      <tr key={theme}>
                        {/* Theme label */}
                        <td className={`rounded-xl border ${hue.border} ${hue.glass} backdrop-blur-sm p-3 align-top`}>
                          <p className={`text-[11px] font-bold ${hue.text} uppercase tracking-wider leading-snug break-words mb-3`}>
                            {theme}
                          </p>
                          {allIdeas.length > 0 && (
                            <div>
                              <p className={`text-[10px] ${hue.text} opacity-60 mb-1.5 tabular-nums`}>{doneCt}/{allIdeas.length}</p>
                              <div className="h-1 bg-white/60 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${hue.bar} rounded-full transition-all duration-700`}
                                  style={{ width: `${allIdeas.length ? (doneCt / allIdeas.length) * 100 : 0}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Idea cells */}
                        {contentTypes.map(type => {
                          const key = cellKey(theme, type);
                          const ideas = ideasForCell(theme, type);
                          const loading = loadingCells[key] ?? false;
                          return (
                            <td key={type} className="rounded-xl bg-white/85 backdrop-blur-sm border border-white/80 shadow-sm p-2 align-top">
                              <IdeaCell
                                ideas={ideas} loading={loading} aiEnabled={aiEnabled} hue={hue}
                                getLinkedPost={title => getLinkedPost(title, theme, type)}
                                hasScript={hasScript}
                                onAdd={title => onAddIdea({ theme, type, title, done: false })}
                                onToggle={id => onUpdateIdea(id, { done: !ideas.find(i => i.id === id)?.done })}
                                onEdit={(id, title) => onUpdateIdea(id, { title })}
                                onDelete={onDeleteIdea}
                                onPlan={title => handlePlan(theme, type, title)}
                                onScript={title => handleScript(theme, type, title)}
                                onGenerate={() => generateIdeas(theme, type)}
                                onConcepts={generateConcepts}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-2xl flex items-center justify-center py-24">
          <div className="text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-100 border border-indigo-100 flex items-center justify-center mx-auto shadow-sm">
              <Sparkles className="w-7 h-7 text-indigo-400" />
            </div>
            <p className="text-sm font-semibold text-slate-600">Your content matrix is empty</p>
            <p className="text-xs text-slate-400">Add themes and formats above to get started</p>
          </div>
        </div>
      )}

      {conceptsTarget && (
        <ConceptsModal
          title={conceptsTarget.title}
          concepts={concepts}
          loading={loadingConcepts}
          onClose={() => setConceptsTarget(null)}
        />
      )}
    </div>
  );

  if (isFullscreen) {
    return (
      <>
        <div className="fixed inset-0 z-[100] bg-gradient-to-br from-slate-50 via-white to-violet-50/40 overflow-y-auto">
          {board}
        </div>
        {planTarget && <PlanModalPortal target={planTarget} onConfirm={confirmPlan} onPlanPost={onPlanPost} onClose={() => setPlanTarget(null)} />}
      </>
    );
  }

  return (
    <>
      {board}
      {planTarget && <PlanModalPortal target={planTarget} onConfirm={confirmPlan} onPlanPost={onPlanPost} onClose={() => setPlanTarget(null)} />}
    </>
  );
}

/* thin wrapper so PlanModal works in both modes */
function PlanModalPortal({ target, onConfirm, onPlanPost, onClose }: {
  target: PlanTarget;
  onConfirm: (postDate: string, filmingDate?: string) => void;
  onPlanPost: (post: Omit<Post, 'id'>) => void;
  onClose: () => void;
}) {
  return (
    <PlanModal
      title={target.title} theme={target.theme} type={target.type}
      openLabAfter={target.openLabAfter}
      onConfirm={onConfirm}
      onConfirmCalendarOnly={(postDate, filmingDate) => {
        onPlanPost({ title: target.title, date: postDate, filmingDate, status: 'IDEA', theme: target.theme, type: target.type });
        onClose();
      }}
      onClose={onClose}
    />
  );
}

/* ─── Idea Cell ──────────────────────────────────────────────────────────── */

function IdeaCell({
  ideas, loading, aiEnabled, hue,
  getLinkedPost, hasScript,
  onAdd, onToggle, onEdit, onDelete, onPlan, onScript, onGenerate, onConcepts,
}: {
  ideas: MatrixIdea[];
  loading: boolean; aiEnabled: boolean; hue: Hue;
  getLinkedPost: (title: string) => Post | undefined;
  hasScript: (postId: string) => boolean;
  onAdd: (title: string) => void;
  onToggle: (id: string) => void;
  onEdit: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onPlan: (title: string) => void;
  onScript: (title: string) => void;
  onGenerate: () => void;
  onConcepts: (idea: { id: string; title: string }) => void;
}) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const v = inputValue.trim();
    if (!v) return;
    onAdd(v); setInputValue('');
  };

  return (
    <div className="flex flex-col gap-0.5 min-h-[72px]">
      <ul className="space-y-px">
        {ideas.map(idea => {
          const linked = getLinkedPost(idea.title);
          const scripted = linked ? hasScript(linked.id) : false;
          return (
            <IdeaRow
              key={idea.id} idea={idea}
              linkedPostId={linked?.id} isScripted={scripted} hue={hue}
              onToggle={() => onToggle(idea.id)}
              onEdit={title => onEdit(idea.id, title)}
              onDelete={() => onDelete(idea.id)}
              onPlan={() => onPlan(idea.title)}
              onScript={() => onScript(idea.title)}
              onConcepts={() => onConcepts({ id: idea.id, title: idea.title })}
            />
          );
        })}
      </ul>

      {loading && (
        <div className="flex items-center gap-1.5 text-indigo-400 text-[11px] py-1 px-1">
          <Loader2 className="w-3 h-3 animate-spin shrink-0" /> Generating…
        </div>
      )}

      {/* Add row */}
      <div className="flex items-center gap-1 mt-auto pt-1">
        <input
          ref={inputRef} type="text" value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Add idea…"
          className="min-w-0 flex-1 w-0 text-[11px] px-2 py-1 rounded-lg border border-slate-100 bg-slate-50/70 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-200 focus:bg-white transition"
        />
        <button onClick={submit} disabled={!inputValue.trim()}
          className="shrink-0 p-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-30 transition-colors"
          title="Add idea"
        >
          <Plus className="w-3 h-3" />
        </button>
        {aiEnabled && (
          <button onClick={onGenerate} disabled={loading}
            className="shrink-0 p-1 rounded-lg text-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 transition-colors"
            title="Generate with AI"
          >
            <Sparkles className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Idea Row ───────────────────────────────────────────────────────────── */

function IdeaRow({
  idea, linkedPostId, isScripted, hue, onToggle, onEdit, onDelete, onPlan, onScript, onConcepts,
}: {
  idea: MatrixIdea;
  linkedPostId?: string; isScripted: boolean; hue: Hue;
  onToggle: () => void; onEdit: (t: string) => void;
  onDelete: () => void; onPlan: () => void; onScript: () => void;
  onConcepts: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(idea.title);
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) editRef.current?.focus(); }, [editing]);

  const commitEdit = () => {
    const v = draft.trim();
    if (v && v !== idea.title) onEdit(v); else setDraft(idea.title);
    setEditing(false);
  };

  return (
    <li className={`group flex items-start gap-1.5 px-1.5 py-1 rounded-lg transition-all duration-150 ${idea.done ? 'opacity-40' : 'hover:bg-slate-50/80'}`}>

      {/* Circle checkbox */}
      <button
        onClick={onToggle}
        className={`shrink-0 mt-[3px] w-3 h-3 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${idea.done ? `${hue.bar} border-transparent` : 'border-slate-300 hover:border-slate-400'
          }`}
      >
        {idea.done && <Check className="w-1.5 h-1.5 text-white" />}
      </button>

      {/* Title */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input ref={editRef} type="text" value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => {
              if (e.key === 'Enter') commitEdit();
              if (e.key === 'Escape') { setDraft(idea.title); setEditing(false); }
            }}
            className="w-full text-[11px] px-1.5 py-0.5 rounded-lg border border-indigo-200 bg-indigo-50/80 focus:outline-none focus:ring-1 focus:ring-indigo-400 backdrop-blur-sm"
          />
        ) : (
          <button
            onClick={onScript}
            className={`w-full text-left text-[11px] leading-snug transition-colors duration-150 ${idea.done ? 'line-through text-slate-400 cursor-default' : 'text-slate-700 hover:text-indigo-600 cursor-pointer'
              }`}
            title={idea.title}
          >
            <span className="[overflow-wrap:break-word] [word-break:break-word]">{idea.title}</span>
            {isScripted && (
              <span className="ml-1 inline-flex items-center gap-0.5 text-[9px] font-bold bg-emerald-100/80 text-emerald-600 px-1.5 py-px rounded-full align-middle border border-emerald-200/40">
                <FlaskConical className="w-2 h-2" /> scripted
              </span>
            )}
            {linkedPostId && !isScripted && (
              <span className="ml-1 inline-flex text-[9px] font-bold bg-indigo-100/80 text-indigo-500 px-1.5 py-px rounded-full align-middle border border-indigo-200/40">
                planned
              </span>
            )}
          </button>
        )}
      </div>

      {/* Hover actions */}
      {!editing && (
        <div className="shrink-0 flex items-center gap-px opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button onClick={onConcepts} className="p-0.5 rounded text-indigo-400 hover:text-indigo-600 transition-colors" title="Generate Concepts">
            <Lightbulb className="w-2.5 h-2.5" />
          </button>
          <button onClick={() => setEditing(true)} className="p-0.5 rounded text-slate-300 hover:text-slate-600 transition-colors" title="Edit">
            <Pencil className="w-2.5 h-2.5" />
          </button>
          <button onClick={onPlan} className="p-0.5 rounded text-slate-300 hover:text-blue-500 transition-colors" title="Add to Calendar">
            <CalendarPlus className="w-2.5 h-2.5" />
          </button>
          <button onClick={onScript}
            className={`p-0.5 rounded transition-colors ${isScripted ? 'text-emerald-400 hover:text-emerald-600' : 'text-slate-300 hover:text-indigo-500'}`}
            title={linkedPostId ? 'Open Script Lab' : 'Add & Script'}
          >
            <FlaskConical className="w-2.5 h-2.5" />
          </button>
          <button onClick={onDelete} className="p-0.5 rounded text-slate-300 hover:text-rose-500 transition-colors" title="Delete">
            <Trash2 className="w-2.5 h-2.5" />
          </button>
        </div>
      )}
    </li>
  );
}

/* ─── Plan Modal ─────────────────────────────────────────────────────────── */

function PlanModal({ title, theme, type, openLabAfter, onConfirm, onConfirmCalendarOnly, onClose }: {
  title: string; theme: string; type: string; openLabAfter: boolean;
  onConfirm: (postDate: string, filmingDate?: string) => void;
  onConfirmCalendarOnly?: (postDate: string, filmingDate?: string) => void;
  onClose: () => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  const [postDate, setPostDate] = useState(today);
  const [filmDate, setFilmDate] = useState('');
  const filmAfterPost = filmDate && postDate && filmDate > postDate;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-md z-[200] flex items-center justify-center p-4">
      <div className="bg-white/90 backdrop-blur-2xl rounded-2xl shadow-2xl shadow-slate-200/60 border border-white/80 w-full max-w-sm overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900">{openLabAfter ? 'Add & Script' : 'Add to Calendar'}</h3>
              <p className="text-sm text-slate-700 font-medium truncate mt-0.5">{title}</p>
              <p className="text-xs text-slate-400 mt-0.5">{theme} · {type}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100/80 text-slate-400 transition-colors shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-4">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-500 mb-2">
              <Camera className="w-3.5 h-3.5" /> Film Date <span className="text-slate-400 font-normal normal-case tracking-normal ml-1">optional</span>
            </label>
            <input type="date" value={filmDate} onChange={e => setFilmDate(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-blue-100 bg-blue-50/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-300 transition-all"
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-600 mb-2">
              <Rocket className="w-3.5 h-3.5" /> Post Date <span className="text-rose-400 font-normal normal-case tracking-normal ml-1">required</span>
            </label>
            <input type="date" value={postDate} onChange={e => setPostDate(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-emerald-100 bg-emerald-50/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 transition-all"
            />
          </div>

          {filmAfterPost && (
            <p className="text-xs text-amber-600 bg-amber-50/80 border border-amber-200/60 rounded-xl px-3 py-2 backdrop-blur-sm">
              ⚠ Film date is after post date — double check your schedule.
            </p>
          )}

          <div className="flex flex-col gap-2 pt-1">
            <button onClick={() => onConfirm(postDate, filmDate || undefined)} disabled={!postDate}
              className="w-full px-4 py-2.5 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 transition-colors flex items-center justify-center gap-2 shadow-sm shadow-indigo-200"
            >
              {openLabAfter ? <><FlaskConical className="w-4 h-4" /> Add & Open Script Lab</> : <><CalendarPlus className="w-4 h-4" /> Add to Calendar</>}
            </button>
            {openLabAfter && onConfirmCalendarOnly && (
              <button onClick={() => onConfirmCalendarOnly(postDate, filmDate || undefined)} disabled={!postDate}
                className="w-full px-4 py-2.5 text-sm font-medium rounded-xl border border-slate-200/80 bg-white/60 backdrop-blur-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
              >
                <CalendarPlus className="w-4 h-4" /> Just add to Calendar
              </button>
            )}
            <button onClick={onClose} className="w-full px-4 py-2 text-sm text-slate-400 hover:text-slate-600 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildSystemContext(identity: BrandIdentity): string {
  const { icp, empathyMap, positioning, tone } = identity;
  return `You are an expert short-form content strategist.

BRAND CONTEXT:
- ICP: ${icp || 'Not defined'}
- Positioning: ${positioning || 'Not defined'}
- Tone: ${tone || 'Not defined'}
- Audience Pains: ${empathyMap.pains || 'Not defined'}
- Audience Gains: ${empathyMap.gains || 'Not defined'}
- Audience Fears: ${empathyMap.fears || 'Not defined'}
- Audience Hopes: ${empathyMap.hopes || 'Not defined'}

Use this context to ensure all generated content is hyper-relevant to this specific audience.`;
}

function ConceptsModal({ title, concepts, loading, onClose }: {
  title: string;
  concepts: string[];
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-md z-[200] flex items-center justify-center p-4">
      <div className="bg-white/90 backdrop-blur-2xl rounded-2xl shadow-2xl shadow-slate-200/60 border border-white/80 w-full max-w-md overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Lightbulb className="w-4 h-4 text-indigo-500" />
                <h3 className="text-base font-bold text-slate-900">Script Concepts</h3>
              </div>
              <p className="text-sm text-slate-700 font-medium truncate">{title}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100/80 text-slate-400 transition-colors shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <p className="text-sm font-medium text-slate-500">Generating strategic angles...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {concepts.map((concept, i) => (
                <div key={i} className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/50 relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-indigo-400" />
                  <p className="text-sm text-slate-800 leading-relaxed">{concept}</p>
                </div>
              ))}
              {concepts.length === 0 && !loading && (
                <p className="text-sm text-slate-400 text-center py-8">No concepts generated yet.</p>
              )}
            </div>
          )}

          <button onClick={onClose} className="w-full px-4 py-2.5 text-sm font-semibold rounded-xl bg-slate-900 text-white hover:bg-black transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
