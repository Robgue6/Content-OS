import { useState } from 'react';
import { Eye, EyeOff, ExternalLink, CheckCircle2, Sparkles, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props {
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  aiEnabled: boolean;
  onAiEnabledChange: (enabled: boolean) => void;
  userEmail: string;
}

export default function Settings({ apiKey, onApiKeyChange, aiEnabled, onAiEnabledChange, userEmail }: Props) {
  const [show, setShow] = useState(false);
  const [draft, setDraft] = useState(apiKey);
  const [saved, setSaved] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const save = () => {
    onApiKeyChange(draft.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const signOut = async () => {
    setSigningOut(true);
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
              Requires a valid OpenAI API key below.
            </p>
          </div>
          <button
            onClick={() => onAiEnabledChange(!aiEnabled)}
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

      {/* OpenAI API Key */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">OpenAI API Key</h2>
        <p className="text-xs text-slate-500">
          Required for AI idea generation and script writing. Stored securely in your Supabase profile — only you can read it.
        </p>
        <a
          href="https://platform.openai.com/api-keys"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
        >
          Get an API key from OpenAI Documentation
          <ExternalLink className="w-3 h-3" />
        </a>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={show ? 'text' : 'password'}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="sk-..."
              className="w-full px-3 py-2 pr-10 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
            <button
              onClick={() => setShow(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button
            onClick={save}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            {saved ? <CheckCircle2 className="w-4 h-4" /> : null}
            {saved ? 'Saved!' : 'Save'}
          </button>
        </div>
        {apiKey && (
          <p className="text-xs text-emerald-600 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            API key is set — stored securely in your profile.
          </p>
        )}
      </div>

      <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">About Content Pilot</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          Content Pilot is your strategic editorial workspace. It bridges high-level brand strategy
          with daily production using AI to transform audience empathy into viral-ready scripts.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {['React 19', 'TypeScript', 'Tailwind CSS', 'OpenAI', 'Supabase', 'Recharts'].map(t => (
            <span key={t} className="text-xs bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
