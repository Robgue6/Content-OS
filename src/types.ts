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

export type NavTab = 'dashboard' | 'identity' | 'matrix' | 'calendar' | 'lab' | 'roi';

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
  activeTab: NavTab;
  scriptLabPostId: string | null;
}
