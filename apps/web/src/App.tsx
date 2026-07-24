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
import { loadPredictions, rebuildAndLoadPredictions } from './api';
import type { GodKey, GodPublicPick, PredictionDashboard } from './types';

type BoardPick = GodPublicPick & { id: string };

const GOD_ORDER: GodKey[] = ['zeus', 'chronos', 'athena', 'ares'];
const GOD_META: Record<GodKey, { label: string; mark: string }> = {
  zeus: { label: 'Zeus', mark: 'ϟ' },
  chronos: { label: 'Chronos', mark: 'Ω' },
  athena: { label: 'Athena', mark: 'Α' },
  ares: { label: 'Ares', mark: '⚔' }
};

const emptyPredictions: PredictionDashboard = {
  source: 'offline',
  generatedAt: new Date().toISOString(),
  engineVersion: 'olympian-roles-3.0.4',
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
    chronosPublicPicks: 0,
    aresPublicPicks: 0,
    athenaShadowRuns: 0,
    athenaShadowPicks: 0,
    athenaShadowBankers: 0,
    athenaPublicPicks: 0
  },
  bankers: [],
  predictions: [],
  zeusAutoPicks: [],
  chronosPicks: [],
  athenaPicks: [],
  aresPicks: [],
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

function toBoardPick(pick: GodPublicPick): BoardPick {
  return { ...pick, id: `${pick.god}-${pick.fixtureId}` };
}

function PickCard({ pick }: { pick: BoardPick }) {
  const meta = GOD_META[pick.god];
  return (
    <article className={`god-pick-card ${pick.god} ${pick.banker ? 'banker' : ''}`}>
      <div className="god-pick-topline">
        <span className="league-label">{pick.country ? `${pick.country} · ` : ''}{pick.leagueName}</span>
        <span className="kickoff"><Clock3 size={14} />{timeLabel(pick.kickoff)}</span>
      </div>
      <div className="god-fixture-line">
        <strong>{pick.homeTeam}</strong><span>vs</span><strong>{pick.awayTeam}</strong>
      </div>
      <div className="god-selection-row">
        <div><small>{meta.label} pick</small><h3>{pick.selection}</h3></div>
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

  const picksByGod = useMemo<Record<GodKey, BoardPick[]>>(() => ({
    zeus: (data.zeusAutoPicks || []).filter((pick) => typeof pick.odds === 'number' && pick.odds > 1 && pick.odds < 1.60).map(toBoardPick),
    chronos: (data.chronosPicks || []).map(toBoardPick),
    athena: (data.athenaPicks || []).map(toBoardPick),
    ares: (data.aresPicks || []).map(toBoardPick)
  }), [data]);

  const allPicks = useMemo(() => GOD_ORDER.flatMap((god) => picksByGod[god]), [picksByGod]);
  const availableGods = useMemo(() => GOD_ORDER.filter((god) => picksByGod[god].some((pick) => pick.date === selectedDate)), [picksByGod, selectedDate]);

  const applyIncoming = (incoming: PredictionDashboard) => {
    setData(incoming);
    const incomingAll = [
      ...(incoming.zeusAutoPicks || []),
      ...(incoming.chronosPicks || []),
      ...(incoming.athenaPicks || []),
      ...(incoming.aresPicks || [])
    ];
    const firstDateWithPicks = incoming.window.days.find((date) => incomingAll.some((pick) => pick.date === date));
    setSelectedDate((current) => {
      const currentStillHasPicks = current
        && incoming.window.days.includes(current)
        && incomingAll.some((pick) => pick.date === current);
      if (currentStillHasPicks) return current;
      return firstDateWithPicks || (current && incoming.window.days.includes(current) ? current : incoming.window.days[0] || '');
    });
    setLoadError('');
  };

  const loadPicks = async () => {
    setLoading(true);
    try { applyIncoming(await loadPredictions()); }
    catch { setLoadError('The picks feed is unavailable right now.'); }
    finally { setLoading(false); }
  };

  const refreshPicks = async () => {
    setLoading(true);
    try {
      const incoming = await rebuildAndLoadPredictions();
      applyIncoming(incoming.dashboard);
    } catch { setLoadError('The rebuild could not be completed right now.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void loadPicks(); }, []);
  useEffect(() => {
    const handler = (event: Event) => { event.preventDefault(); setInstallPrompt(event as BeforeInstallPromptEvent); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  useEffect(() => {
    if (!data.rebuilding) return;
    const timer = window.setTimeout(() => { void loadPicks(); }, 8000);
    return () => window.clearTimeout(timer);
  }, [data.rebuilding]);
  useEffect(() => {
    if (availableGods.length && !availableGods.includes(activeGod)) setActiveGod(availableGods[0]);
  }, [availableGods, activeGod]);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const activePicks = picksByGod[activeGod];
  const visiblePicks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activePicks
      .filter((pick) => pick.date === selectedDate)
      .filter((pick) => !q || `${pick.homeTeam} ${pick.awayTeam} ${pick.leagueName} ${pick.selection}`.toLowerCase().includes(q))
      .sort((a, b) => Number(b.banker) - Number(a.banker) || a.kickoff.localeCompare(b.kickoff));
  }, [activePicks, selectedDate, query]);

  const selectedDayCount = allPicks.filter((pick) => pick.date === selectedDate).length;
  const selectedLabel = selectedDate ? dayLabel(selectedDate, data.window.days.indexOf(selectedDate)) : { short: 'Today', date: '' };

  return (
    <div className="app-shell clean-board-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Betynz home">
          <span className="brand-mark">ϟ</span><span className="brand-copy"><strong>BETYNZ</strong><small>.com</small></span>
        </a>
        <label className="search-box"><Search size={18} /><input value={query} onChange={(event: { target: { value: string } }) => setQuery(event.target.value)} placeholder="Search teams or picks" /></label>
        <div className="header-actions">
          <div className="last-updated"><Clock3 size={14} /><span>Updated</span><strong>{updatedLabel(data.generatedAt)}</strong></div>
          <button className="install-button" onClick={install} disabled={!installPrompt}><Download size={17} />Install App</button>
          <button className="icon-button" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu /></button>
        </div>
      </header>

      <main id="top">
        <section className="hero compact-hero">
          <div className="hero-copy">
            <span className="eyebrow"><Sparkles size={14} /> OLYMPIAN PICKS 3.0.4</span>
            <h1>Only qualified picks.<br /><span>Nothing forced.</span></h1>
            <p>Chronos, Athena and Ares publish their picks. Zeus posts only approved bankers below 1.60 odds.</p>
            <div className="trust-row">
              <span><ShieldCheck size={15} /> No forced picks</span>
              <span><Target size={15} /> {allPicks.length} available picks</span>
              <span><CalendarDays size={15} /> Six-day board</span>
            </div>
          </div>
          <div className="hero-panel clean-hero-panel">
            <div className="hero-orbit"><span>PICKS</span><strong>{selectedDayCount}</strong><small>{selectedLabel.short} across available gods</small></div>
            <div className="hero-metric-grid">
              {availableGods.map((god) => <span key={god}><small>{GOD_META[god].label}</small><strong>{picksByGod[god].filter((pick) => pick.date === selectedDate).length}</strong></span>)}
              <span><small>Leagues</small><strong>{data.metrics.pickLeagues}</strong></span>
            </div>
          </div>
        </section>

        <section className="date-bar" aria-label="Prediction dates">
          <div className="date-tabs">
            {data.window.days.map((date, index) => {
              const label = dayLabel(date, index);
              const count = allPicks.filter((pick) => pick.date === date).length;
              return <button key={date} className={selectedDate === date ? 'active' : ''} onClick={() => setSelectedDate(date)}><span>{label.short}</span><strong>{label.date}</strong><small>{count} picks</small></button>;
            })}
          </div>
        </section>

        <section className="content-section god-board" id="board">
          <div className="section-heading clean-heading">
            <div><span className="eyebrow"><BrainCircuit size={14} /> {selectedLabel.short.toUpperCase()} PICKS</span><h2>{availableGods.length ? 'Pick a god' : 'Today’s picks'}</h2></div>
            <button className="refresh-button" onClick={refreshPicks} disabled={loading}><RefreshCw size={16} />{loading ? 'Refreshing' : 'Refresh'}</button>
          </div>

          {availableGods.length > 0 && (
            <div className="god-tabs" role="tablist" aria-label="Available god picks">
              {availableGods.map((god) => (
                <button key={god} role="tab" aria-selected={activeGod === god} className={activeGod === god ? 'active' : ''} onClick={() => setActiveGod(god)}>
                  <span>{GOD_META[god].mark}</span><strong>{GOD_META[god].label}</strong><small>{picksByGod[god].filter((pick) => pick.date === selectedDate).length}</small>
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="loading-panel"><div className="spinner" /><h3>Loading picks…</h3></div>
          ) : loadError ? (
            <div className="empty-panel compact"><Activity /><div><h3>{loadError}</h3></div></div>
          ) : availableGods.length === 0 || visiblePicks.length === 0 ? (
            <div className="empty-panel compact clean-empty"><ShieldCheck /><div><h3>No qualified picks for this date.</h3><p>{data.metrics.fixtures} fixtures scanned · {data.metrics.pricedFixtures} with complete 1X2 odds.</p></div></div>
          ) : (
            <div className="god-pick-grid">{visiblePicks.map((pick) => <PickCard key={pick.id} pick={pick} />)}</div>
          )}
        </section>
      </main>

      <footer className="footer clean-footer">
        <span>© 2026 Betynz.com</span><nav><a href="#">Responsible Gambling</a><a href="#">Terms</a><a href="#">Privacy</a></nav><p>Football analytics only. 18+. No outcome is guaranteed.</p>
      </footer>
      <div className={`drawer-backdrop ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)} />
      <aside className={`drawer ${menuOpen ? 'open' : ''}`}><button className="drawer-close" onClick={() => setMenuOpen(false)}><X /></button><span className="eyebrow">BETYNZ</span><a href="#top" onClick={() => setMenuOpen(false)}>Overview</a><a href="#board" onClick={() => setMenuOpen(false)}>God picks</a></aside>
      <nav className="mobile-nav clean-mobile-nav"><a href="#top"><Activity /><span>Home</span></a><a href="#board"><Zap /><span>Picks</span></a><button onClick={() => setMenuOpen(true)}><Menu /><span>Menu</span></button></nav>
    </div>
  );
}
