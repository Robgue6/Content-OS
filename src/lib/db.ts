import { supabase } from './supabase';
import type { BrandIdentity, Post, Script, MatrixIdea } from '../types';

// ── Profile ───────────────────────────────────────────────────────────────

export interface ProfileRow {
  id: string;
  brand_identity: BrandIdentity;
  themes: string[];
  content_types: string[];
  ai_enabled: boolean;
  gemini_api_key: string | null;
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
