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

export type NavTab = 'dashboard' | 'identity' | 'matrix' | 'calendar' | 'lab' | 'roi' | 'intel' | 'hub' | 'ab';

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
  abTestingEnabled: boolean;
  language: AppLanguage;
  activeTab: NavTab;
  scriptLabPostId: string | null;
  chatMessages: ChatMessage[];
  competitorReports: CompetitorReport[];
  agentActions: AgentAction[];
  abTests: AbTest[];
  abTestResults: AbTestResult[];
}

// ── A/B Testing ────────────────────────────────────────────────────────────

export type AbTestVariable = 'hook' | 'cta' | 'type' | 'theme' | 'script';
export type AbTestStatus = 'planning' | 'live' | 'completed';

export interface AbVariant {
  title: string;    // e.g. "Pain-first hook"
  content: string;  // the actual text content being tested
}

export interface AbTest {
  id: string;
  name: string;
  hypothesis: string;
  variable: AbTestVariable;
  variantA: AbVariant;
  variantB: AbVariant;
  postId: string | null;
  status: AbTestStatus;
  winner: 'A' | 'B' | null;
  winnerReason: string | null;
  createdAt: string;
}

export interface AbTestResult {
  id: string;
  testId: string;
  variant: 'A' | 'B';
  postedAt: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  profileVisits: number;
  watchTimeSeconds: number;
  follows: number;
  notes: string;
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
  thumbnailUrl?: string;
  videoUrl?: string;
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

export interface PostHookBreakdown {
  postIndex: number;
  hookFormula: string;
  hookText: string;
  psychologicalTrigger: string;
  structureArc: string;
  whyItWorked: string;
}

export interface ContentDNA {
  dominantHookType: string;
  emotionalArc: string;
  pacingPattern: string;
  ctaStyle: string;
  uniqueFormula: string;
}

export interface ReplicationFormula {
  templateName: string;
  template: string;
  adaptedForYourBrand: string;
  exampleHook: string;
}

export type CommentInsightCategory = 'pain_point' | 'desire' | 'question' | 'praise' | 'objection';

export interface CommentInsight {
  category: CommentInsightCategory;
  insight: string;
  quotes: string[];
  frequency: 'high' | 'medium' | 'low';
}

export interface ScriptedPostIdea {
  title: string;
  hook: string;
  bodyPoints: string[];
  cta: string;
  why: string;
  theme: string;
  type: string;
}

export interface CommentAnalysis {
  sentimentSummary: string;
  audienceVocabulary: string[];
  recurringThemes: CommentInsight[];
  contentGaps: string[];
  scriptedIdeas: ScriptedPostIdea[];
}

export interface CompetitorReportData {
  overallAnalysis: string;
  audienceSignals: string[];
  whatToDo: IntelTactic[];
  whatNotToDo: IntelAvoidance[];
  actionablePosts: IntelActionablePost[];
  contentDNA?: ContentDNA;
  postBreakdowns?: PostHookBreakdown[];
  replicationFormula?: ReplicationFormula;
  commentAnalysis?: CommentAnalysis;
}

export interface CompetitorReport {
  id: string;
  competitorHandle: string;
  postsAnalyzed: number;
  topPosts: CompetitorPost[];
  report: CompetitorReportData;
  createdAt: string;
}
