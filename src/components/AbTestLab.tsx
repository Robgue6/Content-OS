import { useState, useMemo } from 'react';
import {
  Plus, Trash2, Sparkles, Loader2, Trophy, ChevronRight,
  SplitSquareHorizontal, FlaskConical, ArrowRight, X, Check,
  BarChart3, TrendingUp, Eye, Heart, MessageCircle, Share2,
  Bookmark, UserPlus, Clock, FileText,
} from 'lucide-react';
import OpenAI from 'openai';
import type { Post, Script, BrandIdentity, AbTest, AbTestResult, AbVariant, AbTestVariable, AbTestStatus } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────

interface Props {
  posts: Post[];
  scripts: Script[];
  brandIdentity: BrandIdentity;
  abTests: AbTest[];
  abTestResults: AbTestResult[];
  onAddTest: (t: Omit<AbTest, 'id' | 'createdAt'>) => Promise<void>;
  onUpdateTest: (id: string, patch: Partial<Omit<AbTest, 'id' | 'createdAt'>>) => Promise<void>;
  onDeleteTest: (id: string) => Promise<void>;
  onAddResult: (r: Omit<AbTestResult, 'id'>) => Promise<void>;
  onUpdateResult: (id: string, patch: Partial<Omit<AbTestResult, 'id' | 'testId' | 'variant'>>) => Promise<void>;
  onDeleteResult: (id: string) => Promise<void>;
}

interface AiVariantB {
  title: string;
  content: string;
  strategy: string;
}

interface AiVerdict {
  winner: 'A' | 'B';
  reason: string;
  keyInsight: string;
  recommendation: string;
}

// ── Computed metrics ───────────────────────────────────────────────────────

function engRate(r: AbTestResult): number {
  if (!r.views) return 0;
  return ((r.likes + r.comments + r.shares + r.saves) / r.views) * 100;
}

function followRate(r: AbTestResult): number {
  if (!r.views) return 0;
  return (r.follows / r.views) * 100;
}

function fmtNum(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

function fmtPct(n: number): string {
  return n.toFixed(2) + '%';
}

function fmtTime(s: number): string {
  if (s >= 60) return Math.floor(s / 60) + 'm ' + (s % 60) + 's';
  return s + 's';
}

function delta(a: number, b: number): { pct: number; winner: 'A' | 'B' | 'tie' } {
  if (a === 0 && b === 0) return { pct: 0, winner: 'tie' };
  if (a === 0) return { pct: 100, winner: 'B' };
  if (b === 0) return { pct: 100, winner: 'A' };
  const pct = Math.abs((b - a) / a) * 100;
  return { pct, winner: a > b ? 'A' : b > a ? 'B' : 'tie' };
}

// ── Variable config ────────────────────────────────────────────────────────

const VARIABLE_META: Record<AbTestVariable, { label: string; color: string; bg: string; desc: string }> = {
  hook:   { label: 'Hook',         color: 'text-rose-700',    bg: 'bg-rose-50 border-rose-200',    desc: 'Two different opening lines' },
  cta:    { label: 'CTA',          color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200',    desc: 'Two different calls to action' },
  type:   { label: 'Format',       color: 'text-violet-700',  bg: 'bg-violet-50 border-violet-200', desc: 'Tutorial vs Story vs Listicle' },
  theme:  { label: 'Theme',        color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',  desc: 'Same concept, different theme' },
  script: { label: 'Full Script',  color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', desc: 'Complete script A vs script B' },
};

// ── Sub-components ─────────────────────────────────────────────────────────

function StatusPill({ status }: { status: AbTestStatus }) {
  const cfg = {
    planning:  { label: 'Planning',  cls: 'bg-slate-100 text-slate-600' },
    live:      { label: 'Live',      cls: 'bg-emerald-100 text-emerald-700' },
    completed: { label: 'Completed', cls: 'bg-indigo-100 text-indigo-700' },
  }[status];
  return <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>;
}

function WinnerBadge({ winner }: { winner: 'A' | 'B' }) {
  return (
    <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
      <Trophy className="w-2.5 h-2.5" /> Winner {winner}
    </span>
  );
}

// ── Metric row for comparison table ───────────────────────────────────────

function MetricRow({ label, icon, valA, valB, fmtA, fmtB, higherIsBetter = true }: {
  label: string; icon: React.ReactNode;
  valA: number; valB: number;
  fmtA: string; fmtB: string;
  higherIsBetter?: boolean;
}) {
  const d = delta(valA, valB);
  const aWins = (d.winner === 'A' && higherIsBetter) || (d.winner === 'B' && !higherIsBetter);
  const bWins = (d.winner === 'B' && higherIsBetter) || (d.winner === 'A' && !higherIsBetter);
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-2.5 pl-4 pr-3 text-xs text-slate-500 whitespace-nowrap">
        <div className="flex items-center gap-1.5">{icon}{label}</div>
      </td>
      <td className={`py-2.5 px-4 text-sm font-semibold text-center ${aWins ? 'text-emerald-600' : 'text-slate-700'}`}>
        {fmtA}
        {aWins && d.pct > 0 && <span className="ml-1 text-[10px] text-emerald-500">↑</span>}
      </td>
      <td className={`py-2.5 px-4 text-sm font-semibold text-center ${bWins ? 'text-emerald-600' : 'text-slate-700'}`}>
        {fmtB}
        {bWins && d.pct > 0 && <span className="ml-1 text-[10px] text-emerald-500">↑</span>}
      </td>
      <td className="py-2.5 pl-3 pr-4 text-[11px] text-slate-400 text-right whitespace-nowrap">
        {d.winner !== 'tie' && d.pct > 0.5
          ? <span className={`font-medium ${aWins ? 'text-emerald-600' : bWins ? 'text-emerald-600' : ''}`}>
              {d.winner} +{d.pct.toFixed(0)}%
            </span>
          : <span className="text-slate-300">—</span>}
      </td>
    </tr>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function AbTestLab({
  posts, scripts, brandIdentity,
  abTests, abTestResults,
  onAddTest, onUpdateTest, onDeleteTest,
  onAddResult, onUpdateResult, onDeleteResult,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(abTests[0]?.id ?? null);
  const [filterStatus, setFilterStatus] = useState<AbTestStatus | 'all'>('all');
  const [showWizard, setShowWizard] = useState(false);
  const [showLogModal, setShowLogModal] = useState<{ variant: 'A' | 'B' } | null>(null);
  const [showEditResult, setShowEditResult] = useState<AbTestResult | null>(null);
  const [generatingVariantB, setGeneratingVariantB] = useState(false);
  const [generatingVerdict, setGeneratingVerdict] = useState(false);
  const [verdictError, setVerdictError] = useState('');

  const selected = abTests.find(t => t.id === selectedId) ?? null;
  const testResults = useMemo(() => abTestResults.filter(r => r.testId === selectedId), [abTestResults, selectedId]);
  const resultA = testResults.find(r => r.variant === 'A') ?? null;
  const resultB = testResults.find(r => r.variant === 'B') ?? null;

  const filtered = useMemo(() => {
    if (filterStatus === 'all') return abTests;
    return abTests.filter(t => t.status === filterStatus);
  }, [abTests, filterStatus]);

  const counts = useMemo(() => ({
    all: abTests.length,
    planning: abTests.filter(t => t.status === 'planning').length,
    live: abTests.filter(t => t.status === 'live').length,
    completed: abTests.filter(t => t.status === 'completed').length,
  }), [abTests]);

  // Generate Variant B via AI
  const generateVariantB = async () => {
    if (!selected) return;
    const orKey = import.meta.env.VITE_OPENROUTER_API_KEY as string;
    if (!orKey) return;
    setGeneratingVariantB(true);
    try {
      const openai = new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: orKey, dangerouslyAllowBrowser: true });
      const resp = await openai.chat.completions.create({
        model: 'arcee-ai/trinity-large-preview:free',
        messages: [
          { role: 'system', content: 'You are an expert short-form content strategist. Return ONLY valid JSON, no markdown.' },
          { role: 'user', content: buildVariantBPrompt(selected, brandIdentity) },
        ],
        response_format: { type: 'json_object' },
      });
      const raw = resp.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw) as AiVariantB;
      if (parsed.title && parsed.content) {
        await onUpdateTest(selected.id, {
          variantB: { title: parsed.title, content: parsed.content },
        });
      }
    } catch (e) {
      console.error('generateVariantB', e);
    } finally {
      setGeneratingVariantB(false);
    }
  };

  // AI Declare Winner
  const declareWinner = async () => {
    if (!selected || !resultA || !resultB) return;
    const orKey = import.meta.env.VITE_OPENROUTER_API_KEY as string;
    if (!orKey) { setVerdictError('OpenRouter API key is not configured.'); return; }
    setGeneratingVerdict(true);
    setVerdictError('');
    try {
      const openai = new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: orKey, dangerouslyAllowBrowser: true });
      const resp = await openai.chat.completions.create({
        model: 'arcee-ai/trinity-large-preview:free',
        messages: [
          { role: 'system', content: 'You are an elite content performance analyst. Return ONLY valid JSON, no markdown.' },
          { role: 'user', content: buildVerdictPrompt(selected, resultA, resultB, brandIdentity) },
        ],
        response_format: { type: 'json_object' },
      });
      const raw = resp.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw) as AiVerdict;
      if (parsed.winner && parsed.reason) {
        await onUpdateTest(selected.id, {
          winner: parsed.winner,
          winnerReason: `${parsed.reason}\n\n💡 Key insight: ${parsed.keyInsight}\n\n→ ${parsed.recommendation}`,
          status: 'completed',
        });
      }
    } catch (e) {
      console.error('declareWinner', e);
      setVerdictError('AI analysis failed — try again.');
    } finally {
      setGeneratingVerdict(false);
    }
  };

  const deleteResult = async (r: AbTestResult) => {
    await onDeleteResult(r.id);
  };

  // ── Empty state ──────────────────────────────────────────────────────────
  if (abTests.length === 0 && !showWizard) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-12 text-center">
        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-5">
          <SplitSquareHorizontal className="w-8 h-8 text-emerald-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">A/B Content Testing</h2>
        <p className="text-sm text-slate-500 max-w-sm mb-6 leading-relaxed">
          Stop guessing what works. Test hooks, CTAs, formats, and angles head-to-head — then let AI declare the winner with psychological reasoning.
        </p>
        <button
          onClick={() => setShowWizard(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Create your first test
        </button>
        {showWizard && <NewTestWizard posts={posts} scripts={scripts} onSave={async (t) => { await onAddTest(t); setShowWizard(false); }} onClose={() => setShowWizard(false)} />}
      </div>
    );
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="w-72 shrink-0 border-r border-slate-200 bg-white flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <SplitSquareHorizontal className="w-4 h-4 text-emerald-600" />
              <h1 className="text-sm font-bold text-slate-900">A/B Tests</h1>
            </div>
            <button
              onClick={() => setShowWizard(true)}
              className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="w-3 h-3" /> New
            </button>
          </div>
          {/* Filter pills */}
          <div className="flex flex-wrap gap-1">
            {(['all', 'planning', 'live', 'completed'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors capitalize ${
                  filterStatus === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {s === 'all' ? `All ${counts.all}` : `${s.charAt(0).toUpperCase() + s.slice(1)} ${counts[s]}`}
              </button>
            ))}
          </div>
        </div>

        {/* Test list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="p-4 text-xs text-slate-400 text-center">No {filterStatus !== 'all' ? filterStatus : ''} tests yet.</p>
          ) : (
            filtered.map(test => {
              const vm = VARIABLE_META[test.variable];
              const isActive = selectedId === test.id;
              const tResults = abTestResults.filter(r => r.testId === test.id);
              return (
                <button
                  key={test.id}
                  onClick={() => setSelectedId(test.id)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-100 transition-colors ${
                    isActive ? 'bg-emerald-50 border-l-2 border-l-emerald-500' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">{test.name}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${vm.bg} ${vm.color}`}>
                          {vm.label}
                        </span>
                        <StatusPill status={test.status} />
                        {test.winner && <WinnerBadge winner={test.winner} />}
                      </div>
                      {tResults.length > 0 && (
                        <p className="text-[10px] text-slate-400 mt-1">{tResults.length}/2 results logged</p>
                      )}
                    </div>
                    <ChevronRight className={`w-3 h-3 mt-0.5 shrink-0 ${isActive ? 'text-emerald-600' : 'text-slate-300'}`} />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* ── Main panel ──────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto bg-slate-50">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            Select a test from the sidebar
          </div>
        ) : (
          <TestDetail
            test={selected}
            resultA={resultA}
            resultB={resultB}
            posts={posts}
            scripts={scripts}
            generatingVariantB={generatingVariantB}
            generatingVerdict={generatingVerdict}
            verdictError={verdictError}
            onUpdateTest={(patch) => onUpdateTest(selected.id, patch)}
            onDeleteTest={() => { onDeleteTest(selected.id); setSelectedId(abTests.find(t => t.id !== selected.id)?.id ?? null); }}
            onLogResult={(variant) => setShowLogModal({ variant })}
            onEditResult={(r) => setShowEditResult(r)}
            onDeleteResult={deleteResult}
            onGenerateVariantB={generateVariantB}
            onDeclareWinner={declareWinner}
          />
        )}
      </main>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      {showWizard && (
        <NewTestWizard
          posts={posts}
          scripts={scripts}
          onSave={async (t) => { await onAddTest(t); setShowWizard(false); setSelectedId(abTests[0]?.id ?? null); }}
          onClose={() => setShowWizard(false)}
        />
      )}
      {showLogModal && selected && (
        <LogResultsModal
          testId={selected.id}
          variant={showLogModal.variant}
          existingResult={showLogModal.variant === 'A' ? resultA : resultB}
          onSave={async (r) => {
            const existing = showLogModal.variant === 'A' ? resultA : resultB;
            if (existing) {
              await onUpdateResult(existing.id, r);
            } else {
              await onAddResult({ ...r, testId: selected.id, variant: showLogModal.variant });
            }
            setShowLogModal(null);
          }}
          onClose={() => setShowLogModal(null)}
        />
      )}
      {showEditResult && (
        <LogResultsModal
          testId={showEditResult.testId}
          variant={showEditResult.variant}
          existingResult={showEditResult}
          onSave={async (r) => {
            await onUpdateResult(showEditResult.id, r);
            setShowEditResult(null);
          }}
          onClose={() => setShowEditResult(null)}
        />
      )}
    </div>
  );
}

// ── TestDetail ─────────────────────────────────────────────────────────────

function TestDetail({
  test, resultA, resultB, posts, scripts,
  generatingVariantB, generatingVerdict, verdictError,
  onUpdateTest, onDeleteTest, onLogResult, onEditResult, onDeleteResult,
  onGenerateVariantB, onDeclareWinner,
}: {
  test: AbTest;
  resultA: AbTestResult | null;
  resultB: AbTestResult | null;
  posts: Post[];
  scripts: Script[];
  generatingVariantB: boolean;
  generatingVerdict: boolean;
  verdictError: string;
  onUpdateTest: (patch: Partial<Omit<AbTest, 'id' | 'createdAt'>>) => Promise<void>;
  onDeleteTest: () => void;
  onLogResult: (variant: 'A' | 'B') => void;
  onEditResult: (r: AbTestResult) => void;
  onDeleteResult: (r: AbTestResult) => void;
  onGenerateVariantB: () => void;
  onDeclareWinner: () => void;
}) {
  const vm = VARIABLE_META[test.variable];
  const linkedPost = posts.find(p => p.id === test.postId) ?? null;
  const linkedScript = linkedPost ? scripts.find(s => s.postId === linkedPost.id) ?? null : null;
  const bothResultsLogged = !!resultA && !!resultB;

  const STATUS_OPTIONS: AbTestStatus[] = ['planning', 'live', 'completed'];

  // Apply winner script to linked post's script
  const applyWinnerToScript = () => {
    if (!test.winner || !linkedScript) return;
    const winnerVariant = test.winner === 'A' ? test.variantA : test.variantB;
    const variable = test.variable;
    let patchContent = winnerVariant.content;
    if (variable === 'hook') {
      alert(`Copy this hook to your script:\n\n${patchContent}`);
    } else if (variable === 'cta') {
      alert(`Copy this CTA to your script:\n\n${patchContent}`);
    } else {
      alert(`Winner content:\n\n${patchContent}`);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold px-2 py-0.5 rounded border ${vm.bg} ${vm.color}`}>
              {vm.label} Test
            </span>
            {/* Status selector */}
            <select
              value={test.status}
              onChange={e => onUpdateTest({ status: e.target.value as AbTestStatus })}
              className="text-xs border border-slate-200 rounded-lg px-2 py-0.5 bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
            {test.winner && <WinnerBadge winner={test.winner} />}
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-1">{test.name}</h2>
          {test.hypothesis && (
            <p className="text-xs text-slate-500 italic mt-0.5">Hypothesis: {test.hypothesis}</p>
          )}
          {linkedPost && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <FileText className="w-3 h-3 text-slate-400" />
              <span className="text-xs text-slate-500">Linked to <span className="font-medium text-slate-700">{linkedPost.title}</span></span>
            </div>
          )}
        </div>
        <button
          onClick={onDeleteTest}
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Variant cards */}
      <div className="grid grid-cols-2 gap-4">
        {(['A', 'B'] as const).map(v => {
          const variant: AbVariant = v === 'A' ? test.variantA : test.variantB;
          const result = v === 'A' ? resultA : resultB;
          const isWinner = test.winner === v;
          const isEmpty = !variant.content.trim();
          return (
            <div
              key={v}
              className={`bg-white rounded-xl border-2 p-4 space-y-3 transition-all ${
                isWinner ? 'border-amber-400 shadow-md shadow-amber-50' : 'border-slate-200'
              }`}
            >
              {/* Card header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-black ${
                    v === 'A' ? 'bg-slate-900 text-white' : 'bg-emerald-600 text-white'
                  }`}>{v}</span>
                  <span className="text-sm font-semibold text-slate-800">
                    {variant.title || `Variant ${v}`}
                  </span>
                </div>
                {isWinner && <Trophy className="w-4 h-4 text-amber-500" />}
              </div>

              {/* Content */}
              {isEmpty && v === 'B' ? (
                <div className="text-center py-4 space-y-2">
                  <p className="text-xs text-slate-400">Variant B not set</p>
                  <button
                    onClick={onGenerateVariantB}
                    disabled={generatingVariantB || !test.variantA.content}
                    className="flex items-center gap-1.5 mx-auto text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {generatingVariantB ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    {generatingVariantB ? 'Generating...' : 'AI Generate Variant B'}
                  </button>
                </div>
              ) : (
                <p className={`text-sm leading-relaxed ${isEmpty ? 'text-slate-300 italic' : 'text-slate-700'}`}>
                  {isEmpty ? '(empty)' : variant.content}
                </p>
              )}

              {/* Result section */}
              {result ? (
                <div className="border-t border-slate-100 pt-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Posted {result.postedAt}</p>
                    <div className="flex gap-1">
                      <button onClick={() => onEditResult(result)} className="text-[10px] text-indigo-500 hover:text-indigo-700 font-medium">Edit</button>
                      <span className="text-[10px] text-slate-300">·</span>
                      <button onClick={() => onDeleteResult(result)} className="text-[10px] text-rose-500 hover:text-rose-700 font-medium">Remove</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-center">
                    {[
                      { icon: <Eye className="w-2.5 h-2.5" />, val: fmtNum(result.views), lbl: 'Views' },
                      { icon: <Heart className="w-2.5 h-2.5" />, val: fmtNum(result.likes), lbl: 'Likes' },
                      { icon: <MessageCircle className="w-2.5 h-2.5" />, val: fmtNum(result.comments), lbl: 'Cmts' },
                      { icon: <UserPlus className="w-2.5 h-2.5" />, val: fmtNum(result.follows), lbl: 'Follows' },
                    ].map(m => (
                      <div key={m.lbl} className="bg-slate-50 rounded-lg p-1.5">
                        <div className="flex justify-center text-slate-400 mb-0.5">{m.icon}</div>
                        <p className="text-xs font-bold text-slate-800">{m.val}</p>
                        <p className="text-[9px] text-slate-400">{m.lbl}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-1">
                    <div className="flex-1 bg-slate-50 rounded-lg p-1.5 text-center">
                      <p className="text-[10px] text-slate-400">Eng. Rate</p>
                      <p className="text-sm font-bold text-slate-900">{fmtPct(engRate(result))}</p>
                    </div>
                    <div className="flex-1 bg-slate-50 rounded-lg p-1.5 text-center">
                      <p className="text-[10px] text-slate-400">Follow Rate</p>
                      <p className="text-sm font-bold text-slate-900">{fmtPct(followRate(result))}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => onLogResult(v)}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold border border-dashed border-slate-300 text-slate-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg py-2 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Log results for {v}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Metrics comparison table */}
      {bothResultsLogged && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 p-4 border-b border-slate-100">
            <BarChart3 className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-bold text-slate-800">Metrics Comparison</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-2.5 pl-4 pr-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Metric</th>
                  <th className="py-2.5 px-4 text-center text-[11px] font-black text-slate-700 bg-slate-50 w-24">A</th>
                  <th className="py-2.5 px-4 text-center text-[11px] font-black text-emerald-700 bg-emerald-50 w-24">B</th>
                  <th className="py-2.5 pl-3 pr-4 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wide w-20">Delta</th>
                </tr>
              </thead>
              <tbody>
                {resultA && resultB && (() => {
                  const a = resultA, b = resultB;
                  return (
                    <>
                      <MetricRow label="Views" icon={<Eye className="w-3 h-3" />} valA={a.views} valB={b.views} fmtA={fmtNum(a.views)} fmtB={fmtNum(b.views)} />
                      <MetricRow label="Likes" icon={<Heart className="w-3 h-3" />} valA={a.likes} valB={b.likes} fmtA={fmtNum(a.likes)} fmtB={fmtNum(b.likes)} />
                      <MetricRow label="Comments" icon={<MessageCircle className="w-3 h-3" />} valA={a.comments} valB={b.comments} fmtA={fmtNum(a.comments)} fmtB={fmtNum(b.comments)} />
                      <MetricRow label="Shares" icon={<Share2 className="w-3 h-3" />} valA={a.shares} valB={b.shares} fmtA={fmtNum(a.shares)} fmtB={fmtNum(b.shares)} />
                      <MetricRow label="Saves" icon={<Bookmark className="w-3 h-3" />} valA={a.saves} valB={b.saves} fmtA={fmtNum(a.saves)} fmtB={fmtNum(b.saves)} />
                      <MetricRow label="Profile Visits" icon={<UserPlus className="w-3 h-3" />} valA={a.profileVisits} valB={b.profileVisits} fmtA={fmtNum(a.profileVisits)} fmtB={fmtNum(b.profileVisits)} />
                      <MetricRow label="Watch Time" icon={<Clock className="w-3 h-3" />} valA={a.watchTimeSeconds} valB={b.watchTimeSeconds} fmtA={fmtTime(a.watchTimeSeconds)} fmtB={fmtTime(b.watchTimeSeconds)} />
                      <MetricRow label="Follows" icon={<TrendingUp className="w-3 h-3" />} valA={a.follows} valB={b.follows} fmtA={fmtNum(a.follows)} fmtB={fmtNum(b.follows)} />
                      <MetricRow label="Eng. Rate %" icon={<BarChart3 className="w-3 h-3" />} valA={engRate(a)} valB={engRate(b)} fmtA={fmtPct(engRate(a))} fmtB={fmtPct(engRate(b))} />
                      <MetricRow label="Follow Rate %" icon={<UserPlus className="w-3 h-3" />} valA={followRate(a)} valB={followRate(b)} fmtA={fmtPct(followRate(a))} fmtB={fmtPct(followRate(b))} />
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Winner section */}
      {test.winner ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-bold text-amber-900">Variant {test.winner} wins</h3>
            {linkedScript && (
              <button
                onClick={applyWinnerToScript}
                className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-2.5 py-1 rounded-lg transition-colors"
              >
                <ArrowRight className="w-3 h-3" /> Apply to Script
              </button>
            )}
          </div>
          {test.winnerReason && (
            <p className="text-xs text-amber-800 leading-relaxed whitespace-pre-line">{test.winnerReason}</p>
          )}
        </div>
      ) : bothResultsLogged ? (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Ready for AI Verdict</h3>
              <p className="text-xs text-slate-500 mt-0.5">Both variants have results. Let AI analyze the winner with psychological reasoning.</p>
              {verdictError && <p className="text-xs text-rose-500 mt-1">{verdictError}</p>}
            </div>
            <button
              onClick={onDeclareWinner}
              disabled={generatingVerdict}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-50 shrink-0"
            >
              {generatingVerdict ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generatingVerdict ? 'Analyzing...' : 'AI Declare Winner'}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-5 text-center">
          <p className="text-xs text-slate-400">Log results for both Variant A and B to enable the AI winner analysis.</p>
        </div>
      )}
    </div>
  );
}

// ── NewTestWizard ──────────────────────────────────────────────────────────

function NewTestWizard({
  posts, scripts, onSave, onClose,
}: {
  posts: Post[];
  scripts: Script[];
  onSave: (t: Omit<AbTest, 'id' | 'createdAt'>) => Promise<void>;
  onClose: () => void;
}) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [variable, setVariable] = useState<AbTestVariable>('hook');
  const [postId, setPostId] = useState<string | null>(null);
  const [variantATitle, setVariantATitle] = useState('');
  const [variantAContent, setVariantAContent] = useState('');
  const [variantBTitle, setVariantBTitle] = useState('');
  const [variantBContent, setVariantBContent] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedPost = posts.find(p => p.id === postId) ?? null;
  const linkedScript = selectedPost ? scripts.find(s => s.postId === selectedPost.id) ?? null : null;

  const importFromScript = () => {
    if (!linkedScript) return;
    const val = variable === 'hook' ? linkedScript.hook : variable === 'cta' ? linkedScript.cta : linkedScript.body;
    setVariantAContent(val);
    if (!variantATitle) setVariantATitle(variable === 'hook' ? 'Original Hook' : variable === 'cta' ? 'Original CTA' : 'Original Script');
  };

  const handleSave = async () => {
    if (!name || !variantAContent || !variantBContent) return;
    setSaving(true);
    await onSave({
      name,
      hypothesis,
      variable,
      variantA: { title: variantATitle || 'Variant A', content: variantAContent },
      variantB: { title: variantBTitle || 'Variant B', content: variantBContent },
      postId,
      status: 'planning',
      winner: null,
      winnerReason: null,
    });
    setSaving(false);
  };

  const canNext1 = name.trim().length > 0;
  const canNext2 = variantAContent.trim().length > 0;
  const canSave = variantAContent.trim().length > 0 && variantBContent.trim().length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">New A/B Test</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {[1, 2, 3].map(n => (
                <span key={n} className={`w-2 h-2 rounded-full transition-colors ${step >= n ? 'bg-emerald-500' : 'bg-slate-200'}`} />
              ))}
            </div>
            <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {step === 1 && (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Test name *</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Hook Test — Tutorial format"
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Hypothesis</label>
                <input
                  value={hypothesis}
                  onChange={e => setHypothesis(e.target.value)}
                  placeholder="e.g. Pain-first hook will outperform curiosity gap"
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-2">What are you testing? *</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(Object.entries(VARIABLE_META) as [AbTestVariable, typeof VARIABLE_META[AbTestVariable]][]).map(([v, meta]) => (
                    <button
                      key={v}
                      onClick={() => setVariable(v)}
                      className={`flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all ${
                        variable === v ? `${meta.bg} border-current ${meta.color}` : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-xs font-bold">{meta.label}</span>
                      <span className="text-[10px] mt-0.5 opacity-70">{meta.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Link to a post (optional)</label>
                <select
                  value={postId ?? ''}
                  onChange={e => setPostId(e.target.value || null)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                >
                  <option value="">— No linked post —</option>
                  {posts.map(p => (
                    <option key={p.id} value={p.id}>{p.title} ({p.theme})</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-700">Variant A</p>
                {linkedScript && (
                  <button onClick={importFromScript} className="text-[11px] text-indigo-500 hover:text-indigo-700 font-semibold">
                    Import from script →
                  </button>
                )}
              </div>
              <input
                value={variantATitle}
                onChange={e => setVariantATitle(e.target.value)}
                placeholder="Label, e.g. Pain-first hook"
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <textarea
                value={variantAContent}
                onChange={e => setVariantAContent(e.target.value)}
                placeholder={`Write your ${VARIABLE_META[variable].label.toLowerCase()} here…`}
                rows={5}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400"
                autoFocus
              />
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-xs font-semibold text-slate-700">Variant B</p>
              <input
                value={variantBTitle}
                onChange={e => setVariantBTitle(e.target.value)}
                placeholder="Label, e.g. Curiosity gap hook"
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <textarea
                value={variantBContent}
                onChange={e => setVariantBContent(e.target.value)}
                placeholder={`Write your alternative ${VARIABLE_META[variable].label.toLowerCase()} here…`}
                rows={5}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400"
                autoFocus
              />
              <p className="text-[11px] text-slate-400">Leave Variant B empty to fill it in later or use AI generation after creating the test.</p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-slate-100 shrink-0">
          <button
            onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
            className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
          >
            {step > 1 ? '← Back' : 'Cancel'}
          </button>
          {step < 3 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={step === 1 ? !canNext1 : !canNext2}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-40"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving || !canSave}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-40"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? 'Creating...' : 'Create Test'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── LogResultsModal ────────────────────────────────────────────────────────

function LogResultsModal({
  testId, variant, existingResult, onSave, onClose,
}: {
  testId: string;
  variant: 'A' | 'B';
  existingResult: AbTestResult | null;
  onSave: (r: Omit<AbTestResult, 'id'>) => Promise<void>;
  onClose: () => void;
}) {
  // suppress unused warning — testId passed for context
  void testId;
  const today = new Date().toISOString().split('T')[0];
  const [postedAt, setPostedAt] = useState(existingResult?.postedAt ?? today);
  const [views, setViews] = useState(existingResult?.views ?? 0);
  const [likes, setLikes] = useState(existingResult?.likes ?? 0);
  const [comments, setComments] = useState(existingResult?.comments ?? 0);
  const [shares, setShares] = useState(existingResult?.shares ?? 0);
  const [saves, setSaves] = useState(existingResult?.saves ?? 0);
  const [profileVisits, setProfileVisits] = useState(existingResult?.profileVisits ?? 0);
  const [watchTimeSeconds, setWatchTimeSeconds] = useState(existingResult?.watchTimeSeconds ?? 0);
  const [follows, setFollows] = useState(existingResult?.follows ?? 0);
  const [notes, setNotes] = useState(existingResult?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const numInput = (val: number, setter: (n: number) => void, label: string, icon: React.ReactNode) => (
    <div>
      <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 mb-1">
        {icon}{label}
      </label>
      <input
        type="number"
        min={0}
        value={val}
        onChange={e => setter(Math.max(0, parseInt(e.target.value) || 0))}
        className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
      />
    </div>
  );

  const handleSave = async () => {
    setSaving(true);
    await onSave({ testId: '', variant, postedAt, views, likes, comments, shares, saves, profileVisits, watchTimeSeconds, follows, notes });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-black ${variant === 'A' ? 'bg-slate-900 text-white' : 'bg-emerald-600 text-white'}`}>
              {variant}
            </span>
            <h2 className="text-sm font-bold text-slate-900">Log results — Variant {variant}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-1">Date posted</label>
            <input type="date" value={postedAt} onChange={e => setPostedAt(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {numInput(views, setViews, 'Views / Reach', <Eye className="w-3 h-3" />)}
            {numInput(likes, setLikes, 'Likes', <Heart className="w-3 h-3" />)}
            {numInput(comments, setComments, 'Comments', <MessageCircle className="w-3 h-3" />)}
            {numInput(shares, setShares, 'Shares', <Share2 className="w-3 h-3" />)}
            {numInput(saves, setSaves, 'Saves', <Bookmark className="w-3 h-3" />)}
            {numInput(profileVisits, setProfileVisits, 'Profile Visits', <UserPlus className="w-3 h-3" />)}
            {numInput(watchTimeSeconds, setWatchTimeSeconds, 'Watch Time (s)', <Clock className="w-3 h-3" />)}
            {numInput(follows, setFollows, 'New Follows', <TrendingUp className="w-3 h-3" />)}
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Anything notable about this post's performance..."
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          {/* Live preview */}
          <div className="bg-slate-50 rounded-xl p-3 grid grid-cols-2 gap-2">
            <div className="text-center">
              <p className="text-[10px] text-slate-400">Eng. Rate</p>
              <p className="text-base font-black text-slate-900">
                {views > 0 ? fmtPct((likes + comments + shares + saves) / views * 100) : '—'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-400">Follow Rate</p>
              <p className="text-base font-black text-slate-900">
                {views > 0 ? fmtPct(follows / views * 100) : '—'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-5 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? 'Saving...' : existingResult ? 'Update Results' : 'Log Results'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AI prompt builders ─────────────────────────────────────────────────────

function buildVariantBPrompt(test: AbTest, identity: BrandIdentity): string {
  const vm = VARIABLE_META[test.variable];
  return `You are a strategic short-form content expert. Generate an alternative Variant B for an A/B test.

TEST NAME: "${test.name}"
TESTING: ${vm.label}
HYPOTHESIS: ${test.hypothesis || 'Not specified'}

VARIANT A:
Title: ${test.variantA.title || 'Variant A'}
Content: ${test.variantA.content}

BRAND CONTEXT:
ICP: ${identity.icp || 'Not defined'}
Audience Pains: ${identity.empathyMap.pains || 'Not defined'}
Voice & Tone: ${identity.tone || 'Not defined'}

Create a STRATEGICALLY DIFFERENT Variant B. It must use a different psychological angle, not just rephrase Variant A.

Return ONLY this JSON (no markdown):
{
  "title": "Short name for the angle strategy (3-5 words)",
  "content": "The actual ${vm.label.toLowerCase()} content — specific, punchy, different from A",
  "strategy": "One sentence explaining how the psychological angle differs from Variant A"
}`;
}

function buildVerdictPrompt(test: AbTest, resultA: AbTestResult, resultB: AbTestResult, identity: BrandIdentity): string {
  const erA = engRate(resultA).toFixed(2);
  const erB = engRate(resultB).toFixed(2);
  const frA = followRate(resultA).toFixed(2);
  const frB = followRate(resultB).toFixed(2);
  return `You are an expert content performance analyst. Declare the winner of this A/B test and explain the psychological reason.

TEST: "${test.name}"
VARIABLE TESTED: ${VARIABLE_META[test.variable].label}

VARIANT A — "${test.variantA.title}"
Content: ${test.variantA.content}
Metrics: Views=${resultA.views}, Likes=${resultA.likes}, Comments=${resultA.comments}, Shares=${resultA.shares}, Saves=${resultA.saves}, Profile Visits=${resultA.profileVisits}, Watch Time=${resultA.watchTimeSeconds}s, Follows=${resultA.follows}
Engagement Rate: ${erA}% | Follow Rate: ${frA}%

VARIANT B — "${test.variantB.title}"
Content: ${test.variantB.content}
Metrics: Views=${resultB.views}, Likes=${resultB.likes}, Comments=${resultB.comments}, Shares=${resultB.shares}, Saves=${resultB.saves}, Profile Visits=${resultB.profileVisits}, Watch Time=${resultB.watchTimeSeconds}s, Follows=${resultB.follows}
Engagement Rate: ${erB}% | Follow Rate: ${frB}%

BRAND ICP: ${identity.icp || 'Not defined'}
AUDIENCE PAINS: ${identity.empathyMap.pains || 'Not defined'}
VOICE & TONE: ${identity.tone || 'Not defined'}

Analyze holistically (engagement rate, follow rate, saves, watch time — not just raw views).

Return ONLY this JSON (no markdown):
{
  "winner": "A",
  "reason": "2-3 sentence psychological explanation of why this variant resonated more with the audience",
  "keyInsight": "The single most important strategic insight from this test result",
  "recommendation": "What the creator should do next based on this finding"
}`;
}
