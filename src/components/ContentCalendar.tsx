import { useState } from 'react';
import { Plus, FlaskConical, Trash2, ChevronLeft, ChevronRight, Camera, Rocket } from 'lucide-react';
import type { Post, PostStatus } from '../types';

interface Props {
  posts: Post[];
  themes: string[];
  contentTypes: string[];
  onAddPost: (post: Omit<Post, 'id'>) => void;
  onUpdatePost: (id: string, patch: Partial<Post>) => void;
  onDeletePost: (id: string) => void;
  onOpenLab: (postId: string) => void;
}

type CalendarView = 'posting' | 'filming';

const STATUS_COLORS: Record<PostStatus, { bg: string; text: string; dot: string }> = {
  IDEA:      { bg: 'bg-slate-100',   text: 'text-slate-600',   dot: 'bg-slate-400' },
  DRAFT:     { bg: 'bg-indigo-100',  text: 'text-indigo-700',  dot: 'bg-indigo-500' },
  SCHEDULED: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
};

export default function ContentCalendar({
  posts, themes, contentTypes, onAddPost, onUpdatePost, onDeletePost, onOpenLab,
}: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calView, setCalView] = useState<CalendarView>('posting');
  const [showAdd, setShowAdd] = useState(false);
  const [newPost, setNewPost] = useState<Omit<Post, 'id'>>({
    title: '',
    date: new Date().toISOString().split('T')[0],
    status: 'IDEA',
    theme: themes[0] ?? '',
    type: contentTypes[0] ?? '',
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const toStr = (d: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const today = new Date().toISOString().split('T')[0];

  // In filming view: show posts on filmingDate; in posting view: show on date
  const getPostsForDay = (dateStr: string) => {
    if (calView === 'filming') {
      return posts.filter(p => p.filmingDate === dateStr);
    }
    return posts.filter(p => p.date === dateStr);
  };

  // For posting view: also show a small filming indicator if filming date falls on this day
  const getFilmingForDay = (dateStr: string) => {
    if (calView === 'posting') {
      return posts.filter(p => p.filmingDate === dateStr);
    }
    return [];
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const handleAdd = () => {
    if (!newPost.title.trim()) return;
    onAddPost({ ...newPost, theme: newPost.theme || themes[0] || '', type: newPost.type || contentTypes[0] || '' });
    setShowAdd(false);
    setNewPost(p => ({ ...p, title: '' }));
  };

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Stats for header
  const postsWithFilming = posts.filter(p => p.filmingDate).length;
  const postsScheduled = posts.filter(p => p.status === 'SCHEDULED').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Content Calendar</h1>
          <p className="text-slate-500 text-sm mt-1">Plan your filming sessions and publishing schedule.</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Post
        </button>
      </div>

      {/* Month navigation + view toggle */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h2 className="text-lg font-semibold text-slate-800 min-w-[180px] text-center">{monthName}</h2>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* View toggle */}
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-semibold">
          <button onClick={() => setCalView('posting')}
            className={`flex items-center gap-1.5 px-3 py-2 transition-colors ${calView === 'posting' ? 'bg-emerald-500 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Rocket className="w-3.5 h-3.5" /> Publishing
          </button>
          <button onClick={() => setCalView('filming')}
            className={`flex items-center gap-1.5 px-3 py-2 transition-colors ${calView === 'filming' ? 'bg-blue-500 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Camera className="w-3.5 h-3.5" /> Filming
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 ml-2">
          {calView === 'posting' ? (
            (['IDEA', 'DRAFT', 'SCHEDULED'] as PostStatus[]).map(s => (
              <div key={s} className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[s].dot}`} />
                {s}
              </div>
            ))
          ) : (
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1"><Camera className="w-3 h-3 text-blue-500" /> {postsWithFilming} with film date</span>
              <span className="flex items-center gap-1"><Rocket className="w-3 h-3 text-emerald-500" /> {postsScheduled} scheduled</span>
            </div>
          )}
        </div>
      </div>

      {/* View label banner */}
      {calView === 'filming' && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-sm text-blue-800">
          <Camera className="w-4 h-4 text-blue-600 shrink-0" />
          <span><strong>Filming view</strong> — showing when you plan to record each post. Switch to Publishing to see go-live dates.</span>
        </div>
      )}

      {/* Calendar grid */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-200">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-xs font-semibold text-slate-500 text-center py-2 uppercase tracking-wider">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="border-b border-r border-slate-100 min-h-[100px] bg-slate-50/50" />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const dateStr = toStr(day);
            const dayPosts = getPostsForDay(dateStr);
            const filmingIndicators = getFilmingForDay(dateStr);
            const isToday = dateStr === today;
            return (
              <div key={day} className="border-b border-r border-slate-100 min-h-[100px] p-2 hover:bg-slate-50 transition-colors">
                <div className={`text-xs font-medium mb-1.5 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>
                  {day}
                </div>
                {/* Filming indicators in posting view */}
                {filmingIndicators.length > 0 && (
                  <div className="mb-1 flex flex-wrap gap-1">
                    {filmingIndicators.map(p => (
                      <div key={`film-${p.id}`} className="flex items-center gap-0.5 bg-blue-50 border border-blue-200 rounded px-1 py-0.5 text-[9px] text-blue-700 font-medium">
                        <Camera className="w-2.5 h-2.5" />
                        <span className="truncate max-w-[60px]">{p.title}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="space-y-1">
                  {dayPosts.map(post => (
                    <CalendarPost key={post.id} post={post} view={calView}
                      onDelete={() => onDeletePost(post.id)}
                      onOpenLab={() => onOpenLab(post.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* List view */}
      {posts.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">All Posts ({posts.length})</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {[...posts].sort((a, b) => a.date.localeCompare(b.date)).map(post => (
              <div key={post.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors">
                <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLORS[post.status].dot}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{post.title}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <p className="text-xs text-slate-400">{post.theme} · {post.type}</p>
                    {post.filmingDate && (
                      <span className="flex items-center gap-1 text-[11px] text-blue-600 font-medium">
                        <Camera className="w-2.5 h-2.5" />{post.filmingDate}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                      <Rocket className="w-2.5 h-2.5" />{post.date}
                    </span>
                  </div>
                </div>
                <StatusSelect value={post.status} onChange={status => onUpdatePost(post.id, { status })} />
                <button onClick={() => onOpenLab(post.id)}
                  className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors" title="Open Script Lab"
                >
                  <FlaskConical className="w-4 h-4" />
                </button>
                <button onClick={() => onDeletePost(post.id)}
                  className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-300 hover:text-rose-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Post Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Plan a New Post</h2>
            <div className="space-y-3">
              <input type="text" value={newPost.title}
                onChange={e => setNewPost(p => ({ ...p, title: e.target.value }))}
                placeholder="Post title / hook..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                    <Rocket className="w-3 h-3 text-emerald-500" /> Post Date
                  </label>
                  <input type="date" value={newPost.date}
                    onChange={e => setNewPost(p => ({ ...p, date: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                    <Camera className="w-3 h-3 text-blue-500" /> Film Date <span className="text-slate-400">(opt.)</span>
                  </label>
                  <input type="date" value={newPost.filmingDate ?? ''}
                    onChange={e => setNewPost(p => ({ ...p, filmingDate: e.target.value || undefined }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Status</label>
                  <select value={newPost.status} onChange={e => setNewPost(p => ({ ...p, status: e.target.value as PostStatus }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="IDEA">Idea</option>
                    <option value="DRAFT">Draft</option>
                    <option value="SCHEDULED">Scheduled</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Theme</label>
                  <select value={newPost.theme} onChange={e => setNewPost(p => ({ ...p, theme: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {themes.length === 0 && <option value="">No themes</option>}
                    {themes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Format</label>
                  <select value={newPost.type} onChange={e => setNewPost(p => ({ ...p, type: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {contentTypes.length === 0 && <option value="">No types</option>}
                    {contentTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAdd(false)}
                className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >Cancel</button>
              <button onClick={handleAdd} disabled={!newPost.title.trim()}
                className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >Add to Calendar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarPost({ post, view, onDelete, onOpenLab }: {
  post: Post; view: CalendarView;
  onDelete: () => void; onOpenLab: () => void;
}) {
  const c = STATUS_COLORS[post.status];
  const isFilmView = view === 'filming';
  return (
    <div className={`group text-xs rounded px-1.5 py-1 cursor-pointer ${isFilmView ? 'bg-blue-50 text-blue-800 border border-blue-200' : `${c.bg} ${c.text}`}`}
      onClick={onOpenLab}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1 min-w-0">
          {isFilmView && <Camera className="w-2.5 h-2.5 shrink-0 text-blue-500" />}
          <span className="leading-snug font-medium truncate">{post.title}</span>
        </div>
        <button onClick={e => { e.stopPropagation(); onDelete(); }}
          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-current hover:text-rose-600"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      <div className="flex items-center gap-1.5 text-[9px] opacity-70 mt-0.5">
        <span>{post.type}</span>
        {!isFilmView && post.filmingDate && (
          <span className="flex items-center gap-0.5 text-blue-600 opacity-100">
            <Camera className="w-2 h-2" />{post.filmingDate}
          </span>
        )}
      </div>
    </div>
  );
}

function StatusSelect({ value, onChange }: { value: PostStatus; onChange: (s: PostStatus) => void }) {
  const c = STATUS_COLORS[value];
  return (
    <select value={value} onChange={e => onChange(e.target.value as PostStatus)}
      onClick={e => e.stopPropagation()}
      className={`text-xs font-medium px-2 py-1 rounded-full border-0 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer ${c.bg} ${c.text}`}
    >
      <option value="IDEA">IDEA</option>
      <option value="DRAFT">DRAFT</option>
      <option value="SCHEDULED">SCHEDULED</option>
    </select>
  );
}
