import { supabase } from './supabase';
import type { BrandIdentity, Post, Script, MatrixIdea, ChatMessage, ShareLink, CompetitorReport, CompetitorPost, CompetitorReportData, AgentAction, AgentActionType, AbTest, AbTestResult, AbVariant, AbTestVariable, AbTestStatus } from '../types';

// ── Profile ───────────────────────────────────────────────────────────────

export interface ProfileRow {
  id: string;
  brand_identity: BrandIdentity;
  themes: string[];
  content_types: string[];
  ai_enabled: boolean;
  ai_agent_enabled: boolean;
  ab_testing_enabled: boolean;
  gemini_api_key: string | null;
  apify_api_key: string | null;
  language: string | null;
}

export async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) { console.error('fetchProfile', error); return null; }
  return data as ProfileRow;
}

export async function updateProfile(userId: string, patch: Partial<Omit<ProfileRow, 'id'>>) {
  const { error } = await supabase
    .from('profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) console.error('updateProfile', error);
}

// ── Posts ─────────────────────────────────────────────────────────────────

type PostRow = { id: string; user_id: string; title: string; date: string; filming_date: string | null; status: string; theme: string; type: string; script_id: string | null; created_at: string };

export async function fetchPosts(userId: string): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) { console.error('fetchPosts', error); return []; }
  return (data as PostRow[]).map(row => ({
    id: row.id,
    title: row.title,
    date: row.date,
    filmingDate: row.filming_date ?? undefined,
    status: row.status as Post['status'],
    theme: row.theme,
    type: row.type,
    scriptId: row.script_id ?? undefined,
  }));
}

export async function insertPost(userId: string, post: Omit<Post, 'id'>): Promise<Post | null> {
  const { data, error } = await supabase
    .from('posts')
    .insert({
      user_id: userId,
      title: post.title,
      date: post.date,
      filming_date: post.filmingDate ?? null,
      status: post.status,
      theme: post.theme,
      type: post.type,
    })
    .select()
    .single();
  if (error) { console.error('insertPost', error); return null; }
  const row = data as PostRow;
  return { id: row.id, title: row.title, date: row.date, filmingDate: row.filming_date ?? undefined, status: row.status as Post['status'], theme: row.theme, type: row.type };
}

export async function updatePost(id: string, patch: Partial<Post>) {
  const dbPatch: Record<string, unknown> = {};
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.date !== undefined) dbPatch.date = patch.date;
  if ('filmingDate' in patch) dbPatch.filming_date = patch.filmingDate ?? null;
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.theme !== undefined) dbPatch.theme = patch.theme;
  if (patch.type !== undefined) dbPatch.type = patch.type;
  if (patch.scriptId !== undefined) dbPatch.script_id = patch.scriptId;
  const { error } = await supabase.from('posts').update(dbPatch).eq('id', id);
  if (error) console.error('updatePost', error);
}

export async function deletePost(id: string) {
  const { error } = await supabase.from('posts').delete().eq('id', id);
  if (error) console.error('deletePost', error);
}

// ── Scripts ───────────────────────────────────────────────────────────────

type ScriptRow = { id: string; user_id: string; post_id: string; hook: string; body: string; cta: string; created_at: string; updated_at: string };

export async function fetchScripts(userId: string): Promise<Script[]> {
  const { data, error } = await supabase
    .from('scripts')
    .select('*')
    .eq('user_id', userId);
  if (error) { console.error('fetchScripts', error); return []; }
  return (data as ScriptRow[]).map(row => ({
    id: row.id,
    postId: row.post_id,
    hook: row.hook,
    body: row.body,
    cta: row.cta,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function upsertScript(
  userId: string,
  scriptData: Omit<Script, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Script | null> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('scripts')
    .upsert({
      user_id: userId,
      post_id: scriptData.postId,
      hook: scriptData.hook,
      body: scriptData.body,
      cta: scriptData.cta,
      updated_at: now,
    }, { onConflict: 'post_id' })
    .select()
    .single();
  if (error) { console.error('upsertScript', error); return null; }
  const row = data as ScriptRow;
  return { id: row.id, postId: row.post_id, hook: row.hook, body: row.body, cta: row.cta, createdAt: row.created_at, updatedAt: row.updated_at };
}

// ── Matrix Ideas ──────────────────────────────────────────────────────────

type IdeaRow = { id: string; user_id: string; theme: string; type: string; title: string; done: boolean; created_at: string };

export async function fetchMatrixIdeas(userId: string): Promise<MatrixIdea[]> {
  const { data, error } = await supabase
    .from('matrix_ideas')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) { console.error('fetchMatrixIdeas', error); return []; }
  return (data as IdeaRow[]).map(row => ({
    id: row.id,
    theme: row.theme,
    type: row.type,
    title: row.title,
    done: row.done,
  }));
}

export async function insertMatrixIdea(userId: string, idea: Omit<MatrixIdea, 'id'>): Promise<MatrixIdea | null> {
  const { data, error } = await supabase
    .from('matrix_ideas')
    .insert({ user_id: userId, theme: idea.theme, type: idea.type, title: idea.title, done: idea.done })
    .select()
    .single();
  if (error) { console.error('insertMatrixIdea', error); return null; }
  const row = data as IdeaRow;
  return { id: row.id, theme: row.theme, type: row.type, title: row.title, done: row.done };
}

export async function updateMatrixIdea(id: string, patch: Partial<MatrixIdea>) {
  const { error } = await supabase.from('matrix_ideas').update(patch).eq('id', id);
  if (error) console.error('updateMatrixIdea', error);
}

export async function deleteMatrixIdea(id: string) {
  const { error } = await supabase.from('matrix_ideas').delete().eq('id', id);
  if (error) console.error('deleteMatrixIdea', error);
}

// ── ROI Campaigns ─────────────────────────────────────────────────────────

import type { RoiCampaign, RoiEntry, RoiPlatform, RoiCampaignStatus } from '../types';

type CampaignRow = { id: string; user_id: string; post_id: string | null; post_title: string; target_cost_per_follower: number; platform: string; status: string; created_at: string };
type EntryRow = { id: string; user_id: string; campaign_id: string; date: string; spend: number; followers_gained: number; notes: string; created_at: string };

function rowToCampaign(row: CampaignRow): RoiCampaign {
  return { id: row.id, postId: row.post_id, postTitle: row.post_title, targetCostPerFollower: Number(row.target_cost_per_follower), platform: row.platform as RoiPlatform, status: row.status as RoiCampaignStatus, createdAt: row.created_at };
}

function rowToEntry(row: EntryRow): RoiEntry {
  return { id: row.id, campaignId: row.campaign_id, date: row.date, spend: Number(row.spend), followersGained: row.followers_gained, notes: row.notes };
}

export async function fetchRoiCampaigns(userId: string): Promise<RoiCampaign[]> {
  const { data, error } = await supabase.from('roi_campaigns').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) { console.error('fetchRoiCampaigns', error); return []; }
  return (data as CampaignRow[]).map(rowToCampaign);
}

export async function insertRoiCampaign(userId: string, c: Omit<RoiCampaign, 'id' | 'createdAt'>): Promise<RoiCampaign | null> {
  const { data, error } = await supabase.from('roi_campaigns').insert({ user_id: userId, post_id: c.postId, post_title: c.postTitle, target_cost_per_follower: c.targetCostPerFollower, platform: c.platform, status: c.status }).select().single();
  if (error) { console.error('insertRoiCampaign', error); return null; }
  return rowToCampaign(data as CampaignRow);
}

export async function updateRoiCampaign(id: string, patch: Partial<Pick<RoiCampaign, 'status' | 'targetCostPerFollower' | 'platform'>>) {
  const dbPatch: Record<string, unknown> = {};
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.targetCostPerFollower !== undefined) dbPatch.target_cost_per_follower = patch.targetCostPerFollower;
  if (patch.platform !== undefined) dbPatch.platform = patch.platform;
  const { error } = await supabase.from('roi_campaigns').update(dbPatch).eq('id', id);
  if (error) console.error('updateRoiCampaign', error);
}

export async function deleteRoiCampaign(id: string) {
  const { error } = await supabase.from('roi_campaigns').delete().eq('id', id);
  if (error) console.error('deleteRoiCampaign', error);
}

// ── ROI Entries ───────────────────────────────────────────────────────────

export async function fetchRoiEntries(userId: string): Promise<RoiEntry[]> {
  const { data, error } = await supabase.from('roi_entries').select('*').eq('user_id', userId).order('date', { ascending: true });
  if (error) { console.error('fetchRoiEntries', error); return []; }
  return (data as EntryRow[]).map(rowToEntry);
}

export async function insertRoiEntry(userId: string, e: Omit<RoiEntry, 'id'>): Promise<RoiEntry | null> {
  const { data, error } = await supabase.from('roi_entries').insert({ user_id: userId, campaign_id: e.campaignId, date: e.date, spend: e.spend, followers_gained: e.followersGained, notes: e.notes }).select().single();
  if (error) { console.error('insertRoiEntry', error); return null; }
  return rowToEntry(data as EntryRow);
}

export async function updateRoiEntry(id: string, e: Partial<Omit<RoiEntry, 'id' | 'campaignId'>>) {
  const dbPatch: Record<string, unknown> = {};
  if (e.date !== undefined) dbPatch.date = e.date;
  if (e.spend !== undefined) dbPatch.spend = e.spend;
  if (e.followersGained !== undefined) dbPatch.followers_gained = e.followersGained;
  if (e.notes !== undefined) dbPatch.notes = e.notes;
  const { error } = await supabase.from('roi_entries').update(dbPatch).eq('id', id);
  if (error) console.error('updateRoiEntry', error);
}

export async function deleteRoiEntry(id: string) {
  const { error } = await supabase.from('roi_entries').delete().eq('id', id);
  if (error) console.error('deleteRoiEntry', error);
}

// ── Chat Messages ──────────────────────────────────────────────────────────

type ChatMessageRow = {
  id: string;
  user_id: string;
  role: string;
  content: string;
  created_at: string;
};

function rowToChatMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    role: row.role as ChatMessage['role'],
    content: row.content,
    createdAt: row.created_at,
  };
}

export async function fetchChatMessages(userId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) { console.error('fetchChatMessages', error); return []; }
  return (data as ChatMessageRow[]).map(rowToChatMessage);
}

export async function insertChatMessage(
  userId: string,
  role: ChatMessage['role'],
  content: string
): Promise<ChatMessage | null> {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ user_id: userId, role, content })
    .select()
    .single();
  if (error) { console.error('insertChatMessage', error); return null; }
  return rowToChatMessage(data as ChatMessageRow);
}

export async function clearChatMessages(userId: string): Promise<void> {
  const { error } = await supabase
    .from('chat_messages')
    .delete()
    .eq('user_id', userId);
  if (error) console.error('clearChatMessages', error);
}

// ── Share Links ────────────────────────────────────────────────────────────

type ShareLinkRow = { id: string; user_id: string; token: string; created_at: string };

export async function fetchShareLink(userId: string): Promise<ShareLink | null> {
  const { data } = await supabase.from('share_links').select('*').eq('user_id', userId).maybeSingle();
  if (!data) return null;
  const row = data as ShareLinkRow;
  return { id: row.id, token: row.token, createdAt: row.created_at };
}

export async function insertShareLink(userId: string): Promise<ShareLink | null> {
  const { data, error } = await supabase.from('share_links').insert({ user_id: userId }).select().single();
  if (error) { console.error('insertShareLink', error); return null; }
  const row = data as ShareLinkRow;
  return { id: row.id, token: row.token, createdAt: row.created_at };
}

export async function deleteShareLink(id: string): Promise<void> {
  const { error } = await supabase.from('share_links').delete().eq('id', id);
  if (error) console.error('deleteShareLink', error);
}

// ── Bulk helpers ──────────────────────────────────────────────────────────

export async function bulkInsertPosts(userId: string, posts: Omit<Post, 'id'>[]): Promise<Post[]> {
  if (!posts.length) return [];
  const { data, error } = await supabase
    .from('posts')
    .insert(posts.map(p => ({
      user_id: userId,
      title: p.title,
      date: p.date,
      filming_date: p.filmingDate ?? null,
      status: p.status,
      theme: p.theme,
      type: p.type,
    })))
    .select();
  if (error) { console.error('bulkInsertPosts', error); return []; }
  return (data as PostRow[]).map(row => ({
    id: row.id,
    title: row.title,
    date: row.date,
    filmingDate: row.filming_date ?? undefined,
    status: row.status as Post['status'],
    theme: row.theme,
    type: row.type,
  }));
}

export async function bulkInsertMatrixIdeas(userId: string, ideas: Omit<MatrixIdea, 'id'>[]): Promise<MatrixIdea[]> {
  if (!ideas.length) return [];
  const { data, error } = await supabase
    .from('matrix_ideas')
    .insert(ideas.map(i => ({ user_id: userId, theme: i.theme, type: i.type, title: i.title, done: i.done })))
    .select();
  if (error) { console.error('bulkInsertMatrixIdeas', error); return []; }
  return (data as IdeaRow[]).map(row => ({ id: row.id, theme: row.theme, type: row.type, title: row.title, done: row.done }));
}

// ── Agent Actions ──────────────────────────────────────────────────────────

type AgentActionRow = {
  id: string;
  user_id: string;
  action_type: string;
  item_id: string;
  item_title: string;
  item_meta: string;
  chat_context: string;
  created_at: string;
};

function rowToAgentAction(row: AgentActionRow): AgentAction {
  return {
    id: row.id,
    actionType: row.action_type as AgentActionType,
    itemId: row.item_id,
    itemTitle: row.item_title,
    itemMeta: row.item_meta,
    chatContext: row.chat_context,
    createdAt: row.created_at,
  };
}

export async function fetchAgentActions(userId: string): Promise<AgentAction[]> {
  const { data, error } = await supabase
    .from('agent_actions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) { console.error('fetchAgentActions', error); return []; }
  return (data as AgentActionRow[]).map(rowToAgentAction);
}

export async function bulkInsertAgentActions(
  userId: string,
  actions: Omit<AgentAction, 'id' | 'createdAt'>[],
): Promise<AgentAction[]> {
  if (!actions.length) return [];
  const { data, error } = await supabase
    .from('agent_actions')
    .insert(actions.map(a => ({
      user_id: userId,
      action_type: a.actionType,
      item_id: a.itemId,
      item_title: a.itemTitle,
      item_meta: a.itemMeta,
      chat_context: a.chatContext,
    })))
    .select();
  if (error) { console.error('bulkInsertAgentActions', error); return []; }
  return (data as AgentActionRow[]).map(rowToAgentAction);
}

export async function deleteAgentAction(id: string): Promise<void> {
  const { error } = await supabase.from('agent_actions').delete().eq('id', id);
  if (error) console.error('deleteAgentAction', error);
}

export async function deleteAgentActionsByItemId(itemId: string): Promise<void> {
  const { error } = await supabase.from('agent_actions').delete().eq('item_id', itemId);
  if (error) console.error('deleteAgentActionsByItemId', error);
}

// ── Competitor Reports ─────────────────────────────────────────────────────

type CompetitorReportRow = {
  id: string;
  user_id: string;
  competitor_handle: string;
  posts_analyzed: number;
  top_posts: unknown;
  report: unknown;
  created_at: string;
};

function rowToCompetitorReport(row: CompetitorReportRow): CompetitorReport {
  return {
    id: row.id,
    competitorHandle: row.competitor_handle,
    postsAnalyzed: row.posts_analyzed,
    topPosts: row.top_posts as CompetitorPost[],
    report: row.report as CompetitorReportData,
    createdAt: row.created_at,
  };
}

export async function fetchCompetitorReports(userId: string): Promise<CompetitorReport[]> {
  const { data, error } = await supabase
    .from('competitor_reports')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchCompetitorReports', error); return []; }
  return (data as CompetitorReportRow[]).map(rowToCompetitorReport);
}

export async function insertCompetitorReport(
  userId: string,
  report: Omit<CompetitorReport, 'id' | 'createdAt'>
): Promise<CompetitorReport | null> {
  const { data, error } = await supabase
    .from('competitor_reports')
    .insert({
      user_id: userId,
      competitor_handle: report.competitorHandle,
      posts_analyzed: report.postsAnalyzed,
      top_posts: report.topPosts,
      report: report.report,
    })
    .select()
    .single();
  if (error) { console.error('insertCompetitorReport', error); return null; }
  return rowToCompetitorReport(data as CompetitorReportRow);
}

export async function deleteCompetitorReport(id: string): Promise<void> {
  const { error } = await supabase.from('competitor_reports').delete().eq('id', id);
  if (error) console.error('deleteCompetitorReport', error);
}

// ── Shared Data (viewer, no auth required) ─────────────────────────────────

// ── A/B Tests ──────────────────────────────────────────────────────────────

type AbTestRow = {
  id: string; user_id: string; name: string; hypothesis: string; variable: string;
  variant_a: unknown; variant_b: unknown; post_id: string | null;
  status: string; winner: string | null; winner_reason: string | null; created_at: string;
};

type AbTestResultRow = {
  id: string; user_id: string; test_id: string; variant: string; posted_at: string;
  views: number; likes: number; comments: number; shares: number; saves: number;
  profile_visits: number; watch_time_seconds: number; follows: number; notes: string; created_at: string;
};

function rowToAbTest(row: AbTestRow): AbTest {
  return {
    id: row.id,
    name: row.name,
    hypothesis: row.hypothesis,
    variable: row.variable as AbTestVariable,
    variantA: row.variant_a as AbVariant,
    variantB: row.variant_b as AbVariant,
    postId: row.post_id,
    status: row.status as AbTestStatus,
    winner: row.winner as 'A' | 'B' | null,
    winnerReason: row.winner_reason,
    createdAt: row.created_at,
  };
}

function rowToAbTestResult(row: AbTestResultRow): AbTestResult {
  return {
    id: row.id,
    testId: row.test_id,
    variant: row.variant as 'A' | 'B',
    postedAt: row.posted_at,
    views: row.views,
    likes: row.likes,
    comments: row.comments,
    shares: row.shares,
    saves: row.saves,
    profileVisits: row.profile_visits,
    watchTimeSeconds: row.watch_time_seconds,
    follows: row.follows,
    notes: row.notes,
  };
}

export async function fetchAbTests(userId: string): Promise<AbTest[]> {
  const { data, error } = await supabase.from('ab_tests').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) { console.error('fetchAbTests', error); return []; }
  return (data as AbTestRow[]).map(rowToAbTest);
}

export async function insertAbTest(userId: string, t: Omit<AbTest, 'id' | 'createdAt'>): Promise<AbTest | null> {
  const { data, error } = await supabase.from('ab_tests').insert({
    user_id: userId, name: t.name, hypothesis: t.hypothesis, variable: t.variable,
    variant_a: t.variantA, variant_b: t.variantB, post_id: t.postId,
    status: t.status, winner: t.winner, winner_reason: t.winnerReason,
  }).select().single();
  if (error) { console.error('insertAbTest', error); return null; }
  return rowToAbTest(data as AbTestRow);
}

export async function updateAbTest(id: string, patch: Partial<Omit<AbTest, 'id' | 'createdAt'>>) {
  const dbPatch: Record<string, unknown> = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.hypothesis !== undefined) dbPatch.hypothesis = patch.hypothesis;
  if (patch.variable !== undefined) dbPatch.variable = patch.variable;
  if (patch.variantA !== undefined) dbPatch.variant_a = patch.variantA;
  if (patch.variantB !== undefined) dbPatch.variant_b = patch.variantB;
  if (patch.postId !== undefined) dbPatch.post_id = patch.postId;
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if ('winner' in patch) dbPatch.winner = patch.winner;
  if ('winnerReason' in patch) dbPatch.winner_reason = patch.winnerReason;
  const { error } = await supabase.from('ab_tests').update(dbPatch).eq('id', id);
  if (error) console.error('updateAbTest', error);
}

export async function deleteAbTest(id: string) {
  const { error } = await supabase.from('ab_tests').delete().eq('id', id);
  if (error) console.error('deleteAbTest', error);
}

export async function fetchAbTestResults(userId: string): Promise<AbTestResult[]> {
  const { data, error } = await supabase.from('ab_test_results').select('*').eq('user_id', userId).order('posted_at', { ascending: true });
  if (error) { console.error('fetchAbTestResults', error); return []; }
  return (data as AbTestResultRow[]).map(rowToAbTestResult);
}

export async function insertAbTestResult(userId: string, r: Omit<AbTestResult, 'id'>): Promise<AbTestResult | null> {
  const { data, error } = await supabase.from('ab_test_results').insert({
    user_id: userId, test_id: r.testId, variant: r.variant, posted_at: r.postedAt,
    views: r.views, likes: r.likes, comments: r.comments, shares: r.shares,
    saves: r.saves, profile_visits: r.profileVisits, watch_time_seconds: r.watchTimeSeconds,
    follows: r.follows, notes: r.notes,
  }).select().single();
  if (error) { console.error('insertAbTestResult', error); return null; }
  return rowToAbTestResult(data as AbTestResultRow);
}

export async function updateAbTestResult(id: string, patch: Partial<Omit<AbTestResult, 'id' | 'testId' | 'variant'>>) {
  const dbPatch: Record<string, unknown> = {};
  if (patch.postedAt !== undefined) dbPatch.posted_at = patch.postedAt;
  if (patch.views !== undefined) dbPatch.views = patch.views;
  if (patch.likes !== undefined) dbPatch.likes = patch.likes;
  if (patch.comments !== undefined) dbPatch.comments = patch.comments;
  if (patch.shares !== undefined) dbPatch.shares = patch.shares;
  if (patch.saves !== undefined) dbPatch.saves = patch.saves;
  if (patch.profileVisits !== undefined) dbPatch.profile_visits = patch.profileVisits;
  if (patch.watchTimeSeconds !== undefined) dbPatch.watch_time_seconds = patch.watchTimeSeconds;
  if (patch.follows !== undefined) dbPatch.follows = patch.follows;
  if (patch.notes !== undefined) dbPatch.notes = patch.notes;
  const { error } = await supabase.from('ab_test_results').update(dbPatch).eq('id', id);
  if (error) console.error('updateAbTestResult', error);
}

export async function deleteAbTestResult(id: string) {
  const { error } = await supabase.from('ab_test_results').delete().eq('id', id);
  if (error) console.error('deleteAbTestResult', error);
}

// ── Shared Data (viewer, no auth required) ─────────────────────────────────

export async function fetchSharedPosts(token: string): Promise<Post[]> {
  const { data, error } = await supabase.rpc('get_shared_posts', { p_token: token });
  if (error) { console.error('fetchSharedPosts', error); return []; }
  return ((data as unknown[]) ?? []).map((row: unknown) => {
    const r = row as { id: string; title: string; date: string; filming_date: string | null; status: string; theme: string; type: string; script_id: string | null };
    return { id: r.id, title: r.title, date: r.date, filmingDate: r.filming_date ?? undefined, status: r.status as Post['status'], theme: r.theme, type: r.type, scriptId: r.script_id ?? undefined };
  });
}

export async function fetchSharedMatrix(token: string): Promise<MatrixIdea[]> {
  const { data, error } = await supabase.rpc('get_shared_matrix', { p_token: token });
  if (error) { console.error('fetchSharedMatrix', error); return []; }
  return ((data as unknown[]) ?? []).map((row: unknown) => {
    const r = row as { id: string; theme: string; type: string; title: string; done: boolean };
    return { id: r.id, theme: r.theme, type: r.type, title: r.title, done: r.done };
  });
}

export async function fetchSharedRoi(token: string): Promise<{ campaigns: RoiCampaign[]; entries: RoiEntry[] }> {
  const { data, error } = await supabase.rpc('get_shared_roi', { p_token: token });
  if (error) { console.error('fetchSharedRoi', error); return { campaigns: [], entries: [] }; }
  const d = data as { campaigns: unknown[]; entries: unknown[] };
  const campaigns = (d.campaigns ?? []).map((row: unknown) => {
    const r = row as { id: string; post_id: string | null; post_title: string; target_cost_per_follower: number; platform: string; status: string; created_at: string };
    return { id: r.id, postId: r.post_id, postTitle: r.post_title, targetCostPerFollower: Number(r.target_cost_per_follower), platform: r.platform as RoiPlatform, status: r.status as RoiCampaignStatus, createdAt: r.created_at };
  });
  const entries = (d.entries ?? []).map((row: unknown) => {
    const r = row as { id: string; campaign_id: string; date: string; spend: number; followers_gained: number; notes: string };
    return { id: r.id, campaignId: r.campaign_id, date: r.date, spend: Number(r.spend), followersGained: r.followers_gained, notes: r.notes };
  });
  return { campaigns, entries };
}
