import { useState } from 'react';
import { FlaskConical, Mail, Lock, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import * as analytics from '../../lib/analytics';

interface Props {
  onBack?: () => void;
}

export default function AuthPage({ onBack }: Props) {
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const reset = () => { setError(''); setSuccess(''); };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    reset();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      analytics.trackSignInFailed(email, error.message);
    } else {
      analytics.trackSignIn(email);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    reset();
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      analytics.trackSignUpFailed(email, error.message);
    } else {
      analytics.trackSignUp(email);
      setSuccess('Account created! Check your email to confirm, then log in.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Back to landing */}
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 font-medium mb-6 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
        )}

        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md">
            <FlaskConical className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-slate-900">Content Pilot</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="grid grid-cols-2 border-b border-slate-200">
            {(['login', 'signup'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); reset(); }}
                className={`py-3.5 text-sm font-semibold transition-colors ${
                  tab === t
                    ? 'text-indigo-700 border-b-2 border-indigo-600 bg-indigo-50/50'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={tab === 'login' ? handleLogin : handleSignup} className="p-6 space-y-4">
            {error && (
              <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <p className="text-xs text-rose-700">{error}</p>
              </div>
            )}
            {success && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
                <p className="text-xs text-emerald-700">{success}</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={tab === 'signup' ? 'Min. 8 characters' : '••••••••'}
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Please wait...' : tab === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Your data is securely stored and synced across devices.
        </p>
      </div>
    </div>
  );
}
