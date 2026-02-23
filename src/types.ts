export interface BrandIdentity {
  icp: string;
  empathyMap: {
    pains: string;
    gains: string;
    fears: string;
    hopes: string;
  };
  positioning: string;
  tone: string;
  verbatims?: string[];
}

export type PostStatus = 'IDEA' | 'DRAFT' | 'SCHEDULED';

export interface Post {
  id: string;
  title: string;
  date: string;
  filmingDate?: string;
  status: PostStatus;
  theme: string;
  type: string;
  scriptId?: string;
}

export interface Script {
  id: string;
  postId: string;
  hook: string;
  body: string;
  cta: string;
  createdAt: string;
  updatedAt: string;
}

export interface MatrixIdea {
  id: string;
  theme: string;
  type: string;
  title: string;
  done: boolean;
}

export type RoiCampaignStatus = 'active' | 'paused' | 'stopped';
export type RoiPlatform = 'instagram' | 'tiktok' | 'facebook' | 'other';

export interface RoiCampaign {
  id: string;
  postId: string | null;
  postTitle: string;
  targetCostPerFollower: number;
  platform: RoiPlatform;
  status: RoiCampaignStatus;
  createdAt: string;
}

export interface RoiEntry {
  id: string;
  campaignId: string;
  date: string;
  spend: number;
  followersGained: number;
  notes: string;
}

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface ShareLink {
  id: string;
  token: string;
  createdAt: string;
}

export type NavTab = 'dashboard' | 'identity' | 'matrix' | 'calendar' | 'lab' | 'roi' | 'intel' | 'hub';

export type AppLanguage = 'en' | 'es' | 'fr';

export interface AppState {
  brandIdentity: BrandIdentity;
  themes: string[];
  contentTypes: string[];
  posts: Post[];
  scripts: Script[];
  matrixIdeas: MatrixIdea[];
  roiCampaigns: RoiCampaign[];
  roiEntries: RoiEntry[];
  aiEnabled: boolean;
  aiAgentEnabled: boolean;
  language: AppLanguage;
  activeTab: NavTab;
  scriptLabPostId: string | null;
  chatMessages: ChatMessage[];
  competitorReports: CompetitorReport[];
  agentActions: AgentAction[];
}

// ── Agent Actions ──────────────────────────────────────────────────────────

export type AgentActionType = 'add_post' | 'add_matrix_idea';

export interface AgentAction {
  id: string;
  actionType: AgentActionType;
  itemId: string;
  itemTitle: string;
  itemMeta: string;      // e.g. "2026-03-01 · Mindset · Tutorial"
  chatContext: string;   // first 150 chars of the user message that triggered this
  createdAt: string;
}

// ── Competitor Intelligence ────────────────────────────────────────────────

export interface CompetitorPost {
  id: string;
  shortCode: string;
  url: string;
  caption: string;
  likesCount: number;
  commentsCount: number;
  videoViewCount: number;
  timestamp: string;
  type: string;
  engagementScore: number;
  comments: CompetitorComment[];
}

export interface CompetitorComment {
  id: string;
  text: string;
  ownerUsername: string;
  timestamp: string;
}

export interface IntelTactic {
  tactic: string;
  reasoning: string;
  evidence: string;
  icpAlignment: 'aligned' | 'neutral';
}

export interface IntelAvoidance {
  pattern: string;
  reason: string;
  icpConflict: string;
}

export interface IntelActionablePost {
  title: string;
  hook: string;
  why: string;
  theme: string;
  type: string;
  angle: string;
}

export interface CompetitorReportData {
  overallAnalysis: string;
  audienceSignals: string[];
  whatToDo: IntelTactic[];
  whatNotToDo: IntelAvoidance[];
  actionablePosts: IntelActionablePost[];
}

export interface CompetitorReport {
  id: string;
  competitorHandle: string;
  postsAnalyzed: number;
  topPosts: CompetitorPost[];
  report: CompetitorReportData;
  createdAt: string;
}
