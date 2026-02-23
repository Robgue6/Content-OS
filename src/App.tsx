import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, User, Grid3X3, CalendarDays, FlaskConical,
  Settings as SettingsIcon, Loader2, TrendingUp, LogOut,
  ChevronLeft, ChevronRight, Menu, X,
} from 'lucide-react';

import Dashboard from './components/Dashboard';
import BrandIdentity from './components/BrandIdentity';
import StrategyMatrix from './components/StrategyMatrix';
import ContentCalendar from './components/ContentCalendar';
import ScriptLab from './components/ScriptLab';
import Settings from './components/Settings';
import RoiTracker from './components/RoiTracker';
import ChatAgent from './components/ChatAgent';
import SharedView from './components/SharedView';
import AuthPage from './components/auth/AuthPage';
import LandingPage from './components/LandingPage';
import OpenAI from 'openai';

import { useAuth } from './hooks/useAuth';
import { supabase } from './lib/supabase';
import * as db from './lib/db';
import * as analytics from './lib/analytics';

import type { AppState, NavTab, Post, Script, MatrixIdea, RoiCampaign, RoiEntry, BrandIdentity as BrandIdentityType, AppLanguage, ChatMessage, ShareLink } from './types';

const DEFAULT_BRAND: BrandIdentityType = {
  icp: '',
  empathyMap: { pains: '', gains: '', fears: '', hopes: '' },
  positioning: '',
  tone: '',
};

const NAV_ITEMS: { tab: NavTab; label: string; icon: React.ReactNode }[] = [
  { tab: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
  { tab: 'identity', label: 'Brand', icon: <User className="w-[18px] h-[18px]" /> },
  { tab: 'matrix', label: 'Matrix', icon: <Grid3X3 className="w-[18px] h-[18px]" /> },
  { tab: 'calendar', label: 'Calendar', icon: <CalendarDays className="w-[18px] h-[18px]" /> },
  { tab: 'lab', label: 'Script Lab', icon: <FlaskConical className="w-[18px] h-[18px]" /> },
  { tab: 'roi', label: 'ROI', icon: <TrendingUp className="w-[18px] h-[18px]" /> },
];

export default function App() {
  const shareToken = new URLSearchParams(window.location.search).get('share');
  const { session, user, loading: authLoading } = useAuth();

  const [showAuth, setShowAuth] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [showSettings, setShowSettings] = useState(false);
  const [scriptLabPostId, setScriptLabPostId] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  // Sidebar state
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [brandIdentity, setBrandIdentity] = useState<BrandIdentityType>(DEFAULT_BRAND);
  const [themes, setThemes] = useState<string[]>(['Growth', 'Mindset', 'Tools']);
  const [contentTypes, setContentTypes] = useState<string[]>(['Tutorial', 'Story', 'Listicle', 'Hot Take']);
  const [aiEnabled, setAiEnabledState] = useState(false);
  const [language, setLanguageState] = useState<AppLanguage>('en');
  const [posts, setPosts] = useState<Post[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [matrixIdeas, setMatrixIdeas] = useState<MatrixIdea[]>([]);
  const [roiCampaigns, setRoiCampaigns] = useState<RoiCampaign[]>([]);
  const [roiEntries, setRoiEntries] = useState<RoiEntry[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [aiAgentEnabled, setAiAgentEnabledState] = useState(false);
  const [chatAgentOpen, setChatAgentOpen] = useState(false);
  const [shareLink, setShareLink] = useState<ShareLink | null>(null);

  // Identify / reset user in Amplitude on auth change
  useEffect(() => {
    if (user) {
      analytics.identifyUser(user.id, user.email ?? '');
    } else {
      analytics.resetUser();
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setDataLoading(true);
    Promise.all([
      db.fetchProfile(user.id),
      db.fetchPosts(user.id),
      db.fetchScripts(user.id),
      db.fetchMatrixIdeas(user.id),
      db.fetchRoiCampaigns(user.id),
      db.fetchRoiEntries(user.id),
      db.fetchChatMessages(user.id),
      db.fetchShareLink(user.id),
    ]).then(([profile, postsData, scriptsData, ideasData, campaignsData, entriesData, messagesData, shareLinkData]) => {
      if (profile) {
        setBrandIdentity(profile.brand_identity && Object.keys(profile.brand_identity).length > 0
          ? profile.brand_identity as BrandIdentityType : DEFAULT_BRAND);
        setThemes(profile.themes.length > 0 ? profile.themes : ['Growth', 'Mindset', 'Tools']);
        setContentTypes(profile.content_types.length > 0 ? profile.content_types : ['Tutorial', 'Story', 'Listicle', 'Hot Take']);
        setAiEnabledState(profile.ai_enabled);
        setAiAgentEnabledState(profile.ai_agent_enabled ?? false);
        setLanguageState((profile.language as AppLanguage) ?? 'en');
      }
      setPosts(postsData);
      setScripts(scriptsData);
      setMatrixIdeas(ideasData);
      setRoiCampaigns(campaignsData);
      setRoiEntries(entriesData);
      setChatMessages(messagesData);
      setShareLink(shareLinkData);
    }).finally(() => setDataLoading(false));
  }, [user]);

  const navigate = useCallback((tab: NavTab) => {
    setActiveTab(tab);
    setShowSettings(false);
    setMobileOpen(false);
    analytics.trackPageViewed(tab);
  }, []);

  const signOut = () => {
    analytics.trackSignOut();
    supabase.auth.signOut();
  };

  // ── Profile ──────────────────────────────────────────────────────────────
  const updateBrandIdentity = async (identity: BrandIdentityType) => {
    setBrandIdentity(identity);
    if (user) await db.updateProfile(user.id, { brand_identity: identity });
  };
  const addTheme = async (theme: string, source: 'manual' | 'ai' = 'manual') => {
    const next = [...themes, theme]; setThemes(next);
    if (user) await db.updateProfile(user.id, { themes: next });
    analytics.trackThemeAdded(theme, source);
  };
  const removeTheme = async (theme: string) => {
    const next = themes.filter(t => t !== theme); setThemes(next);
    if (user) await db.updateProfile(user.id, { themes: next });
    analytics.trackThemeRemoved(theme);
  };
  const addContentType = async (type: string, source: 'manual' | 'ai' = 'manual') => {
    const next = [...contentTypes, type]; setContentTypes(next);
    if (user) await db.updateProfile(user.id, { content_types: next });
    analytics.trackContentTypeAdded(type, source);
  };
  const removeContentType = async (type: string) => {
    const next = contentTypes.filter(t => t !== type); setContentTypes(next);
    if (user) await db.updateProfile(user.id, { content_types: next });
    analytics.trackContentTypeRemoved(type);
  };
  const setAiEnabled = async (enabled: boolean) => {
    setAiEnabledState(enabled);
    if (user) await db.updateProfile(user.id, { ai_enabled: enabled });
  };
  const setAiAgentEnabled = async (enabled: boolean) => {
    setAiAgentEnabledState(enabled);
    analytics.trackAiAgentToggled(enabled);
    if (user) await db.updateProfile(user.id, { ai_agent_enabled: enabled });
  };
  const handleSendMessage = async (userContent: string) => {
    if (!user) return;
    const tempId = `temp-${Date.now()}`;
    const tempUserMsg: ChatMessage = {
      id: tempId,
      role: 'user',
      content: userContent,
      createdAt: new Date().toISOString(),
    };
    setChatMessages(prev => [...prev, tempUserMsg]);
    const savedUser = await db.insertChatMessage(user.id, 'user', userContent);
    if (savedUser) {
      setChatMessages(prev => prev.map(m => m.id === tempId ? savedUser : m));
    }
    const recentPosts = posts.slice(-10).map(p =>
      `- "${p.title}" | ${p.theme} | ${p.type} | ${p.status} | ${p.date}`
    ).join('\n');
    const recentIdeas = matrixIdeas.slice(-10).map(i =>
      `- "${i.title}" | ${i.theme} | ${i.type}${i.done ? ' (done)' : ''}`
    ).join('\n');
    const systemPrompt = buildAgentSystem({ brandIdentity, themes, contentTypes, language, recentPosts, recentIdeas });
    const historyForAI = chatMessages.slice(-20).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
    try {
      const orKey = import.meta.env.VITE_OPENROUTER_API_KEY as string;
      const openai = new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: orKey, dangerouslyAllowBrowser: true });
      const response = await openai.chat.completions.create({
        model: 'arcee-ai/trinity-large-preview:free',
        messages: [
          { role: 'system', content: systemPrompt },
          ...historyForAI,
          { role: 'user', content: userContent },
        ],
      });
      const assistantContent = response.choices[0].message.content ?? 'No response.';
      const savedAssistant = await db.insertChatMessage(user.id, 'assistant', assistantContent);
      if (savedAssistant) {
        setChatMessages(prev => [...prev, savedAssistant]);
      }
      analytics.trackAgentMessageSent(userContent.length);
    } catch (e) {
      console.error('Agent error', e);
      analytics.trackAgentError(String(e));
      throw e;
    }
  };
  const handleClearHistory = async () => {
    if (!user) return;
    setChatMessages([]);
    await db.clearChatMessages(user.id);
    analytics.trackAgentHistoryCleared();
  };
  const generateShareLink = async () => {
    if (!user) return;
    const link = await db.insertShareLink(user.id);
    if (link) { setShareLink(link); analytics.trackShareLinkCreated(); }
  };
  const revokeShareLink = async () => {
    if (!shareLink) return;
    setShareLink(null);
    await db.deleteShareLink(shareLink.id);
    analytics.trackShareLinkRevoked();
  };
  const setLanguage = async (lang: AppLanguage) => {
    setLanguageState(lang);
    if (user) await db.updateProfile(user.id, { language: lang });
  };
  // ── Posts ────────────────────────────────────────────────────────────────
  const addPost = async (post: Omit<Post, 'id'>) => {
    if (!user) return;
    const created = await db.insertPost(user.id, post);
    if (created) {
      setPosts(prev => [...prev, created]);
      analytics.trackPostCreated(post.theme, post.type, post.status);
    }
  };
  const handleUpdatePost = async (id: string, patch: Partial<Post>) => {
    const existing = posts.find(p => p.id === id);
    setPosts(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
    await db.updatePost(id, patch);
    if (patch.status && existing && patch.status !== existing.status) {
      analytics.trackPostStatusChanged(existing.status, patch.status);
    } else {
      analytics.trackPostUpdated(patch as Record<string, unknown>);
    }
  };
  const handleDeletePost = async (id: string) => {
    setPosts(prev => prev.filter(p => p.id !== id));
    setScripts(prev => prev.filter(s => s.postId !== id));
    await db.deletePost(id);
    analytics.trackPostDeleted();
  };

  // ── Scripts ──────────────────────────────────────────────────────────────
  const saveScript = async (scriptData: Omit<Script, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!user) return;
    const saved = await db.upsertScript(user.id, scriptData);
    if (!saved) return;
    setScripts(prev => {
      const exists = prev.find(s => s.postId === scriptData.postId);
      return exists ? prev.map(s => s.postId === scriptData.postId ? saved : s) : [...prev, saved];
    });
    setPosts(prev => prev.map(p => p.id === scriptData.postId ? { ...p, status: 'DRAFT' as const, scriptId: saved.id } : p));
    await db.updatePost(scriptData.postId, { status: 'DRAFT', scriptId: saved.id });
    const wordCount = [scriptData.hook, scriptData.body, scriptData.cta].join(' ').trim().split(/\s+/).filter(Boolean).length;
    analytics.trackScriptSaved(wordCount);
  };

  // ── Matrix Ideas ─────────────────────────────────────────────────────────
  const addIdea = async (idea: Omit<MatrixIdea, 'id'>) => {
    if (!user) return;
    const created = await db.insertMatrixIdea(user.id, idea);
    if (created) {
      setMatrixIdeas(prev => [...prev, created]);
      analytics.trackIdeaAdded(idea.theme, idea.type);
    }
  };
  const handleUpdateIdea = async (id: string, patch: Partial<MatrixIdea>) => {
    const existing = matrixIdeas.find(i => i.id === id);
    setMatrixIdeas(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
    await db.updateMatrixIdea(id, patch);
    if (patch.done === true && existing && !existing.done) {
      analytics.trackIdeaCompleted(existing.theme, existing.type);
    }
  };
  const handleDeleteIdea = async (id: string) => {
    setMatrixIdeas(prev => prev.filter(i => i.id !== id));
    await db.deleteMatrixIdea(id);
    analytics.trackIdeaDeleted();
  };

  // ── ROI ──────────────────────────────────────────────────────────────────
  const addRoiCampaign = async (c: Omit<RoiCampaign, 'id' | 'createdAt'>) => {
    if (!user) return;
    const created = await db.insertRoiCampaign(user.id, c);
    if (created) {
      setRoiCampaigns(prev => [created, ...prev]);
      analytics.trackRoiCampaignCreated(c.platform);
    }
  };
  const updateRoiCampaign = async (id: string, patch: Partial<Pick<RoiCampaign, 'status' | 'targetCostPerFollower' | 'platform'>>) => {
    const existing = roiCampaigns.find(c => c.id === id);
    setRoiCampaigns(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
    await db.updateRoiCampaign(id, patch);
    if (patch.status && existing && patch.status !== existing.status) {
      analytics.trackRoiCampaignStatusChanged(existing.status, patch.status, existing.platform);
    }
  };
  const deleteRoiCampaign = async (id: string) => {
    const existing = roiCampaigns.find(c => c.id === id);
    setRoiCampaigns(prev => prev.filter(c => c.id !== id));
    setRoiEntries(prev => prev.filter(e => e.campaignId !== id));
    await db.deleteRoiCampaign(id);
    analytics.trackRoiCampaignDeleted(existing?.platform ?? 'unknown');
  };
  const addRoiEntry = async (e: Omit<RoiEntry, 'id'>) => {
    if (!user) return;
    const created = await db.insertRoiEntry(user.id, e);
    if (created) {
      setRoiEntries(prev => [...prev, created]);
      analytics.trackRoiEntryAdded(e.spend, e.followersGained);
    }
  };
  const updateRoiEntry = async (id: string, patch: Partial<Omit<RoiEntry, 'id' | 'campaignId'>>) => {
    setRoiEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
    await db.updateRoiEntry(id, patch);
    analytics.trackRoiEntryUpdated();
  };
  const deleteRoiEntry = async (id: string) => {
    setRoiEntries(prev => prev.filter(e => e.id !== id));
    await db.deleteRoiEntry(id);
    analytics.trackRoiEntryDeleted();
  };

  // ── Lab ──────────────────────────────────────────────────────────────────
  const openLab = (postId: string) => {
    setScriptLabPostId(postId);
    setActiveTab('lab');
    setShowSettings(false);
    setMobileOpen(false);
    const post = posts.find(p => p.id === postId);
    const hasScript = scripts.some(s => s.postId === postId);
    if (post) analytics.trackScriptLabOpened(post.theme, post.type, hasScript);
  };
  const closeLab = () => setScriptLabPostId(null);
  const activePost = scriptLabPostId ? posts.find(p => p.id === scriptLabPostId) ?? null : null;
  const activeScript = activePost ? scripts.find(s => s.postId === activePost.id) : undefined;

  const appState: AppState = {
    brandIdentity, themes, contentTypes, posts, scripts, matrixIdeas,
    roiCampaigns, roiEntries, aiEnabled, aiAgentEnabled, language, activeTab,
    scriptLabPostId, chatMessages,
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const userInitial = (user?.email ?? 'U')[0].toUpperCase();

  if (shareToken) return <SharedView token={shareToken} />;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
      </div>
    );
  }
  if (!session) {
    if (showAuth) return <AuthPage onBack={() => setShowAuth(false)} />;
    return <LandingPage onGetStarted={() => setShowAuth(true)} onSignIn={() => setShowAuth(true)} />;
  }

  // ── Sidebar shared content ────────────────────────────────────────────────
  const sidebarContent = (
    <>
      {/* Logo */}
      <div className={`flex items-center h-16 px-4 shrink-0 ${collapsed ? 'justify-center' : 'gap-3'}`}>
        <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm shadow-indigo-200">
          <FlaskConical className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 leading-none">Content Pilot</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Creator workspace</p>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="mx-3 border-t border-slate-100" />

      {/* Nav items */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ tab, label, icon }) => {
          const active = activeTab === tab && !showSettings;
          return (
            <button
              key={tab}
              onClick={() => navigate(tab)}
              title={collapsed ? label : undefined}
              className={`w-full flex items-center gap-3 rounded-xl transition-all duration-150 group
                ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'}
                ${active
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
            >
              <span className={`shrink-0 transition-transform duration-150 ${active ? '' : 'group-hover:scale-110'}`}>
                {icon}
              </span>
              {!collapsed && (
                <span className="text-sm font-medium leading-none">{label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="mx-3 border-t border-slate-100" />

      {/* Bottom section */}
      <div className="px-2 py-3 space-y-0.5 shrink-0">
        {/* Settings */}
        <button
          onClick={() => { setShowSettings(s => !s); setMobileOpen(false); }}
          title={collapsed ? 'Settings' : undefined}
          className={`w-full flex items-center gap-3 rounded-xl transition-all duration-150
            ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'}
            ${showSettings
              ? 'bg-slate-900 text-white'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
        >
          <SettingsIcon className="w-[18px] h-[18px] shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Settings</span>}
        </button>

        {/* User + sign out */}
        <div className={`flex items-center rounded-xl px-2 py-2 gap-2.5 ${collapsed ? 'justify-center' : ''}`}>
          {/* Avatar */}
          <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
            {userInitial}
          </div>
          {!collapsed && (
            <>
              <p className="text-xs text-slate-500 truncate flex-1 min-w-0">{user?.email}</p>
              <button
                onClick={signOut}
                title="Sign out"
                className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {collapsed && (
            <button onClick={signOut} title="Sign out" className="hidden" />
          )}
        </div>

        {/* Sign out when collapsed */}
        {collapsed && (
          <button
            onClick={signOut}
            title="Sign out"
            className="w-full flex justify-center py-2.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
          >
            <LogOut className="w-[18px] h-[18px]" />
          </button>
        )}

        {/* Loading indicator */}
        {dataLoading && (
          <div className={`flex py-1 ${collapsed ? 'justify-center' : 'px-3'}`}>
            <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">

      {/* ── Mobile overlay backdrop ─────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar (desktop: permanent | mobile: slide-in drawer) ──────── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-slate-200
          transition-[width,transform] duration-200 ease-in-out
          md:relative md:translate-x-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${collapsed ? 'w-[64px]' : 'w-[220px]'}
        `}
      >
        {sidebarContent}

        {/* Collapse toggle — desktop only */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="hidden md:flex absolute -right-3 top-20 w-6 h-6 bg-white border border-slate-200 rounded-full items-center justify-center text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-colors shadow-sm z-10"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* ── Main area ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">

        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-200 flex items-center h-14 px-4 gap-3 shrink-0">
          <button
            onClick={() => setMobileOpen(o => !o)}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-600 rounded-lg flex items-center justify-center">
              <FlaskConical className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-sm">Content Pilot</span>
          </div>
          {dataLoading && <Loader2 className="w-4 h-4 text-slate-400 animate-spin ml-auto" />}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {showSettings ? (
            <Settings
              aiEnabled={aiEnabled}
              onAiEnabledChange={setAiEnabled}
              aiAgentEnabled={aiAgentEnabled}
              onAiAgentEnabledChange={setAiAgentEnabled}
              language={language}
              onLanguageChange={setLanguage}
              userEmail={user?.email ?? ''}
              shareLink={shareLink}
              onGenerateShareLink={generateShareLink}
              onRevokeShareLink={revokeShareLink}
            />
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <Dashboard state={appState} onNavigate={navigate} />
              )}
              {activeTab === 'identity' && (
                <BrandIdentity
                  identity={brandIdentity}
                  onChange={updateBrandIdentity}
                  onAddTheme={addTheme}
                  onAddContentType={addContentType}
                  language={language}
                />
              )}
              {activeTab === 'matrix' && (
                <StrategyMatrix
                  state={appState}
                  onAddTheme={addTheme} onRemoveTheme={removeTheme}
                  onAddContentType={addContentType} onRemoveContentType={removeContentType}
                  onPlanPost={addPost} onAddIdea={addIdea}
                  onUpdateIdea={handleUpdateIdea} onDeleteIdea={handleDeleteIdea}
                  onOpenLab={(postId) => {
                    // Open lab overlay without navigating away from matrix
                    setScriptLabPostId(postId);
                    setShowSettings(false);
                    const post = posts.find(p => p.id === postId);
                    const hasScript = scripts.some(s => s.postId === postId);
                    if (post) analytics.trackScriptLabOpened(post.theme, post.type, hasScript);
                  }}
                  onAddAndOpenLab={async (post) => {
                    if (!user) return;
                    const created = await db.insertPost(user.id, post);
                    if (created) {
                      setPosts(prev => [...prev, created]);
                      setScriptLabPostId(created.id);
                      analytics.trackPostCreated(post.theme, post.type, post.status);
                      analytics.trackScriptLabOpened(post.theme, post.type, false);
                    }
                  }}
                />
              )}
              {activeTab === 'calendar' && (
                <ContentCalendar
                  posts={posts} themes={themes} contentTypes={contentTypes}
                  onAddPost={addPost} onUpdatePost={handleUpdatePost}
                  onDeletePost={handleDeletePost} onOpenLab={openLab}
                />
              )}
              {activeTab === 'lab' && !scriptLabPostId && (
                <LabPicker posts={posts} onSelect={openLab} onNavigate={navigate} />
              )}
              {activeTab === 'roi' && (
                <RoiTracker
                  posts={posts}
                  campaigns={roiCampaigns}
                  entries={roiEntries}
                  onAddCampaign={addRoiCampaign}
                  onUpdateCampaign={updateRoiCampaign}
                  onDeleteCampaign={deleteRoiCampaign}
                  onAddEntry={addRoiEntry}
                  onUpdateEntry={updateRoiEntry}
                  onDeleteEntry={deleteRoiEntry}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Script Lab modal (global) */}
      {scriptLabPostId && (
        <ScriptLab
          post={activePost}
          existingScript={activeScript}
          brandIdentity={brandIdentity}
          language={language}
          posts={posts}
          onClose={closeLab}
          onSave={saveScript}
          onSchedule={async (postId, postDate, filmingDate) => {
            await handleUpdatePost(postId, { date: postDate, filmingDate, status: 'SCHEDULED' });
          }}
        />
      )}

      {/* Floating Chat Agent */}
      {aiAgentEnabled && (
        <ChatAgent
          isOpen={chatAgentOpen}
          onToggle={() => setChatAgentOpen(o => !o)}
          messages={chatMessages}
          brandIdentity={brandIdentity}
          themes={themes}
          contentTypes={contentTypes}
          posts={posts}
          matrixIdeas={matrixIdeas}
          language={language}
          onSendMessage={handleSendMessage}
          onClearHistory={handleClearHistory}
        />
      )}
    </div>
  );
}

/* ─── Agent System Prompt Builder ───────────────────────────────────────── */

const AGENT_LANGUAGE_NAMES: Record<AppLanguage, string> = { en: 'English', es: 'Spanish', fr: 'French' };

function buildAgentSystem({
  brandIdentity,
  themes,
  contentTypes,
  language,
  recentPosts,
  recentIdeas,
}: {
  brandIdentity: BrandIdentityType;
  themes: string[];
  contentTypes: string[];
  language: AppLanguage;
  recentPosts: string;
  recentIdeas: string;
}): string {
  return `You are Content Agent, a strategic AI assistant embedded in ContentOS — a short-form video content workspace.
Your job is to help content creators make better strategic decisions about their TikTok, Reels, and Shorts content.

LANGUAGE: Respond in ${AGENT_LANGUAGE_NAMES[language]}.

BRAND CONTEXT:
- ICP (Ideal Customer Profile): ${brandIdentity.icp || 'Not defined'}
- Positioning: ${brandIdentity.positioning || 'Not defined'}
- Voice & Tone: ${brandIdentity.tone || 'Not defined'}

AUDIENCE EMPATHY MAP:
- Pains: ${brandIdentity.empathyMap?.pains || 'Not defined'}
- Gains: ${brandIdentity.empathyMap?.gains || 'Not defined'}
- Fears: ${brandIdentity.empathyMap?.fears || 'Not defined'}
- Hopes: ${brandIdentity.empathyMap?.hopes || 'Not defined'}

CONTENT THEMES: ${themes.join(', ') || 'None set'}
CONTENT FORMATS: ${contentTypes.join(', ') || 'None set'}

RECENT POSTS (last 10):
${recentPosts || 'No posts yet'}

RECENT IDEAS (last 10 from Strategy Matrix):
${recentIdeas || 'No ideas yet'}

INSTRUCTIONS:
- When reasoning through a complex question, wrap your thinking in <reasoning>...</reasoning> tags BEFORE your answer.
- Your answer (outside the reasoning tags) should be direct, actionable, and concise.
- Tailor all advice to the brand context above — reference it specifically, never give generic advice.
- You can suggest specific video titles, angles, hooks, or strategy decisions.
- Today's date is ${new Date().toISOString().split('T')[0]}.`;
}

/* ─── Lab Picker ─────────────────────────────────────────────────────────── */

function LabPicker({ posts, onSelect, onNavigate }: {
  posts: Post[];
  onSelect: (id: string) => void;
  onNavigate: (tab: NavTab) => void;
}) {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Script Lab</h1>
        <p className="text-slate-500 text-sm mt-1">Select a post to open the AI scriptwriting workspace.</p>
      </div>
      {posts.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center space-y-3">
          <FlaskConical className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-slate-500 text-sm font-medium">No posts in your calendar yet.</p>
          <button
            onClick={() => onNavigate('calendar')}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium underline"
          >
            Go to Calendar to add posts
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map(post => (
            <button key={post.id} onClick={() => onSelect(post.id)}
              className="w-full text-left bg-white rounded-xl border border-slate-200 px-5 py-4 hover:border-indigo-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3">
                <FlaskConical className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{post.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{post.theme} · {post.type} · {post.date}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${post.status === 'IDEA' ? 'bg-slate-100 text-slate-600' :
                  post.status === 'DRAFT' ? 'bg-indigo-100 text-indigo-700' :
                    'bg-emerald-100 text-emerald-700'
                  }`}>{post.status}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
