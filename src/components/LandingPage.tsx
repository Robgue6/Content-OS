import {
  FlaskConical, Grid3X3, CalendarDays, LayoutDashboard, TrendingUp,
  User, Sparkles, ArrowRight, Check, Zap, Target, BarChart3,
} from 'lucide-react';

interface Props {
  onGetStarted: () => void;
  onSignIn: () => void;
}

const FEATURES = [
  {
    icon: <User className="w-5 h-5" />,
    title: 'Brand Identity',
    desc: 'ICP, empathy map, tone & positioning — your creator DNA in one place.',
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'border-violet-100',
  },
  {
    icon: <Grid3X3 className="w-5 h-5" />,
    title: 'Strategy Matrix',
    desc: 'Visual theme × format grid. AI generates ideas that fit your brand.',
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
    border: 'border-indigo-100',
  },
  {
    icon: <CalendarDays className="w-5 h-5" />,
    title: 'Content Calendar',
    desc: 'Plan every post. Track status from idea to published in one view.',
    color: 'text-pink-600',
    bg: 'bg-pink-50',
    border: 'border-pink-100',
  },
  {
    icon: <FlaskConical className="w-5 h-5" />,
    title: 'Script Lab',
    desc: 'AI writes hook, body & CTA scripts that sound exactly like you.',
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-100',
  },
  {
    icon: <TrendingUp className="w-5 h-5" />,
    title: 'ROI Tracker',
    desc: 'Track ad spend vs followers gained. Know when to scale or stop.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-100',
  },
  {
    icon: <LayoutDashboard className="w-5 h-5" />,
    title: 'Creator Dashboard',
    desc: 'Pipeline health, KPIs and content stats at a glance every morning.',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-100',
  },
];

const STEPS = [
  {
    num: '01',
    icon: <Target className="w-6 h-6 text-white" />,
    title: 'Define your brand',
    desc: 'Set your ideal customer profile, empathy map, and unique tone of voice. Your brand becomes the AI\'s context.',
    accent: 'from-violet-500 to-indigo-600',
    glow: 'shadow-violet-500/30',
  },
  {
    num: '02',
    icon: <Grid3X3 className="w-6 h-6 text-white" />,
    title: 'Plan your content',
    desc: 'The Strategy Matrix maps out ideas across themes and formats. Generate AI concepts or add your own.',
    accent: 'from-indigo-500 to-blue-600',
    glow: 'shadow-indigo-500/30',
  },
  {
    num: '03',
    icon: <Zap className="w-6 h-6 text-white" />,
    title: 'Script with AI',
    desc: 'Open Script Lab for any post. Get a brand-aligned hook, body and CTA in seconds, ready to film.',
    accent: 'from-pink-500 to-rose-600',
    glow: 'shadow-pink-500/30',
  },
];

export default function LandingPage({ onGetStarted, onSignIn }: Props) {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-16 h-16"
        style={{ background: 'rgba(2,4,18,0.75)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/40">
            <FlaskConical className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-bold text-sm tracking-tight">Content Pilot</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onSignIn}
            className="text-sm text-white/60 hover:text-white font-medium transition-colors px-4 py-2 rounded-lg hover:bg-white/8"
          >
            Sign in
          </button>
          <button
            onClick={onGetStarted}
            className="text-sm bg-white text-slate-900 font-semibold px-4 py-2 rounded-lg hover:bg-white/90 transition-all shadow-sm"
          >
            Get started free
          </button>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center overflow-hidden pt-16" style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #020412 0%, #0d0a2e 40%, #1a0a2e 70%, #0d1a3a 100%)' }}>

        {/* Background blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
          <div className="absolute -top-32 left-1/4 w-[700px] h-[700px] rounded-full opacity-[0.15]"
            style={{ background: 'radial-gradient(circle, #7c3aed, transparent 70%)' }} />
          <div className="absolute top-1/2 -right-32 w-[500px] h-[500px] rounded-full opacity-[0.12]"
            style={{ background: 'radial-gradient(circle, #4f46e5, transparent 70%)' }} />
          <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] rounded-full opacity-[0.10]"
            style={{ background: 'radial-gradient(circle, #db2777, transparent 70%)' }} />
          {/* Fine grid */}
          <div className="absolute inset-0 opacity-[0.025]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px),linear-gradient(90deg,rgba(255,255,255,.6) 1px,transparent 1px)', backgroundSize: '64px 64px' }} />
        </div>

        <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-5xl mx-auto py-20">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-8 select-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(196,181,253,0.9)' }}>
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            AI-powered creator workspace
          </div>

          {/* Headline */}
          <h1 className="font-extrabold text-white leading-[1.06] tracking-tight mb-6"
            style={{ fontSize: 'clamp(2.8rem, 7vw, 5.5rem)' }}>
            From strategy to&nbsp;
            <span style={{ background: 'linear-gradient(90deg,#a78bfa,#f472b6,#818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              viral content
            </span>
            <br />
            — in one workspace.
          </h1>

          {/* Sub */}
          <p className="text-lg leading-relaxed max-w-xl mb-10" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Content Pilot bridges brand strategy with daily production.
            Always know what to post, why it matters, and exactly what to say.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-3 mb-8">
            <button
              onClick={onGetStarted}
              className="group flex items-center gap-2 font-bold px-7 py-3.5 rounded-xl text-sm text-white transition-all"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', boxShadow: '0 8px 32px rgba(99,60,180,0.45)' }}
            >
              Start for free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button
              onClick={onSignIn}
              className="flex items-center gap-2 text-sm font-medium px-7 py-3.5 rounded-xl transition-all"
              style={{ color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.12)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.9)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.25)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)'; }}
            >
              Already have an account? Sign in
            </button>
          </div>

          {/* Trust pills */}
          <div className="flex flex-wrap items-center justify-center gap-5">
            {['No credit card required', 'Free to use', 'Syncs across devices'].map(t => (
              <div key={t} className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.32)' }}>
                <Check className="w-3 h-3" style={{ color: '#34d399' }} />
                {t}
              </div>
            ))}
          </div>
        </div>

        {/* ── App preview mockup ──────────────────────────────────────────── */}
        <div className="relative z-10 w-full max-w-5xl mx-auto px-6 pb-20">
          <div className="relative">

            {/* Main window */}
            <div className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)' }}>

              {/* Title bar */}
              <div className="flex items-center gap-2 px-4 h-10" style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="w-3 h-3 rounded-full" style={{ background: 'rgba(239,68,68,0.6)' }} />
                <div className="w-3 h-3 rounded-full" style={{ background: 'rgba(245,158,11,0.6)' }} />
                <div className="w-3 h-3 rounded-full" style={{ background: 'rgba(52,211,153,0.6)' }} />
                <span className="text-xs ml-4" style={{ color: 'rgba(255,255,255,0.25)' }}>Content Pilot — Strategy Matrix</span>
              </div>

              {/* App body: sidebar + content */}
              <div className="flex">
                {/* Mini sidebar */}
                <div className="hidden md:flex flex-col gap-1 p-3 w-36 shrink-0" style={{ borderRight: '1px solid rgba(255,255,255,0.07)' }}>
                  {[
                    { label: 'Dashboard', active: false },
                    { label: 'Brand', active: false },
                    { label: 'Matrix', active: true },
                    { label: 'Calendar', active: false },
                    { label: 'Script Lab', active: false },
                    { label: 'ROI', active: false },
                  ].map(n => (
                    <div key={n.label} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
                      style={{
                        background: n.active ? 'rgba(99,60,180,0.7)' : 'transparent',
                        color: n.active ? '#fff' : 'rgba(255,255,255,0.35)',
                      }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: n.active ? '#a78bfa' : 'rgba(255,255,255,0.2)' }} />
                      {n.label}
                    </div>
                  ))}
                </div>

                {/* Matrix content */}
                <div className="flex-1 p-5 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs" style={{ borderCollapse: 'separate', borderSpacing: '4px' }}>
                      <thead>
                        <tr>
                          <th className="w-24" />
                          {['Tutorial', 'Story', 'Listicle', 'Hot Take'].map((t, i) => (
                            <th key={t} className="py-2 px-3 rounded-lg text-center font-semibold" style={{
                              background: ['rgba(139,92,246,0.2)', 'rgba(236,72,153,0.18)', 'rgba(99,102,241,0.2)', 'rgba(245,158,11,0.18)'][i],
                              color: ['#c4b5fd', '#f9a8d4', '#a5b4fc', '#fcd34d'][i],
                            }}>{t}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          {
                            theme: 'Growth', color: 'rgba(139,92,246,0.12)', text: '#c4b5fd',
                            ideas: ['5 habits that 10x\'d my following', 'From 0 to 10k in 3 months', '7 growth hacks that work', 'Unpopular opinion: consistency is overrated'],
                          },
                          {
                            theme: 'Mindset', color: 'rgba(236,72,153,0.12)', text: '#f9a8d4',
                            ideas: ['Morning routine for creative flow', 'The day I almost quit', '10 mindset shifts for creators', ''],
                          },
                          {
                            theme: 'Tools', color: 'rgba(99,102,241,0.12)', text: '#a5b4fc',
                            ideas: ['', 'My content stack 2025', 'Best free tools for creators', 'This app changed everything'],
                          },
                        ].map(row => (
                          <tr key={row.theme}>
                            <td className="py-2.5 px-3 rounded-lg text-center text-xs font-semibold" style={{ background: row.color, color: row.text }}>{row.theme}</td>
                            {row.ideas.map((idea, i) => (
                              <td key={i} className="py-2.5 px-3 rounded-lg text-xs leading-relaxed" style={{
                                background: idea ? 'rgba(255,255,255,0.04)' : 'transparent',
                                border: idea ? '1px solid rgba(255,255,255,0.07)' : '1px dashed rgba(255,255,255,0.08)',
                                color: idea ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.18)',
                                maxWidth: 140,
                                overflow: 'hidden',
                              }}>
                                <span className="line-clamp-2">{idea || '+ Add idea'}</span>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating AI script card */}
            <div className="absolute -bottom-8 right-2 md:right-10 w-64 rounded-2xl p-5 z-20"
              style={{ background: 'rgba(15,10,40,0.85)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.15)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.3)' }}>
                  <Sparkles className="w-3.5 h-3.5 text-violet-300" />
                </div>
                <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>AI Script Generated</span>
                <span className="ml-auto text-[10px] font-bold text-emerald-400">✓</span>
              </div>
              <div className="space-y-2.5">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.28)' }}>Hook</p>
                  <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)' }}>"You're losing followers because of this one mistake — and you don't even know it."</p>
                </div>
                <div className="h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.28)' }}>Body</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Most creators focus on posting more...</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.28)' }}>CTA</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Follow for the full breakdown →</p>
                </div>
              </div>
            </div>

            {/* Floating ROI card */}
            <div className="hidden lg:block absolute -top-6 -right-6 w-52 rounded-2xl p-4"
              style={{ background: 'rgba(15,10,40,0.85)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 20px 50px rgba(0,0,0,0.4)' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.2)' }}>
                  <BarChart3 className="w-3 h-3 text-emerald-400" />
                </div>
                <span className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>ROI Signal</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-500/50" />
                <span className="text-[11px] font-semibold text-emerald-400">ROI is Good</span>
              </div>
              <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>€0.32 / follower · Target: €0.50</p>
              <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>→ Consider scaling budget</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="bg-slate-50 py-28 px-6 md:px-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold uppercase tracking-widest mb-4">
              Everything you need
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
              The complete creator toolkit
            </h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto leading-relaxed">
              Six tightly-integrated tools that take you from brand strategy to a posted video.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title}
                className={`group bg-white rounded-2xl border ${f.border} p-7 hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5 cursor-default`}>
                <div className={`w-12 h-12 ${f.bg} ${f.color} rounded-2xl flex items-center justify-center mb-5 group-hover:scale-105 transition-transform`}>
                  {f.icon}
                </div>
                <h3 className="font-bold text-slate-900 text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="py-28 px-6 md:px-16 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-50 border border-violet-100 text-violet-700 text-xs font-semibold uppercase tracking-widest mb-4">
              Simple process
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">
              From blank page to posted video
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {STEPS.map((step, i) => (
              <div key={step.num} className="relative flex flex-col">
                {/* Connector line */}
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-full w-full h-px z-0"
                    style={{ background: 'linear-gradient(90deg, rgba(99,102,241,0.3) 0%, transparent 100%)', transform: 'translateX(-50%)' }} />
                )}
                <div className={`relative z-10 w-16 h-16 rounded-2xl bg-gradient-to-br ${step.accent} flex items-center justify-center mb-6 shadow-xl ${step.glow}`}>
                  {step.icon}
                </div>
                <div className="text-xs font-black uppercase tracking-widest text-slate-300 mb-2">{step.num}</div>
                <h3 className="font-bold text-slate-900 text-xl mb-3">{step.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats strip ──────────────────────────────────────────────────── */}
      <section className="py-20 px-6 md:px-16" style={{ background: 'linear-gradient(135deg, #0f0a2e 0%, #1a0a3e 50%, #0d1a3a 100%)' }}>
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: '6', label: 'Integrated tools' },
            { value: 'AI', label: 'Script generation' },
            { value: '∞', label: 'Content ideas' },
            { value: '100%', label: 'Brand-aligned' },
          ].map(s => (
            <div key={s.label} className="flex flex-col items-center">
              <p className="font-black text-white mb-2" style={{ fontSize: 'clamp(2.5rem, 5vw, 3.5rem)' }}>{s.value}</p>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="relative py-32 px-6 md:px-16 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #9333ea 100%)' }}>
        {/* Decorative blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.4), transparent 70%)' }} />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full opacity-15"
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.4), transparent 70%)' }} />
          {/* Grid */}
          <div className="absolute inset-0 opacity-[0.06]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.7) 1px, transparent 1px),linear-gradient(90deg,rgba(255,255,255,.7) 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
        </div>

        <div className="relative z-10 max-w-2xl mx-auto text-center">
          <h2 className="font-extrabold text-white leading-tight mb-6 tracking-tight"
            style={{ fontSize: 'clamp(2.2rem, 5vw, 3.5rem)' }}>
            Ready to pilot your content?
          </h2>
          <p className="text-lg leading-relaxed mb-10" style={{ color: 'rgba(255,255,255,0.65)' }}>
            Build your brand strategy, plan smarter, script faster — and finally grow with intention.
          </p>
          <button
            onClick={onGetStarted}
            className="group inline-flex items-center gap-2.5 bg-white font-bold px-9 py-4 rounded-xl text-base transition-all"
            style={{ color: '#4f46e5', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 24px 70px rgba(0,0,0,0.3)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 20px 60px rgba(0,0,0,0.25)'; }}
          >
            Start for free
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
          <p className="text-sm mt-6" style={{ color: 'rgba(255,255,255,0.4)' }}>No credit card required · Free forever · Sync across devices</p>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="py-10 px-6 md:px-16" style={{ background: '#020412' }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center">
              <FlaskConical className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>Content Pilot</span>
          </div>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Built for creators who take their brand seriously.
          </p>
          <button
            onClick={onSignIn}
            className="text-xs font-medium transition-colors"
            style={{ color: 'rgba(255,255,255,0.4)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.8)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)'; }}
          >
            Sign in →
          </button>
        </div>
      </footer>
    </div>
  );
}