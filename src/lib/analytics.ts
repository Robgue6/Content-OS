import * as amplitude from '@amplitude/analytics-browser';

// ─── User Identity ─────────────────────────────────────────────────────────

export const identifyUser = (userId: string, email: string) => {
  amplitude.setUserId(userId);
  const identifyEvent = new amplitude.Identify();
  identifyEvent.set('email', email);
  amplitude.identify(identifyEvent);
};

export const resetUser = () => {
  amplitude.reset();
};

// ─── Auth ──────────────────────────────────────────────────────────────────

export const trackSignIn = (email: string) =>
  amplitude.track('sign_in', { email });

export const trackSignInFailed = (email: string, error: string) =>
  amplitude.track('sign_in_failed', { email, error });

export const trackSignUp = (email: string) =>
  amplitude.track('sign_up', { email });

export const trackSignUpFailed = (email: string, error: string) =>
  amplitude.track('sign_up_failed', { email, error });

export const trackSignOut = () =>
  amplitude.track('sign_out');

// ─── Navigation ────────────────────────────────────────────────────────────

export const trackPageViewed = (tab: string) =>
  amplitude.track('page_viewed', { tab });

// ─── Brand Identity ────────────────────────────────────────────────────────

export const trackBrandIdentitySaved = (fieldsComplete: number, totalFields: number) =>
  amplitude.track('brand_identity_saved', { fields_complete: fieldsComplete, total_fields: totalFields, completion_pct: Math.round((fieldsComplete / totalFields) * 100) });

export const trackLaunchStrategyStarted = () =>
  amplitude.track('launch_strategy_started');

export const trackLaunchStrategyCompleted = (themesAdded: number, typesAdded: number) =>
  amplitude.track('launch_strategy_completed', { themes_added: themesAdded, types_added: typesAdded });

export const trackLaunchStrategyFailed = (error: string) =>
  amplitude.track('launch_strategy_failed', { error });

export const trackDeepResearchStarted = () =>
  amplitude.track('deep_research_started');

export const trackDeepResearchCompleted = (verbatimsCount: number) =>
  amplitude.track('deep_research_completed', { verbatims_count: verbatimsCount });

export const trackDeepResearchFailed = (error: string) =>
  amplitude.track('deep_research_failed', { error });

// ─── Strategy Matrix ───────────────────────────────────────────────────────

export const trackIdeaAdded = (theme: string, type: string) =>
  amplitude.track('matrix_idea_added', { theme, type });

export const trackIdeaCompleted = (theme: string, type: string) =>
  amplitude.track('matrix_idea_completed', { theme, type });

export const trackIdeaDeleted = () =>
  amplitude.track('matrix_idea_deleted');

export const trackMatrixAiGenerated = (theme: string, type: string, ideasCount: number) =>
  amplitude.track('matrix_ai_generated', { theme, type, ideas_count: ideasCount });

export const trackThemeAdded = (theme: string, source: 'manual' | 'ai') =>
  amplitude.track('theme_added', { theme, source });

export const trackThemeRemoved = (theme: string) =>
  amplitude.track('theme_removed', { theme });

export const trackContentTypeAdded = (type: string, source: 'manual' | 'ai') =>
  amplitude.track('content_type_added', { type, source });

export const trackContentTypeRemoved = (type: string) =>
  amplitude.track('content_type_removed', { type });

// ─── Content Calendar ──────────────────────────────────────────────────────

export const trackPostCreated = (theme: string, type: string, status: string) =>
  amplitude.track('post_created', { theme, type, status });

export const trackPostUpdated = (patch: Record<string, unknown>) =>
  amplitude.track('post_updated', patch);

export const trackPostDeleted = () =>
  amplitude.track('post_deleted');

export const trackPostStatusChanged = (from: string, to: string) =>
  amplitude.track('post_status_changed', { from, to });

// ─── Script Lab ────────────────────────────────────────────────────────────

export const trackScriptLabOpened = (postTheme: string, postType: string, hasExistingScript: boolean) =>
  amplitude.track('script_lab_opened', { post_theme: postTheme, post_type: postType, has_existing_script: hasExistingScript });

export const trackScriptGenerated = (postTheme: string, postType: string, wordCount: number, isRegenerate: boolean) =>
  amplitude.track('script_generated', { post_theme: postTheme, post_type: postType, word_count: wordCount, is_regenerate: isRegenerate });

export const trackScriptGenerationFailed = (error: string) =>
  amplitude.track('script_generation_failed', { error });

export const trackScriptSaved = (wordCount: number) =>
  amplitude.track('script_saved', { word_count: wordCount });

export const trackScriptCopied = () =>
  amplitude.track('script_copied');

export const trackScriptScheduled = (postDate: string, hasFilmDate: boolean) =>
  amplitude.track('script_scheduled', { post_date: postDate, has_film_date: hasFilmDate });

export const trackTeleprompterStarted = (speed: number) =>
  amplitude.track('teleprompter_started', { speed });

// ─── ROI Tracker ───────────────────────────────────────────────────────────

export const trackRoiCampaignCreated = (platform: string) =>
  amplitude.track('roi_campaign_created', { platform });

export const trackRoiCampaignStatusChanged = (from: string, to: string, platform: string) =>
  amplitude.track('roi_campaign_status_changed', { from, to, platform });

export const trackRoiCampaignDeleted = (platform: string) =>
  amplitude.track('roi_campaign_deleted', { platform });

export const trackRoiEntryAdded = (spend: number, followersGained: number) =>
  amplitude.track('roi_entry_added', { spend, followers_gained: followersGained, cost_per_follower: followersGained > 0 ? spend / followersGained : null });

export const trackRoiEntryUpdated = () =>
  amplitude.track('roi_entry_updated');

export const trackRoiEntryDeleted = () =>
  amplitude.track('roi_entry_deleted');

// ─── Settings ──────────────────────────────────────────────────────────────

export const trackAiGenerationToggled = (enabled: boolean) =>
  amplitude.track('ai_generation_toggled', { enabled });

export const trackLanguageChanged = (from: string, to: string) =>
  amplitude.track('language_changed', { from, to });

// ─── AI Chat Agent ──────────────────────────────────────────────────────────

export const trackAiAgentToggled = (enabled: boolean) =>
  amplitude.track('ai_agent_toggled', { enabled });

export const trackAgentMessageSent = (contentLength: number) =>
  amplitude.track('agent_message_sent', { content_length: contentLength });

export const trackAgentError = (error: string) =>
  amplitude.track('agent_error', { error });

export const trackAgentHistoryCleared = () =>
  amplitude.track('agent_history_cleared');

export const trackAgentOpened = () =>
  amplitude.track('agent_panel_opened');

export const trackAgentClosed = () =>
  amplitude.track('agent_panel_closed');

// ─── Sharing ────────────────────────────────────────────────────────────────

export const trackShareLinkCreated = () =>
  amplitude.track('share_link_created');

export const trackShareLinkRevoked = () =>
  amplitude.track('share_link_revoked');

export const trackSharedViewOpened = (token: string) =>
  amplitude.track('shared_view_opened', { token_prefix: token.slice(0, 8) });

// ─── Competitor Intel ────────────────────────────────────────────────────────

export const trackIntelAnalysisStarted = (handle: string) =>
  amplitude.track('intel_analysis_started', { handle });

export const trackIntelAnalysisCompleted = (handle: string, postsAnalyzed: number, ideasGenerated: number) =>
  amplitude.track('intel_analysis_completed', { handle, posts_analyzed: postsAnalyzed, ideas_generated: ideasGenerated });

export const trackIntelAnalysisFailed = (error: string) =>
  amplitude.track('intel_analysis_failed', { error });

export const trackIntelIdeaAdded = (theme: string, type: string) =>
  amplitude.track('intel_idea_added_to_matrix', { theme, type });

export const trackIntelReportDeleted = () =>
  amplitude.track('intel_report_deleted');
