import { useState } from 'react';
import { Activity, CalendarDays, Grid3X3, Trash2, ChevronDown, ChevronUp, RotateCcw, CheckCircle } from 'lucide-react';
import type { AgentAction, AgentActionType } from '../types';

interface Props {
  agentActions: AgentAction[];
  onUndoAction: (action: AgentAction) => Promise<void>;
  onNavigateToCalendar: () => void;
  onNavigateToMatrix: () => void;
}

const ACTION_META: Record<AgentActionType, { label: string; icon: React.ReactNode; color: string }> = {
  add_post: {
    label: 'Added to Calendar',
    icon: <CalendarDays className="w-3.5 h-3.5" />,
    color: 'text-indigo-600 bg-indigo-50',
  },
  add_matrix_idea: {
    label: 'Added to Matrix',
    icon: <Grid3X3 className="w-3.5 h-3.5" />,
    color: 'text-violet-600 bg-violet-50',
  },
};

function groupByContext(actions: AgentAction[]): { context: string; date: string; actions: AgentAction[] }[] {
  const map = new Map<string, { context: string; date: string; actions: AgentAction[] }>();
  for (const action of actions) {
    const key = action.chatContext || 'Manual';
    if (!map.has(key)) {
      map.set(key, {
        context: action.chatContext || 'Manual',
        date: action.createdAt,
        actions: [],
      });
    }
    map.get(key)!.actions.push(action);
  }
  return Array.from(map.values());
}

export default function AgentHub({ agentActions, onUndoAction, onNavigateToCalendar, onNavigateToMatrix }: Props) {
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const postsCreated = agentActions.filter(a => a.actionType === 'add_post').length;
  const ideasCreated = agentActions.filter(a => a.actionType === 'add_matrix_idea').length;

  const groups = groupByContext(agentActions);

  const handleUndo = async (action: AgentAction) => {
    setUndoingId(action.id);
    try {
      await onUndoAction(action);
    } finally {
      setUndoingId(null);
    }
  };

  const toggleGroup = (context: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(context)) next.delete(context);
      else next.add(context);
      return next;
    });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Agent Hub</h1>
        <p className="text-slate-500 text-sm mt-1">
          Everything your Content Agent has done — every post added, every idea created.
        </p>
      </div>

      {/* Stats */}
      {agentActions.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard
            label="Posts created"
            value={postsCreated}
            icon={<CalendarDays className="w-4 h-4 text-indigo-500" />}
            onClick={onNavigateToCalendar}
            cta="View Calendar"
          />
          <StatCard
            label="Ideas in Matrix"
            value={ideasCreated}
            icon={<Grid3X3 className="w-4 h-4 text-violet-500" />}
            onClick={onNavigateToMatrix}
            cta="View Matrix"
          />
          <StatCard
            label="Total actions"
            value={agentActions.length}
            icon={<Activity className="w-4 h-4 text-slate-500" />}
          />
        </div>
      )}

      {/* Empty state */}
      {agentActions.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-14 text-center space-y-4">
          <div className="w-12 h-12 mx-auto bg-indigo-100 rounded-2xl flex items-center justify-center">
            <Activity className="w-6 h-6 text-indigo-500" />
          </div>
          <div>
            <p className="text-slate-700 font-semibold">No actions yet</p>
            <p className="text-slate-400 text-sm mt-1 max-w-sm mx-auto">
              Ask the Content Agent to build a calendar, create content ideas, or plan a month — it will do the work here.
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 text-left max-w-sm mx-auto">
            <p className="text-xs font-semibold text-slate-600 mb-2">Try saying:</p>
            {[
              '"Build my full March content calendar"',
              '"Add 5 mindset post ideas to the matrix"',
              '"Create a week of growth content"',
            ].map((s, i) => (
              <p key={i} className="text-xs text-slate-500 mb-1 italic">{s}</p>
            ))}
          </div>
        </div>
      )}

      {/* Action groups */}
      {groups.map(group => {
        const isCollapsed = collapsed.has(group.context);
        const postCount = group.actions.filter(a => a.actionType === 'add_post').length;
        const ideaCount = group.actions.filter(a => a.actionType === 'add_matrix_idea').length;

        return (
          <div key={group.context} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Group header */}
            <button
              onClick={() => toggleGroup(group.context)}
              className="w-full flex items-start justify-between gap-3 px-5 py-4 hover:bg-slate-50 transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {postCount > 0 && (
                    <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full font-medium">
                      {postCount} post{postCount > 1 ? 's' : ''} →  Calendar
                    </span>
                  )}
                  {ideaCount > 0 && (
                    <span className="text-xs px-2 py-0.5 bg-violet-50 text-violet-700 rounded-full font-medium">
                      {ideaCount} idea{ideaCount > 1 ? 's' : ''} → Matrix
                    </span>
                  )}
                  <span className="text-xs text-slate-400">
                    {new Date(group.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1.5 truncate">
                  <span className="font-medium text-slate-700">Triggered by:</span> "{group.context}"
                </p>
              </div>
              <div className="shrink-0 text-slate-400 mt-0.5">
                {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </div>
            </button>

            {/* Action items */}
            {!isCollapsed && (
              <div className="border-t border-slate-100 divide-y divide-slate-100">
                {group.actions.map(action => {
                  const meta = ACTION_META[action.actionType];
                  const isUndoing = undoingId === action.id;
                  return (
                    <div key={action.id} className="flex items-center gap-3 px-5 py-3">
                      <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg shrink-0 ${meta.color}`}>
                        {meta.icon}
                        {meta.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800 truncate font-medium">{action.itemTitle}</p>
                        {action.itemMeta && (
                          <p className="text-xs text-slate-400 mt-0.5">{action.itemMeta}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleUndo(action)}
                        disabled={isUndoing}
                        title="Undo this action"
                        className="shrink-0 flex items-center gap-1 text-xs text-slate-400 hover:text-rose-500 hover:bg-rose-50 px-2 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                      >
                        {isUndoing
                          ? <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {agentActions.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-slate-400 pb-4">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
          All actions are reversible — click the trash icon on any item to undo it.
        </div>
      )}
    </div>
  );
}

function StatCard({
  label, value, icon, onClick, cta,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  onClick?: () => void;
  cta?: string;
}) {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 p-4 space-y-2 ${onClick ? 'cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        {icon}
        {onClick && cta && (
          <span className="text-xs text-indigo-500 font-medium">{cta} →</span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
