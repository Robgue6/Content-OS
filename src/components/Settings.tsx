import { useState } from 'react';
import { Sparkles, LogOut, Languages, Link2, Check, Telescope, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { AppLanguage, ShareLink } from '../types';
import * as analytics from '../lib/analytics';

const LANGUAGES: { value: AppLanguage; label: string; flag: string }[] = [
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'es', label: 'Spanish', flag: '🇪🇸' },
  { value: 'fr', label: 'French', flag: '🇫🇷' },
];

interface Props {
  aiEnabled: boolean;
  onAiEnabledChange: (enabled: boolean) => void;
  aiAgentEnabled: boolean;
  onAiAgentEnabledChange: (enabled: boolean) => void;
  language: AppLanguage;
  onLanguageChange: (lang: AppLanguage) => void;
  userEmail: string;
  shareLink: ShareLink | null;
  onGenerateShareLink: () => Promise<void>;
  onRevokeShareLink: () => Promise<void>;
  apifyApiKey: string;
  onApifyApiKeyChange: (key: string) => Promise<void>;
}

export default function Settings({ aiEnabled, onAiEnabledChange, aiAgentEnabled, onAiAgentEnabledChange, language, onLanguageChange, userEmail, shareLink, onGenerateShareLink, onRevokeShareLink, apifyApiKey, onApifyApiKeyChange }: Props) {
  const handleAiToggle = () => {
    const next = !aiEnabled;
    analytics.trackAiGenerationToggled(next);
    onAiEnabledChange(next);
  };
  const handleAiAgentToggle = () => {
    const next = !aiAgentEnabled;
    analytics.trackAiAgentToggled(next);
    onAiAgentEnabledChange(next);
  };

  const handleLanguageChange = (lang: AppLanguage) => {
    analytics.trackLanguageChanged(language, lang);
    onLanguageChange(lang);
  };
  const [signingOut, setSigningOut] = useState(false);
  const [copied, setCopied] = useState(false);
  const [apifyKeyDraft, setApifyKeyDraft] = useState(apifyApiKey);
  const [apifyKeySaving, setApifyKeySaving] = useState(false);
  const [apifyKeyVisible, setApifyKeyVisible] = useState(false);
  const [apifyKeySaved, setApifyKeySaved] = useState(false);

  const saveApifyKey = async () => {
    setApifyKeySaving(true);
    await onApifyApiKeyChange(apifyKeyDraft.trim());
    setApifyKeySaving(false);
    setApifyKeySaved(true);
    setTimeout(() => setApifyKeySaved(false), 2000);
  };
  const shareUrl = shareLink ? `${window.location.origin}?share=${shareLink.token}` : '';
  const copyShareUrl = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const signOut = async () => {
    setSigningOut(true);
    analytics.trackSignOut();
    await supabase.auth.signOut();
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Configure your workspace and AI integration.</p>
      </div>

      {/* Account */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">Account</h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-900">{userEmail}</p>
            <p className="text-xs text-slate-400 mt-0.5">Signed in · data synced to Supabase</p>
          </div>
          <button
            onClick={signOut}
            disabled={signingOut}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-rose-600 hover:border-rose-200 transition-colors disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" />
            {signingOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      </div>

      {/* AI Language */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Languages className="w-4 h-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-slate-700">AI Output Language</h2>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          All AI-generated scripts, ideas, and concepts will be written in the selected language.
        </p>
        <div className="flex gap-2">
          {LANGUAGES.map(lang => (
            <button
              key={lang.value}
              onClick={() => handleLanguageChange(lang.value)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all ${
                language === lang.value
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span className="text-base">{lang.flag}</span>
              {lang.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-indigo-600 font-medium">
          Active: {LANGUAGES.find(l => l.value === language)?.flag} {LANGUAGES.find(l => l.value === language)?.label}
        </p>
      </div>

      {/* AI Feature Flag */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <h2 className="text-sm font-semibold text-slate-700">AI Idea Generation</h2>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              When enabled, a "Generate with AI" button appears in each Strategy Matrix cell.
              Powered by OpenRouter — no API key required.
            </p>
          </div>
          <button
            onClick={handleAiToggle}
            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${aiEnabled ? 'bg-indigo-600' : 'bg-slate-200'
              }`}
            role="switch"
            aria-checked={aiEnabled}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${aiEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
            />
          </button>
        </div>
        <div className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg ${aiEnabled ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-50 text-slate-500'
          }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${aiEnabled ? 'bg-indigo-500' : 'bg-slate-300'}`} />
          {aiEnabled ? 'AI idea generation is active in the Strategy Matrix' : 'AI idea generation is hidden — manual mode only'}
        </div>
      </div>

      {/* AI Content Agent Feature Flag */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-violet-500" />
              <h2 className="text-sm font-semibold text-slate-700">AI Content Agent</h2>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              When enabled, a floating chat agent appears on every page. Ask questions about
              your strategy, get content ideas, or brainstorm angles — all grounded in your Brand Identity.
            </p>
          </div>
          <button
            onClick={handleAiAgentToggle}
            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 ${
              aiAgentEnabled ? 'bg-violet-600' : 'bg-slate-200'
            }`}
            role="switch"
            aria-checked={aiAgentEnabled}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                aiAgentEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
        <div className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg ${
          aiAgentEnabled ? 'bg-violet-50 text-violet-700' : 'bg-slate-50 text-slate-500'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${aiAgentEnabled ? 'bg-violet-500' : 'bg-slate-300'}`} />
          {aiAgentEnabled
            ? 'Content Agent is active — look for the chat button in the bottom-right corner'
            : 'Content Agent is hidden'}
        </div>
      </div>

      {/* Share with Advisor */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-slate-700">Share with Advisor</h2>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Generate a read-only link to share your Calendar, Strategy Matrix, and ROI
          with a manager or advisor. Anyone with the link can view — no account needed.
        </p>
        {shareLink ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <input
                readOnly
                value={shareUrl}
                className="flex-1 text-xs text-slate-600 bg-transparent outline-none truncate"
              />
              <button
                onClick={copyShareUrl}
                className="shrink-0 flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                {copied ? <><Check className="w-3 h-3" />Copied!</> : 'Copy'}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">
                Created {new Date(shareLink.createdAt).toLocaleDateString()}
              </p>
              <button
                onClick={onRevokeShareLink}
                className="text-xs font-medium text-rose-500 hover:text-rose-700 transition-colors"
              >
                Revoke link
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={onGenerateShareLink}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Link2 className="w-4 h-4" /> Generate share link
          </button>
        )}
      </div>

      {/* Competitor Intel — Apify Token */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Telescope className="w-4 h-4 text-orange-500" />
          <h2 className="text-sm font-semibold text-slate-700">Competitor Intel</h2>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Enter your Apify API token to enable the Competitor Intel tab. Apify scrapes
          Instagram posts and comments so the AI can generate an actionable strategy
          tailored to your brand. Get a free token at{' '}
          <span className="text-orange-600 font-medium">apify.com</span>.
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={apifyKeyVisible ? 'text' : 'password'}
              value={apifyKeyDraft}
              onChange={e => setApifyKeyDraft(e.target.value)}
              placeholder="apify_api_xxxxxxxxxxxxxxxxxxxx"
              className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 pr-10 outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent font-mono"
            />
            <button
              type="button"
              onClick={() => setApifyKeyVisible(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {apifyKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button
            onClick={saveApifyKey}
            disabled={apifyKeySaving || apifyKeyDraft.trim() === apifyApiKey}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 shrink-0"
          >
            {apifyKeySaved ? <><Check className="w-4 h-4" /> Saved</> : apifyKeySaving ? 'Saving...' : 'Save'}
          </button>
        </div>
        <div className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg ${apifyApiKey ? 'bg-orange-50 text-orange-700' : 'bg-slate-50 text-slate-500'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${apifyApiKey ? 'bg-orange-500' : 'bg-slate-300'}`} />
          {apifyApiKey ? 'Apify connected — Competitor Intel is active' : 'No token — Competitor Intel tab requires this'}
        </div>
      </div>

      <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">About Content Pilot</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          Content Pilot is your strategic editorial workspace. It bridges high-level brand strategy
          with daily production using AI to transform audience empathy into viral-ready scripts.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {['React 19', 'TypeScript', 'Tailwind CSS', 'OpenRouter', 'Supabase', 'Recharts'].map(t => (
            <span key={t} className="text-xs bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
