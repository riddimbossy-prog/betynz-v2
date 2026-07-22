import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  BookOpenCheck,
  BrainCircuit,
  ChevronRight,
  Clock3,
  Download,
  Flame,
  History,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  X
} from 'lucide-react';
import { loadDashboard } from './api';
import type { DashboardResponse, Match } from './types';

const engines = [
  { name: 'Zeus', role: 'Market Commander', icon: 'ϟ', status: 'Ready' },
  { name: 'Chronos', role: 'Historical Patterns', icon: '◴', status: 'Learning' },
  { name: 'Athena', role: 'Stat Intelligence', icon: 'Α', status: 'Ready' },
  { name: 'Leonidas', role: 'Strictest Filter', icon: 'Λ', status: 'Ready' }
];

const fallback: DashboardResponse = {
  source: 'demo',
  lastUpdated: new Date().toISOString(),
  metrics: { matches: 760, leagues: 1, patterns: 24, validated: 8 },
  recentMatches: [],
  oddsBands: [
    { label: 'Favourite 1.20–1.39', sample: 86, hitRate: 79.1, market: 'Favourite win' },
    { label: 'O2.5 opening 1.45–1.64', sample: 133, hitRate: 63.2, market: 'Over 2.5' },
    { label: 'Draw 3.20–3.59', sample: 197, hitRate: 29.4, market: 'Draw result' }
  ]
};

function fmtDate(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function scoreTone(match: Match) {
  if (match.homeGoals + match.awayGoals >= 4) return 'hot';
  if (match.homeGoals + match.awayGoals <= 1) return 'cool';
  return 'neutral';
}

export default function App() {
  const [data, setData] = useState<DashboardResponse>(fallback);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [listCount, setListCount] = useState(0);

  useEffect(() => {
    loadDashboard()
      .then(setData)
      .catch(() => setData(fallback))
      .finally(() => setLoading(false));
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data.recentMatches.slice(0, 8);
    return data.recentMatches.filter((m) => `${m.homeTeam} ${m.awayTeam} ${m.leagueName}`.toLowerCase().includes(q)).slice(0, 8);
  }, [data.recentMatches, query]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Betynz home">
          <span className="brand-mark">ϟ</span>
          <span className="brand-copy"><strong>BETYNZ</strong><small>.com</small></span>
        </a>
        <div className="header-actions">
          <label className="search-box">
            <Search size={17} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search teams or leagues" />
          </label>
          <div className="last-updated"><Clock3 size={15} /><span>Last updated</span><strong>{fmtDate(data.lastUpdated)}</strong></div>
          <button className="ghost-button install"><Download size={17} />Install App</button>
          <button className="icon-button" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu /></button>
        </div>
      </header>

      <main id="top">
        <section className="hero panel-grid">
          <div className="hero-copy">
            <span className="eyebrow"><Sparkles size={14} /> OLYMPIAN FOOTBALL INTELLIGENCE</span>
            <h1>Predict smarter.<br /><span>Let the gods decide.</span></h1>
            <p>Historical odds, settled results and strict validation—rebuilt as one clean intelligence platform.</p>
            <div className="hero-actions">
              <a className="primary-button" href="#chronos"><BrainCircuit size={18} />Open Chronos Lab</a>
              <a className="secondary-button" href="#board"><BarChart3 size={18} />View Full Board</a>
            </div>
            <div className="trust-row">
              <span><ShieldCheck size={16} /> No forced picks</span>
              <span><History size={16} /> Walk-forward validation</span>
              <span><Activity size={16} /> Auto-settlement ready</span>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="lightning one">ϟ</div>
            <div className="lightning two">ϟ</div>
            <div className="orb"><span>CHRONOS</span><strong>{data.metrics.matches}</strong><small>historical matches</small></div>
            <div className="orbit orbit-a"></div>
            <div className="orbit orbit-b"></div>
          </div>
        </section>

        <section className="metrics">
          <article><span><History /></span><div><strong>{data.metrics.matches.toLocaleString()}</strong><small>Imported matches</small></div></article>
          <article><span><Trophy /></span><div><strong>{data.metrics.leagues}</strong><small>League databases</small></div></article>
          <article><span><Target /></span><div><strong>{data.metrics.patterns}</strong><small>Pattern candidates</small></div></article>
          <article><span><BookOpenCheck /></span><div><strong>{data.metrics.validated}</strong><small>Validated patterns</small></div></article>
        </section>

        <section className="content-section" id="chronos">
          <div className="section-heading">
            <div><span className="eyebrow"><Flame size={14} /> NEW ENGINE</span><h2>Chronos Pattern Lab</h2><p>Find repeatable odds structures before they become public selections.</p></div>
            <button className="text-button">Open all patterns <ChevronRight size={18} /></button>
          </div>
          <div className="pattern-grid">
            {data.oddsBands.map((band) => (
              <article className="pattern-card" key={`${band.market}-${band.label}`}>
                <div className="pattern-top"><span>{band.market}</span><strong>{band.hitRate.toFixed(1)}%</strong></div>
                <h3>{band.label}</h3>
                <div className="progress"><i style={{ width: `${Math.min(band.hitRate, 100)}%` }} /></div>
                <footer><span>{band.sample} settled matches</span><span className={band.hitRate >= 70 ? 'verified' : 'watch'}>{band.hitRate >= 70 ? 'Validated' : 'Watchlist'}</span></footer>
              </article>
            ))}
          </div>
        </section>

        <section className="content-section engines-section">
          <div className="section-heading"><div><span className="eyebrow">THE OLYMPIAN ROOM</span><h2>Active intelligence engines</h2></div><span className="status-pill">4 / 8 online</span></div>
          <div className="engine-grid">
            {engines.map((engine) => (
              <article className="engine-card" key={engine.name}>
                <span className="engine-icon">{engine.icon}</span>
                <div><h3>{engine.name}</h3><p>{engine.role}</p></div>
                <span className="engine-status">{engine.status}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="content-section board-section" id="board">
          <div className="section-heading">
            <div><span className="eyebrow">HISTORICAL BOARD</span><h2>Recent imported results</h2><p>{loading ? 'Connecting to the API…' : data.source === 'demo' ? 'Demo fallback active. Connect Supabase for the live database.' : 'Loaded from your private Betynz database.'}</p></div>
            <button className="analysis-button" onClick={() => setListCount((n) => n + 1)}>Analysis List <b>{listCount}</b></button>
          </div>
          <div className="match-table">
            <div className="match-row match-head"><span>Fixture</span><span>Opening 1X2</span><span>Closing 1X2</span><span>Result</span><span></span></div>
            {matches.length ? matches.map((match) => (
              <div className="match-row" key={match.id}>
                <div className="fixture"><small>{match.leagueCode} · {match.season}</small><strong>{match.homeTeam} <em>vs</em> {match.awayTeam}</strong><span>{match.date}</span></div>
                <div className="odds"><span>{match.odds.openingHome ?? '—'}</span><span>{match.odds.openingDraw ?? '—'}</span><span>{match.odds.openingAway ?? '—'}</span></div>
                <div className="odds closing"><span>{match.odds.closingHome ?? '—'}</span><span>{match.odds.closingDraw ?? '—'}</span><span>{match.odds.closingAway ?? '—'}</span></div>
                <div className={`score ${scoreTone(match)}`}><strong>{match.homeGoals}–{match.awayGoals}</strong><small>{match.result === 'H' ? 'Home' : match.result === 'A' ? 'Away' : 'Draw'}</small></div>
                <button className="row-action" onClick={() => setListCount((n) => n + 1)}>+</button>
              </div>
            )) : <div className="empty-state"><BrainCircuit /><h3>API starter is ready</h3><p>Run the importer and the board will populate automatically from your database.</p></div>}
          </div>
        </section>
      </main>

      <footer className="footer"><span>© 2026 Betynz.com</span><nav><a href="#">Responsible Gambling</a><a href="#">Terms</a><a href="#">Privacy</a><a href="#">Disclaimer</a></nav><p>Football analytics only. 18+. No outcome is guaranteed.</p></footer>

      <div className={`drawer-backdrop ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)} />
      <aside className={`drawer ${menuOpen ? 'open' : ''}`}>
        <button className="drawer-close" onClick={() => setMenuOpen(false)}><X /></button>
        <span className="eyebrow">BETYNZ NAVIGATION</span>
        <a href="#top">Overview</a><a href="#chronos">Chronos Lab</a><a href="#board">Full Board</a><a href="#">Proof</a><a href="#">League DNA</a><a href="#">Gods & Rebels</a>
      </aside>

      <nav className="mobile-nav"><a href="#top"><Activity /><span>Home</span></a><a href="#chronos"><BrainCircuit /><span>Chronos</span></a><a href="#board"><BarChart3 /><span>Board</span></a><button onClick={() => setMenuOpen(true)}><Menu /><span>Menu</span></button></nav>
    </div>
  );
}
