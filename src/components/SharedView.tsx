import { useState, useEffect } from 'react';
import { FlaskConical, Loader2, CalendarDays, Grid3X3, TrendingUp, CheckCircle2, Circle } from 'lucide-react';
import * as db from '../lib/db';
import * as analytics from '../lib/analytics';
import type { Post, MatrixIdea, RoiCampaign, RoiEntry } from '../types';

type SharedTab = 'calendar' | 'matrix' | 'roi';

// ── ROI helpers (mirrors RoiTracker logic) ───────────────────────────────────
function getSignal(campaign: RoiCampaign, entries: RoiEntry[]): 'good' | 'marginal' | 'bad' | 'none' {
  const relevant = entries.filter(e => e.campaignId === campaign.id && e.followersGained > 0);
  if (!relevant.length) return 'none';
  const recent = relevant.slice(-3);
  const totalSpend = recent.reduce((s, e) => s + e.spend, 0);
  const totalFollowers = recent.reduce((s, e) => s + e.followersGained, 0);
  const cpf = totalSpend / totalFollowers;
  if (cpf <= campaign.targetCostPerFollower) return 'good';
  if (cpf <= campaign.targetCostPerFollower * 1.5) return 'marginal';
  return 'bad';
}

const SIGNAL_STYLES = {
  good: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', dot: 'bg-emerald-500', label: 'ROI is Good — consider scaling budget' },
  marginal: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', dot: 'bg-amber-400', label: 'ROI is Marginal — monitor closely' },
  bad: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-800', dot: 'bg-rose-500', label: 'ROI is Negative — pause or try new creative' },
  none: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', dot: 'bg-slate-300', label: 'No data yet' },
};

const STATUS_STYLES: Record<Post['status'], string> = {
  IDEA: 'bg-slate-100 text-slate-600',
  DRAFT: 'bg-indigo-100 text-indigo-700',
  SCHEDULED: 'bg-emerald-100 text-emerald-700',
};

// ── Calendar Tab ─────────────────────────────────────────────────────────────
function CalendarTab({ posts }: { posts: Post[] }) {
  if (!posts.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-2">
        <CalendarDays className="w-10 h-10 opacity-30" />
        <p className="text-sm">No posts yet</p>
      </div>
    );
  }

  // Group by YYYY-MM
  const grouped = posts.reduce<Record<string, Post[]>>((acc, post) => {
    const key = post.date.slice(0, 7);
    if (!acc[key]) acc[key] = [];
    acc[key].push(post);
    return acc;
  }, {});

  const sortedMonths = Object.keys(grouped).sort();

  return (
    <div className="space-y-6">
      {sortedMonths.map(month => {
        const [y, m] = month.split('-');
        const label = new Date(Number(y), Number(m) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
        return (
          <div key={month}>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">{label}</h3>
            <div className="space-y-2">
              {grouped[month].map(post => (
                <div key={post.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3">
                  <div className="text-sm font-bold text-slate-400 w-6 shrink-0 text-center">
                    {new Date(post.date).getUTCDate()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{post.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{post.theme} · {post.type}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLES[post.status]}`}>
                    {post.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Matrix Tab ───────────────────────────────────────────────────────────────
function MatrixTab({ ideas }: { ideas: MatrixIdea[] }) {
  if (!ideas.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-2">
        <Grid3X3 className="w-10 h-10 opacity-30" />
        <p className="text-sm">No ideas yet</p>
      </div>
    );
  }

  const themes = [...new Set(ideas.map(i => i.theme))];
  const types = [...new Set(ideas.map(i => i.type))];
  const byCell = new Map<string, MatrixIdea[]>();
  ideas.forEach(i => {
    const key = `${i.theme}__${i.type}`;
    if (!byCell.has(key)) byCell.set(key, []);
    byCell.get(key)!.push(i);
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider pb-3 pr-4 w-28">Theme</th>
            {types.map(type => (
              <th key={type} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider pb-3 px-2">
                {type}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {themes.map(theme => (
            <tr key={theme} className="border-t border-slate-100">
              <td className="py-3 pr-4 align-top">
                <span className="text-sm font-semibold text-slate-700">{theme}</span>
              </td>
              {types.map(type => {
                const cell = byCell.get(`${theme}__${type}`) ?? [];
                return (
                  <td key={type} className="py-3 px-2 align-top">
                    {cell.length > 0 ? (
                      <div className="space-y-1.5">
                        {cell.map(idea => (
                          <div key={idea.id} className="flex items-start gap-1.5">
                            {idea.done
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                              : <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0 mt-0.5" />
                            }
                            <span className={`text-xs leading-relaxed ${idea.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                              {idea.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── ROI Tab ──────────────────────────────────────────────────────────────────
function RoiTab({ campaigns, entries }: { campaigns: RoiCampaign[]; entries: RoiEntry[] }) {
  if (!campaigns.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-2">
        <TrendingUp className="w-10 h-10 opacity-30" />
        <p className="text-sm">No campaigns yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {campaigns.map(campaign => {
        const campEntries = entries.filter(e => e.campaignId === campaign.id);
        const totalSpend = campEntries.reduce((s, e) => s + e.spend, 0);
        const totalFollowers = campEntries.reduce((s, e) => s + e.followersGained, 0);
        const avgCpf = totalFollowers > 0 ? totalSpend / totalFollowers : null;
        const signal = getSignal(campaign, entries);
        const { bg, border, text, dot, label } = SIGNAL_STYLES[signal];
        const recentEntries = [...campEntries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);

        return (
          <div key={campaign.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{campaign.postTitle}</p>
                <p className="text-xs text-slate-400 mt-0.5 capitalize">{campaign.platform} · {campaign.status}</p>
              </div>
              <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                campaign.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                campaign.status === 'paused' ? 'bg-amber-100 text-amber-700' :
                'bg-slate-100 text-slate-500'
              }`}>{campaign.status}</span>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
              <div className="px-4 py-3 text-center">
                <p className="text-xs text-slate-400 mb-1">Total Spend</p>
                <p className="text-base font-bold text-slate-900">€{totalSpend.toFixed(2)}</p>
              </div>
              <div className="px-4 py-3 text-center">
                <p className="text-xs text-slate-400 mb-1">Followers</p>
                <p className="text-base font-bold text-slate-900">+{totalFollowers}</p>
              </div>
              <div className="px-4 py-3 text-center">
                <p className="text-xs text-slate-400 mb-1">Cost/Follower</p>
                <p className="text-base font-bold text-slate-900">
                  {avgCpf !== null ? `€${avgCpf.toFixed(2)}` : '—'}
                </p>
              </div>
            </div>

            {/* Signal */}
            <div className={`mx-4 my-3 flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg border ${bg} ${border} ${text}`}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
              {label}
            </div>

            {/* Entry log */}
            {recentEntries.length > 0 && (
              <div className="px-4 pb-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Entry Log</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400">
                        <th className="text-left pb-1.5 font-medium">Date</th>
                        <th className="text-right pb-1.5 font-medium">Spend</th>
                        <th className="text-right pb-1.5 font-medium">Followers</th>
                        <th className="text-right pb-1.5 font-medium">Cost/F</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {recentEntries.map(e => (
                        <tr key={e.id}>
                          <td className="py-1.5 text-slate-600">{e.date}</td>
                          <td className="py-1.5 text-right text-slate-600">€{e.spend.toFixed(2)}</td>
                          <td className="py-1.5 text-right text-slate-600">+{e.followersGained}</td>
                          <td className="py-1.5 text-right text-slate-500">
                            {e.followersGained > 0 ? `€${(e.spend / e.followersGained).toFixed(2)}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function SharedView({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [activeTab, setActiveTab] = useState<SharedTab>('calendar');
  const [posts, setPosts] = useState<Post[]>([]);
  const [ideas, setIdeas] = useState<MatrixIdea[]>([]);
  const [campaigns, setCampaigns] = useState<RoiCampaign[]>([]);
  const [entries, setEntries] = useState<RoiEntry[]>([]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      db.fetchSharedPosts(token),
      db.fetchSharedMatrix(token),
      db.fetchSharedRoi(token),
    ]).then(([postsData, ideasData, roiData]) => {
      if (!postsData.length && !ideasData.length && !roiData.campaigns.length) {
        setInvalid(true);
      }
      setPosts(postsData);
      setIdeas(ideasData);
      setCampaigns(roiData.campaigns);
      setEntries(roiData.entries);
    }).finally(() => setLoading(false));
    analytics.trackSharedViewOpened(token);
  }, [token]);

  const TABS: { id: SharedTab; label: string; icon: React.ReactNode }[] = [
    { id: 'calendar', label: 'Calendar', icon: <CalendarDays className="w-4 h-4" /> },
    { id: 'matrix', label: 'Strategy Matrix', icon: <Grid3X3 className="w-4 h-4" /> },
    { id: 'roi', label: 'ROI', icon: <TrendingUp className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm shadow-indigo-200">
              <FlaskConical className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-sm">Content Pilot</span>
          </div>
          <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
            Read-only shared view
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
          </div>
        ) : invalid ? (
          <div className="flex flex-col items-center justify-center py-32 text-center space-y-3">
            <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center">
              <FlaskConical className="w-6 h-6 text-rose-400" />
            </div>
            <p className="text-slate-700 font-semibold">Link invalid or revoked</p>
            <p className="text-slate-400 text-sm">This share link no longer exists.</p>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 mb-6 w-fit">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'calendar' && <CalendarTab posts={posts} />}
            {activeTab === 'matrix' && <MatrixTab ideas={ideas} />}
            {activeTab === 'roi' && <RoiTab campaigns={campaigns} entries={entries} />}
          </>
        )}
      </main>
    </div>
  );
}
