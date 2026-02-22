import { CheckCircle2, Circle, Rocket, Loader2, AlertCircle, FlaskConical, Quote } from 'lucide-react';
import type { BrandIdentity as BrandIdentityType, AppLanguage } from '../types';
import OpenAI from 'openai';
import { useState } from 'react';
import * as analytics from '../lib/analytics';

const LANGUAGE_NAMES: Record<AppLanguage, string> = { en: 'English', es: 'Spanish', fr: 'French' };

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  answer?: string;
  results: TavilyResult[];
}

async function tavilySearch(query: string, apiKey: string): Promise<TavilyResponse> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'advanced',
      include_answer: true,
      include_raw_content: false,
      max_results: 5,
    }),
  });
  if (!res.ok) throw new Error(`Tavily error: ${res.status}`);
  return res.json() as Promise<TavilyResponse>;
}

interface Props {
  identity: BrandIdentityType;
  onChange: (identity: BrandIdentityType) => void;
  onAddTheme: (theme: string, source?: 'manual' | 'ai') => void;
  onAddContentType: (type: string, source?: 'manual' | 'ai') => void;
  language: AppLanguage;
}

export default function BrandIdentity({ identity, onChange, onAddTheme, onAddContentType, language }: Props) {
  const [loading, setLoading] = useState(false);
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchStep, setResearchStep] = useState('');
  const [error, setError] = useState('');

  const update = (field: keyof BrandIdentityType, value: string) => {
    onChange({ ...identity, [field]: value });
  };

  const updateEmpathy = (field: keyof BrandIdentityType['empathyMap'], value: string) => {
    onChange({
      ...identity,
      empathyMap: { ...identity.empathyMap, [field]: value },
    });
  };

  const handleLaunch = async () => {
    const orKey = import.meta.env.VITE_OPENROUTER_API_KEY as string;
    if (!orKey) { setError('OpenRouter API key is not configured.'); return; }
    if (!identity.icp.trim()) { setError('Please define your ICP first.'); return; }

    setLoading(true);
    setError('');
    analytics.trackLaunchStrategyStarted();

    try {
      const openai = new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: orKey, dangerouslyAllowBrowser: true });
      const prompt = `Based on this Brand Identity:
ICP: ${identity.icp}
Positioning: ${identity.positioning}
Tone: ${identity.tone}

Suggest 5 Content Themes and 5 Content Types that would perfectly resonate with this ICP.
Return a JSON object with "themes" (array of strings) and "types" (array of strings).
LANGUAGE: Write all output in ${LANGUAGE_NAMES[language]}.`;

      const response = await openai.chat.completions.create({
        model: 'arcee-ai/trinity-large-preview:free',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });

      const raw = response.choices[0].message.content ?? '{}';
      const parsed: { themes: string[], types: string[] } = JSON.parse(raw);

      if (parsed.themes) parsed.themes.forEach(t => onAddTheme(t, 'ai'));
      if (parsed.types) parsed.types.forEach(t => onAddContentType(t, 'ai'));

      analytics.trackLaunchStrategyCompleted(parsed.themes?.length ?? 0, parsed.types?.length ?? 0);
      alert('Strategy Launched! Themes and Content Types have been added to your Strategy Matrix.');
    } catch (e) {
      console.error(e);
      setError('Failed to launch strategy. Check your API key.');
      analytics.trackLaunchStrategyFailed(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleDeepResearch = async () => {
    const orKey = import.meta.env.VITE_OPENROUTER_API_KEY as string;
    const tavilyKey = import.meta.env.VITE_TAVILY_API_KEY as string;
    if (!orKey) { setError('OpenRouter API key is not configured.'); return; }
    if (!tavilyKey) { setError('Tavily API key is not configured.'); return; }
    if (!identity.icp.trim()) { setError('Please define your ICP first before running deep research.'); return; }

    setResearchLoading(true);
    setResearchStep('');
    setError('');
    analytics.trackDeepResearchStarted();

    try {
      // Step 1 — build targeted search queries from the ICP
      setResearchStep('Building search queries from your ICP...');
      const icp = identity.icp.trim();
      const positioning = identity.positioning.trim();

      const queries = [
        `${icp} biggest frustrations complaints Reddit forum`,
        `${icp} struggles pain points what they hate`,
        `${icp} dreams goals aspirations success stories`,
        `${icp} fears anxieties what they worry about`,
        positioning
          ? `${icp} "${positioning.split(' ').slice(0, 4).join(' ')}" community discussions`
          : `${icp} community discussions online`,
      ];

      // Step 2 — run all Tavily searches in parallel
      setResearchStep('Searching the web for real audience conversations...');
      const searchResults = await Promise.allSettled(
        queries.map(q => tavilySearch(q, tavilyKey))
      );

      // Step 3 — collect all snippets
      const snippets: string[] = [];
      for (const result of searchResults) {
        if (result.status === 'fulfilled') {
          if (result.value.answer) snippets.push(`[Search Answer] ${result.value.answer}`);
          for (const r of result.value.results) {
            if (r.content) snippets.push(`[${r.url}] ${r.content.slice(0, 400)}`);
          }
        }
      }

      if (snippets.length === 0) {
        setError('No search results found. Try refining your ICP description.');
        return;
      }

      // Step 4 — synthesize with AI
      setResearchStep('Synthesizing insights and extracting verbatim quotes...');
      const openai = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: orKey,
        dangerouslyAllowBrowser: true,
      });

      const synthesisPrompt = `You are a world-class audience research analyst. Below is real web data scraped from forums, Reddit, communities and discussions about this audience:

ICP: ${icp}
${positioning ? `Brand Positioning: ${positioning}` : ''}

=== RAW RESEARCH DATA ===
${snippets.slice(0, 30).join('\n\n---\n\n')}
=== END OF RESEARCH DATA ===

Based exclusively on the real data above, return a JSON object with these keys:

"pains": A rich, specific paragraph (150-200 words) describing their deepest daily frustrations — grounded in what you found in the research. Name specific tools, situations, and moments. Use language that mirrors what real people said.

"gains": A rich paragraph (150-200 words) describing the concrete outcomes, wins, and results they want — drawn from real aspirations you found.

"fears": A rich paragraph (150-200 words) revealing their psychological fears — rejection, irrelevance, failure, being left behind. Grounded in what the research revealed.

"hopes": A rich paragraph (150-200 words) describing their secret dreams — specific scenarios and feelings they're chasing. Drawn from real community discussions.

"verbatims": An array of exactly 8 strings. Each is a real or highly representative quote extracted or closely paraphrased from the research data above — the kind of thing this audience actually says on Reddit, forums, Twitter/X, or in comments. Use first-person voice. Make them feel emotionally raw and authentic. Include the source context in brackets at the end of each quote (e.g. [Reddit r/entrepreneur] or [Forum discussion]).

LANGUAGE: Write all output in ${LANGUAGE_NAMES[language]}.
CRITICAL: Return only valid JSON. No markdown code fences. No extra keys.`;

      const response = await openai.chat.completions.create({
        model: 'arcee-ai/trinity-large-preview:free',
        messages: [
          {
            role: 'system',
            content: 'You are a world-class audience research analyst. You synthesize real web research into actionable psychological insights. Return only valid JSON.',
          },
          { role: 'user', content: synthesisPrompt },
        ],
        response_format: { type: 'json_object' },
      });

      const raw = response.choices[0].message.content ?? '{}';
      const parsed: {
        pains: string;
        gains: string;
        fears: string;
        hopes: string;
        verbatims: string[];
      } = JSON.parse(raw);

      const verbatims = Array.isArray(parsed.verbatims) ? parsed.verbatims : identity.verbatims ?? [];
      onChange({
        ...identity,
        empathyMap: {
          pains: parsed.pains ?? identity.empathyMap.pains,
          gains: parsed.gains ?? identity.empathyMap.gains,
          fears: parsed.fears ?? identity.empathyMap.fears,
          hopes: parsed.hopes ?? identity.empathyMap.hopes,
        },
        verbatims,
      });
      analytics.trackDeepResearchCompleted(verbatims.length);

      setResearchStep('');
    } catch (e) {
      console.error(e);
      setError('Deep research failed. Check your API keys and try again.');
      setResearchStep('');
      analytics.trackDeepResearchFailed(String(e));
    } finally {
      setResearchLoading(false);
    }
  };

  const empathyFields: { label: string; key: keyof BrandIdentityType['empathyMap']; desc: string; color: string }[] = [
    { label: 'Pains', key: 'pains', desc: 'What frustrates your audience daily?', color: 'rose' },
    { label: 'Gains', key: 'gains', desc: 'What outcomes do they desire?', color: 'emerald' },
    { label: 'Fears', key: 'fears', desc: 'What keeps them up at night?', color: 'amber' },
    { label: 'Hopes', key: 'hopes', desc: 'What do they secretly dream about?', color: 'indigo' },
  ];

  const allValues = [
    identity.icp,
    identity.positioning,
    identity.tone,
    identity.empathyMap.pains,
    identity.empathyMap.gains,
    identity.empathyMap.fears,
    identity.empathyMap.hopes,
  ];
  const filled = allValues.filter(v => v.trim().length > 0).length;
  const pct = Math.round((filled / allValues.length) * 100);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Brand Identity</h1>
          <p className="text-slate-500 text-sm mt-1">The strategic foundation for all AI-generated content.</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end mb-1">
              {pct === 100
                ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                : <Circle className="w-4 h-4 text-slate-300" />
              }
              <span className={`text-sm font-semibold ${pct === 100 ? 'text-emerald-600' : 'text-slate-500'}`}>
                {pct === 100 ? 'Identity Ready' : `${pct}% complete`}
              </span>
            </div>
            <div className="w-32 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: pct === 100 ? '#059669' : '#4f46e5' }}
              />
            </div>
          </div>
          <button
            onClick={handleLaunch}
            disabled={loading || !identity.icp.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm shadow-indigo-100"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
            {loading ? 'Launching System...' : 'Launch Strategy System'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-rose-700">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {/* Core fields */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Core Definition</h2>
        <FormField
          label="Ideal Customer Profile (ICP)"
          placeholder="e.g. Early-stage founders aged 25-35, building SaaS products, frustrated by marketing..."
          value={identity.icp}
          onChange={v => update('icp', v)}
          rows={3}
        />
        <FormField
          label="Brand Positioning"
          placeholder="e.g. The no-fluff content system for operators who'd rather ship than talk..."
          value={identity.positioning}
          onChange={v => update('positioning', v)}
          rows={2}
        />
        <FormField
          label="Voice & Tone"
          placeholder="e.g. Direct, data-driven, slightly provocative. Never preachy. Always actionable..."
          value={identity.tone}
          onChange={v => update('tone', v)}
          rows={2}
        />
      </section>

      {/* Empathy Map */}
      <section className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Empathy Map</h2>
            <p className="text-xs text-slate-400 mt-1">This 4-quadrant data is injected directly into every AI generation.</p>
          </div>
          <button
            onClick={handleDeepResearch}
            disabled={researchLoading || !identity.icp.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-all shadow-sm shadow-violet-100 shrink-0 ml-4"
          >
            {researchLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <FlaskConical className="w-4 h-4" />
            }
            {researchLoading ? 'Researching...' : 'Deep Research'}
          </button>
        </div>

        {researchLoading && researchStep && (
          <div className="mb-4 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 text-sm text-violet-700 flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            {researchStep}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {empathyFields.map(({ label, key, desc, color }) => (
            <EmpathyQuadrant
              key={key}
              label={label}
              desc={desc}
              color={color}
              value={identity.empathyMap[key]}
              onChange={v => updateEmpathy(key, v)}
            />
          ))}
        </div>
      </section>

      {/* Verbatim Quotes */}
      {identity.verbatims && identity.verbatims.length > 0 && (
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-1">
            <Quote className="w-4 h-4 text-violet-500" />
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Audience Verbatims</h2>
          </div>
          <p className="text-xs text-slate-400 mb-5">Real-language quotes surfaced from web research — use these in hooks, captions, and scripts.</p>
          <div className="space-y-3">
            {identity.verbatims.map((quote, i) => {
              const bracketMatch = quote.match(/\[([^\]]+)\]$/);
              const source = bracketMatch ? bracketMatch[1] : null;
              const text = source ? quote.slice(0, quote.lastIndexOf('[')).trim() : quote;
              return (
                <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  <p className="text-sm text-slate-800 leading-relaxed italic">"{text}"</p>
                  {source && (
                    <p className="text-xs text-violet-500 mt-1.5 font-medium">{source}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Completion checklist */}
      <section className="bg-slate-50 rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Completion Checklist</h2>
        <ul className="space-y-2">
          {[
            { label: 'ICP defined', done: identity.icp.trim().length > 0 },
            { label: 'Positioning articulated', done: identity.positioning.trim().length > 0 },
            { label: 'Voice & Tone set', done: identity.tone.trim().length > 0 },
            { label: 'Pains mapped', done: identity.empathyMap.pains.trim().length > 0 },
            { label: 'Gains mapped', done: identity.empathyMap.gains.trim().length > 0 },
            { label: 'Fears mapped', done: identity.empathyMap.fears.trim().length > 0 },
            { label: 'Hopes mapped', done: identity.empathyMap.hopes.trim().length > 0 },
            { label: 'Verbatims captured', done: (identity.verbatims?.length ?? 0) > 0 },
          ].map(({ label, done }) => (
            <li key={label} className="flex items-center gap-2 text-sm">
              {done
                ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                : <Circle className="w-4 h-4 text-slate-300 shrink-0" />
              }
              <span className={done ? 'text-slate-700' : 'text-slate-400'}>{label}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function FormField({
  label, placeholder, value, onChange, rows = 3,
}: {
  label: string; placeholder: string; value: string;
  onChange: (v: string) => void; rows?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <textarea
        rows={rows}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
      />
    </div>
  );
}

function EmpathyQuadrant({
  label, desc, color, value, onChange,
}: {
  label: string; desc: string; color: string; value: string; onChange: (v: string) => void;
}) {
  const colorMap: Record<string, { bg: string; border: string; badge: string; text: string }> = {
    rose: { bg: 'bg-rose-50', border: 'border-rose-200', badge: 'bg-rose-100 text-rose-700', text: 'text-rose-600' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', text: 'text-emerald-600' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700', text: 'text-amber-600' },
    indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', badge: 'bg-indigo-100 text-indigo-700', text: 'text-indigo-600' },
  };
  const c = colorMap[color];
  return (
    <div className={`rounded-lg border p-4 ${c.bg} ${c.border}`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${c.badge}`}>{label}</span>
      </div>
      <p className={`text-xs mb-2 ${c.text}`}>{desc}</p>
      <textarea
        rows={4}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={`Describe your audience's ${label.toLowerCase()}...`}
        className="w-full px-3 py-2 rounded-lg border border-white bg-white text-sm text-slate-900 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
      />
    </div>
  );
}
