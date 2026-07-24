import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BrainCircuit,
  CalendarDays,
  Clock3,
  Download,
  Menu,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  X,
  Zap
} from 'lucide-react';
import { loadPredictions } from './api';
import type { AthenaPublicPick, Prediction, PredictionDashboard } from './types';

type GodKey = 'zeus' | 'athena';

type BoardPick = {
  id: string;
  god: GodKey;
  date: string;
  kickoff: string;
  leagueName: string;
  country: string;
  homeTeam: string;
  awayTeam: string;
  selection: string;
  odds?: number;
  banker: boolean;
  statsLine: string;
};

const emptyPredictions: PredictionDashboard = {
  source: 'offline',
  generatedAt: new Date().toISOString(),
  engineVersion: 'zeus-athena-2.9.0',
  currentEngineReady: false,
  rebuilding: false,
  window: { from: '', to: '', days: [] },
  metrics: {
    fixtures: 0,
    picks: 0,
    fullPicks: 0,
    provisionalPicks: 0,
    bankers: 0,
    leagues: 0,
    pickLeagues: 0,
    lowOddsUpgrades: 0,
    pricedFixtures: 0,
    zeusAutoPicks: 0,
    athenaShadowRuns: 0,
    athenaShadowPicks: 0,
    athenaShadowBankers: 0,
    athenaPublicPicks: 0
  },
  bankers: [],
  predictions: [],
  zeusAutoPicks: [],
  athenaPicks: [],
  radarFixtures: []
};

function dayLabel(date: string, index: number) {
  const value = new Date(`${date}T12:00:00Z`);
  return {
    short: index === 0 ? 'Today' : new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'UTC' }).format(value),
    date: new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(value)
  };
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Accra' }).format(new Date(value));
}

function updatedLabel(value: string) {
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Accra' }).format(new Date(value));
}

function numberEvidence(prediction: Prediction, key: string) {
  const value = Number(prediction.evidence[key]);
  return Number.isFinite(value) ? Math.round(value) : null;
}

function zeusStatsLine(prediction: Prediction) {
  const parts = [`Model ${Math.round(prediction.probability)}%`];
  const history = numberEvidence(prediction, 'historicalHitRate');
  if (history != null) parts.push(`History ${history}%`);
  const confrontation = numberEvidence(prediction, 'confrontationCompatibility');
  if (confrontation != null) parts.push(`Stats ${confrontation}%`);
  return parts.slice(0, 3).join(' · ');
}

function toZeusPick(prediction: Prediction): BoardPick {
  return {
    id: `zeus-${prediction.fixtureId}`,
    god: 'zeus',
    date: prediction.date,
    kickoff: prediction.kickoff,
    leagueName: prediction.leagueName,
    country: prediction.country,
    homeTeam: prediction.homeTeam,
    awayTeam: prediction.awayTeam,
    selection: prediction.selection,
    odds: prediction.odds,
    banker: prediction.banker,
    statsLine: zeusStatsLine(prediction)
  };
}

function toAthenaPick(prediction: AthenaPublicPick): BoardPick {
  return {
    id: `athena-${prediction.fixtureId}`,
    god: 'athena',
    date: prediction.date,
    kickoff: prediction.kickoff,
    leagueName: prediction.leagueName,
    country: prediction.country,
    homeTeam: prediction.homeTeam,
    awayTeam: prediction.awayTeam,
    selection: prediction.selection,
    odds: prediction.odds,
    banker: prediction.banker,
    statsLine: prediction.statsLine
  };
}

function godLabel(god: GodKey) {
  return god === 'zeus' ? 'Zeus' : 'Athena';
}

function PickCard({ pick }: { pick: BoardPick }) {
  return (
    <article className={`god-pick-card ${pick.god} ${pick.banker ? 'banker' : ''}`}>
      <div className="god-pick-topline">
        <span className="league-label">{pick.country ? `${pick.country} · ` : ''}{pick.leagueName}</span>
        <span className="kickoff"><Clock3 size={14} />{timeLabel(pick.kickoff)}</span>
      </div>

      <div className="god-fixture-line">
        <strong>{pick.homeTeam}</strong>
        <span>vs</span>
        <strong>{pick.awayTeam}</strong>
      </div>

      <div className="god-selection-row">
        <div>
          <small>{godLabel(pick.god)} pick</small>
          <h3>{pick.selection}</h3>
        </div>
        {pick.odds != null && pick.odds > 1 && (
          <div className="god-price"><small>Odds</small><strong>{pick.odds.toFixed(2)}</strong></div>
        )}
      </div>

      <div className="minimal-stat-line">
        <span>{pick.statsLine}</span>
        {pick.banker && <b><Star size={13} />Banker</b>}
      </div>
    </article>
  );
}

export default function App() {
  const [data, setData] = useState<PredictionDashboard>(emptyPredictions);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [activeGod, setActiveGod] = useState<GodKey>('zeus');
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [loadError, setLoadError] = useState('');

  const applyIncoming = (incoming: PredictionDashboard) => {
    setData(incoming);
    const zeus = (incoming.zeusAutoPicks || []).map(toZeusPick);
    const athena = (incoming.athenaPicks || []).map(toAthenaPick);
    const all = [...zeus, ...athena];
    const firstDateWithPicks = incoming.window.days.find((date) => all.some((pick) => pick.date === date));
    setSelectedDate((current) => current && incoming.window.days.includes(current) ? current : firstDateWithPicks || incoming.window.days[0] || '');
    setLoadError('');
  };

  const refreshPicks = async () => {
    setLoading(true);
    try {
      applyIncoming(await loadPredictions());
    } catch {
      setLoadError('The picks feed is unavailable right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refreshPicks(); }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    if (!data.rebuilding) return;
    const timer = window.setTimeout(() => { void refreshPicks(); }, 8000);
    return () => window.clearTimeout(timer);
  }, [data.rebuilding]);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const zeusPicks = useMemo(() => (data.zeusAutoPicks || []).map(toZeusPick), [data.zeusAutoPicks]);
  const athenaPicks = useMemo(() => (data.athenaPicks || []).map(toAthenaPick), [data.athenaPicks]);

  const availableGods = useMemo(() => {
    const gods: GodKey[] = [];
    if (zeusPicks.length) gods.push('zeus');
    if (athenaPicks.length) gods.push('athena');
    return gods;
  }, [zeusPicks.length, athenaPicks.length]);

  useEffect(() => {
    if (availableGods.length && !availableGods.includes(activeGod)) setActiveGod(availableGods[0]);
  }, [availableGods, activeGod]);

  const activePicks = activeGod === 'zeus' ? zeusPicks : athenaPicks;
  const visiblePicks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activePicks
      .filter((pick) => pick.date === selectedDate)
      .filter((pick) => !q || `${pick.homeTeam} ${pick.awayTeam} ${pick.leagueName} ${pick.selection}`.toLowerCase().includes(q))
      .sort((a, b) => Number(b.banker) - Number(a.banker) || a.kickoff.localeCompare(b.kickoff));
  }, [activePicks, selectedDate, query]);

  const totalAvailable = zeusPicks.length + athenaPicks.length;
  const selectedDayCount = zeusPicks.filter((pick) => pick.date === selectedDate).length + athenaPicks.filter((pick) => pick.date === selectedDate).length;
  const selectedLabel = selectedDate ? dayLabel(selectedDate, data.window.days.indexOf(selectedDate)) : { short: 'Today', date: '' };

  return (
    <div className="app-shell clean-board-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Betynz home">
          <span className="brand-mark">ϟ</span>
          <span className="brand-copy"><strong>BETYNZ</strong><small>.com</small></span>
        </a>
        <label className="search-box">
          <Search size={18} />
          <input value={query} onChange={(event: { target: { value: string } }) => setQuery(event.target.value)} placeholder="Search teams or picks" />
        </label>
        <div className="header-actions">
          <div className="last-updated"><Clock3 size={14} /><span>Updated</span><strong>{updatedLabel(data.generatedAt)}</strong></div>
          <button className="install-button" onClick={install} disabled={!installPrompt}><Download size={17} />Install App</button>
          <button className="icon-button" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu /></button>
        </div>
      </header>

      <main id="top">
        <section className="hero compact-hero">
          <div className="hero-copy">
            <span className="eyebrow"><Sparkles size={14} /> GOD PICKS 2.9</span>
            <h1>Only qualified picks.<br /><span>Nothing forced.</span></h1>
            <p>Zeus and Athena publish their selections directly. Empty gods stay hidden so the board remains clean.</p>
            <div className="trust-row">
              <span><ShieldCheck size={15} /> No forced picks</span>
              <span><Target size={15} /> {totalAvailable} available picks</span>
              <span><CalendarDays size={15} /> Six-day board</span>
            </div>
          </div>
          <div className="hero-panel clean-hero-panel">
            <div className="hero-orbit"><span>PICKS</span><strong>{selectedDayCount}</strong><small>{selectedLabel.short} across available gods</small></div>
            <div className="hero-metric-grid">
              {zeusPicks.length > 0 && <span><small>Zeus</small><strong>{zeusPicks.length}</strong></span>}
              {athenaPicks.length > 0 && <span><small>Athena</small><strong>{athenaPicks.length}</strong></span>}
              <span><small>Leagues</small><strong>{data.metrics.pickLeagues}</strong></span>
              <span><small>Bankers</small><strong>{data.metrics.bankers + data.metrics.athenaShadowBankers}</strong></span>
            </div>
          </div>
        </section>

        <section className="date-bar" aria-label="Prediction dates">
          <div className="date-tabs">
            {data.window.days.map((date, index) => {
              const label = dayLabel(date, index);
              const count = zeusPicks.filter((pick) => pick.date === date).length + athenaPicks.filter((pick) => pick.date === date).length;
              return (
                <button key={date} className={selectedDate === date ? 'active' : ''} onClick={() => setSelectedDate(date)}>
                  <span>{label.short}</span><strong>{label.date}</strong><small>{count} picks</small>
                </button>
              );
            })}
          </div>
        </section>

        <section className="content-section god-board" id="board">
          <div className="section-heading clean-heading">
            <div>
              <span className="eyebrow"><BrainCircuit size={14} /> {selectedLabel.short.toUpperCase()} PICKS</span>
              <h2>Pick a god</h2>
            </div>
            <button className="refresh-button" onClick={refreshPicks} disabled={loading}><RefreshCw size={16} />{loading ? 'Refreshing' : 'Refresh'}</button>
          </div>

          {availableGods.length > 0 && (
            <div className="god-tabs" role="tablist" aria-label="Available god picks">
              {availableGods.map((god) => (
                <button key={god} role="tab" aria-selected={activeGod === god} className={activeGod === god ? 'active' : ''} onClick={() => setActiveGod(god)}>
                  <span>{god === 'zeus' ? 'ϟ' : 'Α'}</span>
                  <strong>{godLabel(god)}</strong>
                  <small>{(god === 'zeus' ? zeusPicks : athenaPicks).length}</small>
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="loading-panel"><div className="spinner" /><h3>Loading picks…</h3></div>
          ) : loadError ? (
            <div className="empty-panel compact"><Activity /><div><h3>{loadError}</h3></div></div>
          ) : availableGods.length === 0 || visiblePicks.length === 0 ? (
            <div className="empty-panel compact clean-empty"><ShieldCheck /><div><h3>No picks for today.</h3></div></div>
          ) : (
            <div className="god-pick-grid">
              {visiblePicks.map((pick) => <PickCard key={pick.id} pick={pick} />)}
            </div>
          )}
        </section>
      </main>

      <footer className="footer clean-footer">
        <span>© 2026 Betynz.com</span>
        <nav><a href="#">Responsible Gambling</a><a href="#">Terms</a><a href="#">Privacy</a></nav>
        <p>Football analytics only. 18+. No outcome is guaranteed.</p>
      </footer>

      <div className={`drawer-backdrop ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)} />
      <aside className={`drawer ${menuOpen ? 'open' : ''}`}>
        <button className="drawer-close" onClick={() => setMenuOpen(false)}><X /></button>
        <span className="eyebrow">BETYNZ</span>
        <a href="#top" onClick={() => setMenuOpen(false)}>Overview</a>
        <a href="#board" onClick={() => setMenuOpen(false)}>God picks</a>
      </aside>

      <nav className="mobile-nav clean-mobile-nav">
        <a href="#top"><Activity /><span>Home</span></a>
        <a href="#board"><Zap /><span>Picks</span></a>
        <button onClick={() => setMenuOpen(true)}><Menu /><span>Menu</span></button>
      </nav>
    </div>
  );
}
