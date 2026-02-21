import { AlertTriangle, FileText, Lightbulb, Calendar, TrendingUp, Users, DollarSign, Sparkles } from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import type { AppState } from '../types';

interface Props {
  state: AppState;
  onNavigate: (tab: AppState['activeTab']) => void;
}

const COLORS = ['#4f46e5', '#7c3aed', '#0891b2', '#059669', '#d97706', '#dc2626'];

export default function Dashboard({ state, onNavigate }: Props) {
  const { brandIdentity, posts, themes, roiCampaigns, roiEntries } = state;

  const identityFields = [
    brandIdentity.icp,
    brandIdentity.empathyMap.pains,
    brandIdentity.empathyMap.gains,
    brandIdentity.empathyMap.fears,
    brandIdentity.empathyMap.hopes,
    brandIdentity.positioning,
    brandIdentity.tone,
  ];
  const filledFields = identityFields.filter(f => f.trim().length > 0).length;
  const identityComplete = filledFields === identityFields.length;
  const identityPct = Math.round((filledFields / identityFields.length) * 100);

  const themeCounts = themes.map(theme => ({
    name: theme,
    count: posts.filter(p => p.theme === theme).length,
  })).filter(t => t.count > 0);

  const totalPosts = posts.length;
  const maxThemeCount = themeCounts.reduce((max, t) => Math.max(max, t.count), 0);
  const dominantPct = totalPosts > 0 ? Math.round((maxThemeCount / totalPosts) * 100) : 0;
  const themeImbalance = dominantPct > 60;

  const statusCounts = {
    IDEA: posts.filter(p => p.status === 'IDEA').length,
    DRAFT: posts.filter(p => p.status === 'DRAFT').length,
    SCHEDULED: posts.filter(p => p.status === 'SCHEDULED').length,
  };

  const statusData = [
    { name: 'Idea', value: statusCounts.IDEA, color: '#94a3b8' },
    { name: 'Draft', value: statusCounts.DRAFT, color: '#4f46e5' },
    { name: 'Scheduled', value: statusCounts.SCHEDULED, color: '#059669' },
  ].filter(d => d.value > 0);

  // ROI Aggregates
  const totalSpend = roiEntries.reduce((sum, e) => sum + e.spend, 0);
  const totalFollowers = roiEntries.reduce((sum, e) => sum + e.followersGained, 0);
  const overallCpf = totalFollowers > 0 ? totalSpend / totalFollowers : 0;



  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Command Center</h1>
        <p className="text-slate-500 text-sm mt-1">Your content engine at a glance.</p>
      </div>

      {/* Alert banners */}
      {!identityComplete && (
        <div
          className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 cursor-pointer hover:bg-amber-100 transition-colors"
          onClick={() => onNavigate('identity')}
        >
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">Brand Identity Incomplete ({identityPct}%)</p>
            <p className="text-xs text-amber-600">AI generations will lack strategic context. Complete your identity → </p>
          </div>
        </div>
      )}

      {themeImbalance && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <p className="text-sm font-medium text-rose-800">
            Theme imbalance detected — one theme covers {dominantPct}% of your calendar (target: &lt;60%)
          </p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={<Lightbulb className="w-5 h-5 text-slate-400" />} label="Ideas" value={statusCounts.IDEA} color="slate" />
        <KPICard icon={<FileText className="w-5 h-5 text-indigo-400" />} label="Drafts" value={statusCounts.DRAFT} color="indigo" />
        <KPICard icon={<Calendar className="w-5 h-5 text-emerald-400" />} label="Scheduled" value={statusCounts.SCHEDULED} color="emerald" />
        <KPICard
          icon={<TrendingUp className="w-5 h-5 text-rose-400" />}
          label="ROI (CPF)"
          value={`$${overallCpf.toFixed(2)}`}
          color="rose"
          onClick={() => onNavigate('roi')}
        />
      </div>

      {/* ROI & Identity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 text-white shadow-lg shadow-indigo-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold">Growth Performance</h2>
              <p className="text-indigo-100 text-xs">Aggregate data from {roiCampaigns.length} campaigns</p>
            </div>
            <button
              onClick={() => onNavigate('roi')}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            >
              Detailed Analytics
            </button>
          </div>
          <div className="grid grid-cols-3 gap-8">
            <div>
              <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-wider mb-1">Total Spend</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black">${totalSpend.toLocaleString()}</span>
                <DollarSign className="w-3 h-3 text-indigo-300" />
              </div>
            </div>
            <div>
              <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-wider mb-1">Followers</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black">{totalFollowers.toLocaleString()}</span>
                <Users className="w-3 h-3 text-indigo-300" />
              </div>
            </div>
            <div>
              <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-wider mb-1">Avg. CPF</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black">${overallCpf.toFixed(2)}</span>
                <TrendingUp className="w-3 h-3 text-indigo-300" />
              </div>
            </div>
          </div>
        </div>

        <div
          className={`rounded-2xl border p-6 cursor-pointer hover:shadow-md transition-shadow relative overflow-hidden group ${identityComplete ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}
          onClick={() => onNavigate('identity')}
        >
          <div className="relative z-10">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Identity Strength</p>
            <p className={`text-4xl font-black ${identityComplete ? 'text-emerald-700' : 'text-amber-700'}`}>
              {identityPct}%
            </p>
            <p className={`text-sm font-medium mt-2 ${identityComplete ? 'text-emerald-600' : 'text-amber-600'}`}>
              {identityComplete ? 'System Fully Optimized' : 'Action Required'}
            </p>
            {!identityComplete && (
              <p className="text-xs text-amber-500 mt-1 opacity-80">Complete fields to improve AI accuracy</p>
            )}
          </div>
          <div className="absolute right-[-10px] bottom-[-10px] opacity-10 group-hover:scale-110 transition-transform duration-500">
            <Sparkles className="w-24 h-24" />
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Theme distribution */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Content by Theme</h2>
          {themeCounts.length === 0 ? (
            <EmptyState label="No posts planned yet" action="Go to Strategy Matrix" onClick={() => onNavigate('matrix')} />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={themeCounts} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {themeCounts.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Status funnel */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Production Funnel</h2>
          {statusData.length === 0 ? (
            <EmptyState label="No content in the pipeline" action="Open Calendar" onClick={() => onNavigate('calendar')} />
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {statusData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3">
                {statusData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-sm text-slate-600">{d.name}</span>
                    <span className="text-sm font-bold text-slate-900 ml-auto pl-4">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <QuickBtn label="Define Brand Identity" onClick={() => onNavigate('identity')} variant="primary" />
          <QuickBtn label="Generate Ideas" onClick={() => onNavigate('matrix')} variant="secondary" />
          <QuickBtn label="View Calendar" onClick={() => onNavigate('calendar')} variant="secondary" />
          <QuickBtn label="ROI Tracker" onClick={() => onNavigate('roi')} variant="secondary" />
          <QuickBtn label="Open Script Lab" onClick={() => onNavigate('lab')} variant="secondary" />
        </div>
      </div>
    </div>
  );
}

function KPICard({
  icon, label, value, color, onClick
}: {
  icon: React.ReactNode; label: string; value: string | number; color: string; onClick?: () => void
}) {
  const colorMap: Record<string, string> = {
    slate: 'bg-slate-50 border-slate-200 text-slate-900',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    rose: 'bg-rose-50 border-rose-200 text-rose-900',
  };
  return (
    <div
      className={`rounded-xl border p-4 ${colorMap[color]} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function EmptyState({ label, action, onClick }: { label: string; action: string; onClick: () => void }) {
  return (
    <div className="h-[220px] flex flex-col items-center justify-center gap-3 text-slate-400">
      <p className="text-sm">{label}</p>
      <button onClick={onClick} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline">
        {action}
      </button>
    </div>
  );
}

function QuickBtn({ label, onClick, variant }: { label: string; onClick: () => void; variant: 'primary' | 'secondary' }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${variant === 'primary'
        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
        }`}
    >
      {label}
    </button>
  );
}
