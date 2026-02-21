import { useState } from 'react';
import {
  TrendingUp, TrendingDown, Minus, Plus, Trash2,
  Euro, Users, Target, BarChart2, X, Pencil,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, BarChart, Bar,
} from 'recharts';
import type { Post, RoiCampaign, RoiEntry, RoiPlatform, RoiCampaignStatus } from '../types';

interface Props {
  posts: Post[];
  campaigns: RoiCampaign[];
  entries: RoiEntry[];
  onAddCampaign: (c: Omit<RoiCampaign, 'id' | 'createdAt'>) => Promise<void>;
  onUpdateCampaign: (id: string, patch: Partial<Pick<RoiCampaign, 'status' | 'targetCostPerFollower' | 'platform'>>) => Promise<void>;
  onDeleteCampaign: (id: string) => Promise<void>;
  onAddEntry: (e: Omit<RoiEntry, 'id'>) => Promise<void>;
  onUpdateEntry: (id: string, patch: Partial<Omit<RoiEntry, 'id' | 'campaignId'>>) => Promise<void>;
  onDeleteEntry: (id: string) => Promise<void>;
}

type Granularity = 'day' | 'week' | 'month';

const PLATFORMS: RoiPlatform[] = ['instagram', 'tiktok', 'facebook', 'other'];

function roiSignal(costPerFollower: number, target: number): 'good' | 'marginal' | 'bad' | 'none' {
  if (!isFinite(costPerFollower) || costPerFollower <= 0) return 'none';
  if (costPerFollower <= target) return 'good';
  if (costPerFollower <= target * 1.5) return 'marginal';
  return 'bad';
}

const SIGNAL = {
  good:     { label: 'ROI is Good',     sub: 'Consider scaling your budget.',       bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', icon: <TrendingUp className="w-4 h-4 text-emerald-600" /> },
  marginal: { label: 'ROI is Marginal', sub: 'Monitor closely before scaling.',      bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-800',   icon: <Minus className="w-4 h-4 text-amber-600" /> },
  bad:      { label: 'ROI is Negative', sub: 'Pause this ad or test a new creative.', bg: 'bg-rose-50',    border: 'border-rose-200',    text: 'text-rose-800',    icon: <TrendingDown className="w-4 h-4 text-rose-600" /> },
  none:     { label: 'No data yet',     sub: 'Add your first entry below.',          bg: 'bg-slate-50',   border: 'border-slate-200',   text: 'text-slate-600',   icon: <BarChart2 className="w-4 h-4 text-slate-400" /> },
};

export default function RoiTracker({ posts, campaigns, entries, onAddCampaign, onUpdateCampaign, onDeleteCampaign, onAddEntry, onDeleteEntry }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(campaigns[0]?.id ?? null);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [granularity, setGranularity] = useState<Granularity>('day');

  const selected = campaigns.find(c => c.id === selectedId) ?? null;
  const campaignEntries = entries.filter(e => e.campaignId === selectedId).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ROI Tracker</h1>
          <p className="text-slate-500 text-sm mt-1">Track ad spend vs follower growth to make smarter budget decisions.</p>
        </div>
        <button
          onClick={() => setShowNewCampaign(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </button>
      </div>

      {campaigns.length === 0 && !showNewCampaign ? (
        <EmptyState onAdd={() => setShowNewCampaign(true)} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          {/* Campaign sidebar */}
          <div className="space-y-2">
            {campaigns.map(c => {
              const cEntries = entries.filter(e => e.campaignId === c.id);
              const totalSpend = cEntries.reduce((s, e) => s + e.spend, 0);
              const totalFollowers = cEntries.reduce((s, e) => s + e.followersGained, 0);
              const avgCost = totalFollowers > 0 ? totalSpend / totalFollowers : 0;
              const sig = roiSignal(avgCost, c.targetCostPerFollower);
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left rounded-xl border p-4 transition-all ${
                    selectedId === c.id
                      ? 'border-indigo-300 bg-indigo-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{c.postTitle}</p>
                      <p className="text-xs text-slate-400 mt-0.5 capitalize">{c.platform}</p>
                    </div>
                    <StatusDot signal={sig} />
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                    <span>€{totalSpend.toFixed(0)} spent</span>
                    <span>·</span>
                    <span>{totalFollowers} followers</span>
                  </div>
                  {c.status !== 'active' && (
                    <span className={`mt-1.5 inline-block text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${c.status === 'stopped' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                      {c.status}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Campaign detail */}
          {selected ? (
            <CampaignDetail
              campaign={selected}
              entries={campaignEntries}
              granularity={granularity}
              onGranularityChange={setGranularity}
              onUpdateCampaign={onUpdateCampaign}
              onDeleteCampaign={async (id) => { await onDeleteCampaign(id); setSelectedId(campaigns.find(c => c.id !== id)?.id ?? null); }}
              onAddEntry={onAddEntry}
              onDeleteEntry={onDeleteEntry}
            />
          ) : null}
        </div>
      )}

      {showNewCampaign && (
        <NewCampaignModal
          posts={posts}
          onClose={() => setShowNewCampaign(false)}
          onSave={async (c) => { await onAddCampaign(c); setShowNewCampaign(false); }}
        />
      )}
    </div>
  );
}

/* ─── Campaign Detail ─────────────────────────────────────────────────── */

function CampaignDetail({ campaign, entries, granularity, onGranularityChange, onUpdateCampaign, onDeleteCampaign, onAddEntry, onDeleteEntry }: {
  campaign: RoiCampaign;
  entries: RoiEntry[];
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
  onUpdateCampaign: (id: string, patch: Partial<Pick<RoiCampaign, 'status' | 'targetCostPerFollower' | 'platform'>>) => Promise<void>;
  onDeleteCampaign: (id: string) => Promise<void>;
  onAddEntry: (e: Omit<RoiEntry, 'id'>) => Promise<void>;
  onDeleteEntry: (id: string) => Promise<void>;
}) {
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [editingThreshold, setEditingThreshold] = useState(false);
  const [thresholdDraft, setThresholdDraft] = useState(campaign.targetCostPerFollower.toString());

  const totalSpend = entries.reduce((s, e) => s + e.spend, 0);
  const totalFollowers = entries.reduce((s, e) => s + e.followersGained, 0);
  const avgCost = totalFollowers > 0 ? totalSpend / totalFollowers : 0;

  // Last 3 entries signal
  const last3 = entries.slice(-3);
  const last3Spend = last3.reduce((s, e) => s + e.spend, 0);
  const last3Followers = last3.reduce((s, e) => s + e.followersGained, 0);
  const recentCost = last3Followers > 0 ? last3Spend / last3Followers : avgCost;
  const sig = roiSignal(recentCost || avgCost, campaign.targetCostPerFollower);
  const signal = SIGNAL[sig];

  const aggregated = aggregate(entries, granularity);

  const saveThreshold = async () => {
    const val = parseFloat(thresholdDraft);
    if (!isNaN(val) && val > 0) await onUpdateCampaign(campaign.id, { targetCostPerFollower: val });
    setEditingThreshold(false);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">{campaign.postTitle}</h2>
            <p className="text-xs text-slate-400 mt-0.5 capitalize">{campaign.platform}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusSelect value={campaign.status} onChange={s => onUpdateCampaign(campaign.id, { status: s })} />
            <button onClick={() => onDeleteCampaign(campaign.id)} className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Decision signal */}
        <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${signal.bg} ${signal.border}`}>
          {signal.icon}
          <div>
            <p className={`text-sm font-semibold ${signal.text}`}>{signal.label}</p>
            <p className={`text-xs ${signal.text} opacity-80`}>{signal.sub}</p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <KPI label="Total Spend" value={`€${totalSpend.toFixed(2)}`} icon={<Euro className="w-3.5 h-3.5" />} />
          <KPI label="Followers Gained" value={totalFollowers.toString()} icon={<Users className="w-3.5 h-3.5" />} />
          <KPI label="Avg Cost/Follower" value={avgCost > 0 ? `€${avgCost.toFixed(2)}` : '—'} icon={<TrendingUp className="w-3.5 h-3.5" />} highlight={sig} />
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1"><Target className="w-3 h-3" />Threshold</p>
            {editingThreshold ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-500">€</span>
                <input
                  type="number" step="0.01" min="0.01"
                  value={thresholdDraft}
                  onChange={e => setThresholdDraft(e.target.value)}
                  onBlur={saveThreshold}
                  onKeyDown={e => e.key === 'Enter' && saveThreshold()}
                  className="w-16 text-sm font-bold text-slate-900 bg-transparent border-b border-indigo-400 focus:outline-none"
                  autoFocus
                />
              </div>
            ) : (
              <button onClick={() => { setThresholdDraft(campaign.targetCostPerFollower.toString()); setEditingThreshold(true); }} className="flex items-center gap-1 group">
                <p className="text-base font-bold text-slate-900">€{campaign.targetCostPerFollower.toFixed(2)}</p>
                <Pencil className="w-3 h-3 text-slate-300 group-hover:text-indigo-500 transition-colors" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Charts */}
      {entries.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Performance Trend</h3>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
              {(['day', 'week', 'month'] as Granularity[]).map(g => (
                <button key={g} onClick={() => onGranularityChange(g)}
                  className={`px-3 py-1.5 capitalize transition-colors ${granularity === g ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={aggregated} margin={{ left: -20, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line yAxisId="left" type="monotone" dataKey="spend" name="Spend (€)" stroke="#4f46e5" strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="right" type="monotone" dataKey="followers" name="Followers" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>

          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={aggregated} margin={{ left: -20, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `€${v}`} />
              <Tooltip formatter={(v: number | undefined) => v != null ? `€${v.toFixed(2)}` : ''} contentStyle={{ border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="costPerFollower" name="Cost/Follower (€)" radius={[3, 3, 0, 0]}
                fill="#4f46e5"
                label={false}
              >
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Entry log */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Daily Log ({entries.length})</h3>
          <button
            onClick={() => setShowAddEntry(true)}
            className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Entry
          </button>
        </div>

        {entries.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            No entries yet. Add your first day's data above.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {[...entries].reverse().map(entry => (
              <EntryRow
                key={entry.id}
                entry={entry}
                target={campaign.targetCostPerFollower}
                onDelete={() => onDeleteEntry(entry.id)}
              />
            ))}
          </div>
        )}
      </div>

      {showAddEntry && (
        <AddEntryModal
          campaignId={campaign.id}
          onClose={() => setShowAddEntry(false)}
          onSave={async (e) => { await onAddEntry(e); setShowAddEntry(false); }}
        />
      )}
    </div>
  );
}

/* ─── Entry Row ─────────────────────────────────────────────────────────── */

function EntryRow({ entry, target, onDelete }: {
  entry: RoiEntry;
  target: number;
  onDelete: () => Promise<void>;
}) {
  const cost = entry.followersGained > 0 ? entry.spend / entry.followersGained : 0;
  const sig = roiSignal(cost, target);

  return (
    <div className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors group">
      <StatusDot signal={sig} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-medium text-slate-700 w-24 shrink-0">{entry.date}</span>
          <span className="text-slate-500">€{entry.spend.toFixed(2)} spent</span>
          <span className="text-slate-500">{entry.followersGained} followers</span>
          {cost > 0 && (
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
              sig === 'good' ? 'bg-emerald-100 text-emerald-700' :
              sig === 'marginal' ? 'bg-amber-100 text-amber-700' :
              'bg-rose-100 text-rose-700'
            }`}>
              €{cost.toFixed(2)}/follower
            </span>
          )}
        </div>
        {entry.notes && <p className="text-xs text-slate-400 mt-0.5 truncate">{entry.notes}</p>}
      </div>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded text-slate-300 hover:text-rose-500 hover:bg-rose-50"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/* ─── Modals ─────────────────────────────────────────────────────────────── */

function NewCampaignModal({ posts, onClose, onSave }: {
  posts: Post[];
  onClose: () => void;
  onSave: (c: Omit<RoiCampaign, 'id' | 'createdAt'>) => Promise<void>;
}) {
  const [postId, setPostId] = useState<string>(posts[0]?.id ?? '');
  const [customTitle, setCustomTitle] = useState('');
  const [useCustomTitle, setUseCustomTitle] = useState(posts.length === 0);
  const [platform, setPlatform] = useState<RoiPlatform>('instagram');
  const [threshold, setThreshold] = useState('0.50');
  const [saving, setSaving] = useState(false);

  const resolvedTitle = useCustomTitle
    ? customTitle
    : posts.find(p => p.id === postId)?.title ?? '';

  const save = async () => {
    if (!resolvedTitle.trim()) return;
    setSaving(true);
    await onSave({
      postId: useCustomTitle ? null : postId || null,
      postTitle: resolvedTitle.trim(),
      platform,
      targetCostPerFollower: parseFloat(threshold) || 0.5,
      status: 'active',
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">New Ad Campaign</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="space-y-3">
          {posts.length > 0 && (
            <div className="flex gap-2 text-xs">
              <button onClick={() => setUseCustomTitle(false)} className={`px-3 py-1 rounded-full border ${!useCustomTitle ? 'bg-indigo-600 text-white border-indigo-600' : 'text-slate-500 border-slate-200'}`}>
                Pick from calendar
              </button>
              <button onClick={() => setUseCustomTitle(true)} className={`px-3 py-1 rounded-full border ${useCustomTitle ? 'bg-indigo-600 text-white border-indigo-600' : 'text-slate-500 border-slate-200'}`}>
                Custom title
              </button>
            </div>
          )}

          {!useCustomTitle && posts.length > 0 ? (
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Post</label>
              <select value={postId} onChange={e => setPostId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {posts.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Post / Creative title</label>
              <input type="text" value={customTitle} onChange={e => setCustomTitle(e.target.value)}
                placeholder="e.g. Reel: My morning routine"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Platform</label>
              <select value={platform} onChange={e => setPlatform(e.target.value as RoiPlatform)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 capitalize">
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Max €/follower (target)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">€</span>
                <input type="number" step="0.01" min="0.01" value={threshold} onChange={e => setThreshold(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={save} disabled={!resolvedTitle.trim() || saving}
            className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Create Campaign'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddEntryModal({ campaignId, onClose, onSave }: {
  campaignId: string;
  onClose: () => void;
  onSave: (e: Omit<RoiEntry, 'id'>) => Promise<void>;
}) {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [spend, setSpend] = useState('');
  const [followers, setFollowers] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const cost = parseFloat(spend) > 0 && parseInt(followers) > 0
    ? parseFloat(spend) / parseInt(followers)
    : null;

  const save = async () => {
    if (!spend || !followers) return;
    setSaving(true);
    await onSave({ campaignId, date, spend: parseFloat(spend), followersGained: parseInt(followers), notes });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Add Entry</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Ad Spend (€)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">€</span>
                <input type="number" step="0.01" min="0" value={spend} onChange={e => setSpend(e.target.value)} placeholder="10.00"
                  className="w-full pl-7 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">New Followers</label>
              <input type="number" min="0" value={followers} onChange={e => setFollowers(e.target.value)} placeholder="25"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          {cost !== null && (
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
              <span className="text-xs text-slate-500">Cost per follower:</span>
              <span className="text-sm font-bold text-slate-900">€{cost.toFixed(2)}</span>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Notes (optional)</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Increased budget to €20"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={save} disabled={!spend || !followers || saving}
            className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Add Entry'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function aggregate(entries: RoiEntry[], granularity: Granularity) {
  const buckets = new Map<string, { spend: number; followers: number }>();
  for (const e of entries) {
    const key = granularity === 'day' ? e.date
      : granularity === 'week' ? weekLabel(e.date)
      : monthLabel(e.date);
    const prev = buckets.get(key) ?? { spend: 0, followers: 0 };
    buckets.set(key, { spend: prev.spend + e.spend, followers: prev.followers + e.followersGained });
  }
  return Array.from(buckets.entries()).map(([label, { spend, followers }]) => ({
    label,
    spend: Math.round(spend * 100) / 100,
    followers,
    costPerFollower: followers > 0 ? Math.round((spend / followers) * 100) / 100 : 0,
  }));
}

function weekLabel(date: string): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return `W${monday.toISOString().slice(5, 10)}`;
}

function monthLabel(date: string): string {
  return date.slice(0, 7);
}

function StatusDot({ signal }: { signal: 'good' | 'marginal' | 'bad' | 'none' }) {
  const map = {
    good:     'bg-emerald-500',
    marginal: 'bg-amber-400',
    bad:      'bg-rose-500',
    none:     'bg-slate-300',
  };
  return <span className={`shrink-0 w-2 h-2 rounded-full ${map[signal]}`} />;
}

function KPI({ label, value, icon, highlight }: { label: string; value: string; icon: React.ReactNode; highlight?: 'good' | 'marginal' | 'bad' | 'none' }) {
  const col = highlight === 'good' ? 'text-emerald-700' : highlight === 'bad' ? 'text-rose-700' : highlight === 'marginal' ? 'text-amber-700' : 'text-slate-900';
  return (
    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">{icon}{label}</p>
      <p className={`text-base font-bold ${col}`}>{value}</p>
    </div>
  );
}

function StatusSelect({ value, onChange }: { value: RoiCampaignStatus; onChange: (s: RoiCampaignStatus) => Promise<void> }) {
  const map: Record<RoiCampaignStatus, string> = {
    active:  'bg-emerald-100 text-emerald-700',
    paused:  'bg-amber-100 text-amber-700',
    stopped: 'bg-rose-100 text-rose-700',
  };
  return (
    <select value={value} onChange={e => onChange(e.target.value as RoiCampaignStatus)}
      className={`text-xs font-semibold px-2 py-1 rounded-full border-0 focus:outline-none focus:ring-2 focus:ring-indigo-500 capitalize cursor-pointer ${map[value]}`}>
      <option value="active">Active</option>
      <option value="paused">Paused</option>
      <option value="stopped">Stopped</option>
    </select>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center space-y-4">
      <BarChart2 className="w-10 h-10 text-slate-200 mx-auto" />
      <div>
        <p className="text-slate-700 font-semibold">No ad campaigns yet</p>
        <p className="text-slate-400 text-sm mt-1">Track a post you're boosting to see ROI signals and decide when to scale or stop.</p>
      </div>
      <button onClick={onAdd} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
        <Plus className="w-4 h-4" />
        Create first campaign
      </button>
    </div>
  );
}
