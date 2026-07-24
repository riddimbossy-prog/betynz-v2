import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  BrainCircuit,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Download,
  Flame,
  History,
  Info,
  ListPlus,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trophy,
  TrendingUp,
  X,
  Zap
} from 'lucide-react';
import { loadHistoricalDashboard, loadPredictions } from './api';
import type { HistoricalDashboard, Prediction, PredictionDashboard, UpcomingFixture } from './types';

const emptyPredictions: PredictionDashboard = {
  source: 'offline',
  generatedAt: new Date().toISOString(),
  engineVersion: 'zeus-chronos-ares-2.8.2',
  currentEngineReady: false,
  rebuilding: false,
  dataStatus: null,
  window: { from: '', to: '', days: [] },
  metrics: { fixtures: 0, picks: 0, fullPicks: 0, provisionalPicks: 0, bankers: 0, leagues: 0, pickLeagues: 0, lowOddsUpgrades: 0, pricedFixtures: 0, zeusAutoPicks: 0, streakFavorites: 0, aresCandidates: 0, aresWatchlist: 0 },
  bankers: [],
  predictions: [],
  zeusAutoPicks: [],
  streakFavorites: [],
  aresWatchlist: [],
  radarFixtures: []
};

const emptyHistory: HistoricalDashboard = {
  source: 'demo',
  lastUpdated: new Date().toISOString(),
  metrics: { matches: 0, leagues: 0, patterns: 0, validated: 0 }
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

function confidenceLabel(value: number) {
  if (value >= 85) return 'Elite';
  if (value >= 80) return 'Strong';
  return 'Qualified';
}

function evidenceValue(prediction: Prediction, key: string, fallback = '—') {
  const value = prediction.evidence[key];
  return value == null ? fallback : String(value);
}

function engineName(key: string) {
  const map: Record<string, string> = { chronos: 'Historical odds comparison', athena: 'Stats + HT/FT validation', zeus: 'One-tip market battle', leonidas: 'Rejection gate' };
  return map[key] || key;
}

function PredictionCard({ prediction, onExplain, inList, onToggleList }: {
  prediction: Prediction;
  onExplain: () => void;
  inList: boolean;
  onToggleList: () => void;
}) {
  const passes = prediction.engines.filter((engine) => engine.pass).length;
  const isAres = prediction.qualification === 'ARES_STREAK_FAVOURITE' || prediction.qualification === 'ARES_WATCHLIST';
  const isWatchlist = prediction.qualification === 'ARES_WATCHLIST';
  return (
    <article className={`prediction-card ${prediction.banker ? 'banker-card' : ''} ${prediction.tier === 'provisional' ? 'provisional-card' : ''} ${isWatchlist ? 'watchlist-card' : ''}`}>
      <div className="prediction-topline">
        <div>
          <span className="league-label">{prediction.country ? `${prediction.country} · ` : ''}{prediction.leagueName}</span>
          <span className="kickoff"><Clock3 size={14} />{timeLabel(prediction.kickoff)}</span>
        </div>
        <div className="card-badges">
          {prediction.qualification === 'ARES_STREAK_FAVOURITE' && <span className="ares-badge"><Target size={13} />Ares Favorite</span>}
          {prediction.qualification === 'ARES_WATCHLIST' && <span className="watchlist-badge"><Info size={13} />Ares Watchlist</span>}
          {prediction.tier === 'provisional' && !isWatchlist && <span className="provisional-badge"><Info size={13} />Provisional</span>}
          {prediction.upgraded && <span className="upgrade-badge"><TrendingUp size={13} />Upgraded</span>}
          {prediction.banker && <span className="banker-badge"><Star size={13} />Banker</span>}
        </div>
      </div>

      <div className="fixture-line">
        <strong>{prediction.homeTeam}</strong>
        <span>vs</span>
        <strong>{prediction.awayTeam}</strong>
      </div>

      <div className="selection-panel">
        <div><small>{prediction.qualification === 'ARES_STREAK_FAVOURITE' ? 'Ares streak favorite' : prediction.qualification === 'ARES_WATCHLIST' ? 'Price-qualified watchlist — not a pick' : prediction.tier === 'full' ? 'Full Chronos selection' : 'Provisional odds selection'}</small><h3>{prediction.selection}</h3></div>
        <div className="price"><small>Odds</small><strong>{prediction.odds.toFixed(2)}</strong></div>
      </div>

      <p className="plain-summary">{prediction.summary}</p>

      <div className="stat-strip">
        {isAres ? <>
          <span><small>Ares score</small><strong>{Math.round(Number(prediction.evidence.aresScore ?? 0))}%</strong></span>
          <span><small>Confirmations</small><strong>{Math.round(Number(prediction.evidence.aresConfirmations ?? 0))}</strong></span>
          <span><small>Fair price</small><strong>{Math.round(Number(prediction.evidence.marketFairProbability ?? 0))}%</strong></span>
          <span><small>Checks</small><strong>{passes}/4</strong></span>
        </> : <>
          <span><small>Model</small><strong>{Math.round(prediction.probability)}%</strong></span>
          <span><small>History</small><strong>{Math.round(Number(prediction.evidence.historicalHitRate ?? 0))}%</strong></span>
          {prediction.tier === 'provisional'
            ? <span><small>Price fit</small><strong>{Math.round(Number(prediction.evidence.oddsPatternFit ?? 0))}%</strong></span>
            : <span><small>Edge</small><strong className={prediction.edge >= 0 ? 'positive' : ''}>{prediction.edge >= 0 ? '+' : ''}{prediction.edge.toFixed(1)}%</strong></span>}
          <span><small>Engines</small><strong>{passes}/4</strong></span>
        </>}
      </div>

      <div className="engine-row">
        {prediction.engines.map((engine) => (
          <span className={engine.pass ? 'engine-pass' : 'engine-fail'} key={engine.key} title={engine.note}>
            {engine.pass ? <Check size={12} /> : <X size={12} />}{engine.name}
          </span>
        ))}
      </div>

      <div className="card-footer">
        <button className="why-button" onClick={onExplain}><Info size={16} />{isWatchlist ? 'Why not a pick?' : 'Why this pick?'}<ChevronRight size={16} /></button>
        {!isWatchlist && <button className={`list-button ${inList ? 'added' : ''}`} onClick={onToggleList}>
          {inList ? <Check size={16} /> : <ListPlus size={16} />}{inList ? 'Added' : 'Add to list'}
        </button>}
      </div>
    </article>
  );
}

function RadarCard({ fixture, prediction }: { fixture: UpcomingFixture; prediction?: Prediction }) {
  return (
    <article className="radar-card">
      <div className="radar-topline">
        <div>
          <span className="league-label">{fixture.country ? `${fixture.country} · ` : ''}{fixture.leagueName}</span>
          <span className="kickoff"><Clock3 size={14} />{timeLabel(fixture.kickoff)}</span>
        </div>
        <span className={prediction ? 'radar-qualified' : 'radar-monitoring'}>{prediction ? 'Qualified pick' : 'Monitoring'}</span>
      </div>
      <div className="fixture-line radar-fixture-line">
        <strong>{fixture.homeTeam}</strong>
        <span>vs</span>
        <strong>{fixture.awayTeam}</strong>
      </div>
      <div className="radar-odds" aria-label="One X Two odds">
        <span><small>Home</small><strong>{fixture.odds.home?.toFixed(2) ?? '—'}</strong></span>
        <span><small>Draw</small><strong>{fixture.odds.draw?.toFixed(2) ?? '—'}</strong></span>
        <span><small>Away</small><strong>{fixture.odds.away?.toFixed(2) ?? '—'}</strong></span>
      </div>
      <div className="radar-footer">
        <span>{fixture.oddsSource || fixture.provider || 'BetExplorer'} prices</span>
        {prediction ? <strong>{prediction.selection} · {prediction.odds.toFixed(2)}</strong> : <small>No pick forced</small>}
      </div>
    </article>
  );
}


function ZeusAutoCard({ prediction, rank, onExplain }: { prediction: Prediction; rank: number; onExplain: () => void }) {
  const signal = String(prediction.evidence.confrontationSignal ?? 'Statistical agreement');
  return (
    <article className="zeus-auto-card">
      <span className="zeus-auto-rank">#{rank}</span>
      <div className="zeus-auto-copy">
        <small>{prediction.country ? `${prediction.country} · ` : ''}{prediction.leagueName} · {timeLabel(prediction.kickoff)} {prediction.tier === 'provisional' ? '· Provisional' : '· Fully validated'}</small>
        <h3>{prediction.homeTeam} <span>vs</span> {prediction.awayTeam}</h3>
        <p>{signal}</p>
      </div>
      <div className="zeus-auto-pick">
        <small>Zeus chose</small>
        <strong>{prediction.selection}</strong>
        <b>{prediction.odds.toFixed(2)}</b>
      </div>
      <button className="why-button" onClick={onExplain} aria-label={`Why ${prediction.selection}`}><Info size={16} />Why?</button>
    </article>
  );
}

export default function App() {
  const [data, setData] = useState<PredictionDashboard>(emptyPredictions);
  const [history, setHistory] = useState<HistoricalDashboard>(emptyHistory);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedPrediction, setSelectedPrediction] = useState<Prediction | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [analysisList, setAnalysisList] = useState<Set<string>>(new Set());
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    Promise.allSettled([loadPredictions(), loadHistoricalDashboard()]).then(([predictionsResult, historyResult]) => {
      if (predictionsResult.status === 'fulfilled') {
        const incoming = predictionsResult.value;
        setData(incoming);
        const visiblePicks = incoming.zeusAutoPicks?.length ? incoming.zeusAutoPicks : incoming.predictions;
        const firstDateWithPicks = incoming.window.days.find((date) => visiblePicks.some((prediction) => prediction.date === date));
        setSelectedDate(firstDateWithPicks || incoming.window.days[0] || '');
        setLoadError('');
      } else {
        setLoadError('The picks API did not respond. Refresh the board after the API deployment finishes.');
      }
      if (historyResult.status === 'fulfilled') setHistory(historyResult.value);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const refreshPicks = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const incoming = await loadPredictions();
      setData(incoming);
      const visiblePicks = incoming.zeusAutoPicks?.length ? incoming.zeusAutoPicks : incoming.predictions;
      const preferredDate = incoming.window.days.find((date) => visiblePicks.some((prediction) => prediction.date === date));
      setSelectedDate((current) => current && incoming.window.days.includes(current) && visiblePicks.some((prediction) => prediction.date === current)
        ? current
        : preferredDate || incoming.window.days[0] || '');
    } catch {
      setLoadError('The picks API is still unavailable. Check that the Render API deployment is live.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!data.rebuilding) return;
    const timer = window.setTimeout(() => { void refreshPicks(); }, 8000);
    return () => window.clearTimeout(timer);
  }, [data.rebuilding]);

  const datePredictions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.predictions
      .filter((prediction) => prediction.date === selectedDate)
      .filter((prediction) => !q || `${prediction.homeTeam} ${prediction.awayTeam} ${prediction.leagueName} ${prediction.selection}`.toLowerCase().includes(q))
      .sort((a, b) => b.confidence - a.confidence || a.kickoff.localeCompare(b.kickoff));
  }, [data.predictions, selectedDate, query]);

  const fullPredictions = useMemo(() => datePredictions.filter((prediction) => prediction.tier === 'full'), [datePredictions]);
  const provisionalPredictions = useMemo(() => datePredictions.filter((prediction) => prediction.tier === 'provisional'), [datePredictions]);
  const bankers = useMemo(() => fullPredictions.filter((prediction) => prediction.banker).slice(0, 3), [fullPredictions]);
  const streakFavorites = useMemo(() => (data.streakFavorites ?? []).filter((prediction) => prediction.date === selectedDate), [data.streakFavorites, selectedDate]);
  const aresWatchlist = useMemo(() => (data.aresWatchlist ?? []).filter((prediction) => prediction.date === selectedDate), [data.aresWatchlist, selectedDate]);
  const zeusAutoPicks = useMemo(() => (data.zeusAutoPicks ?? data.predictions).filter((prediction) => prediction.date === selectedDate).slice(0, 12), [data.zeusAutoPicks, data.predictions, selectedDate]);
  const regular = useMemo(() => fullPredictions.filter((prediction) => !prediction.banker), [fullPredictions]);
  const predictionByFixture = useMemo(() => new Map(data.predictions.map((prediction) => [prediction.fixtureId, prediction])), [data.predictions]);
  const radarFixtures = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data.radarFixtures ?? [])
      .filter((fixture) => fixture.date === selectedDate)
      .filter((fixture) => !q || `${fixture.homeTeam} ${fixture.awayTeam} ${fixture.leagueName} ${fixture.country}`.toLowerCase().includes(q))
      .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  }, [data.radarFixtures, selectedDate, query]);
  const selectedLabel = selectedDate ? dayLabel(selectedDate, data.window.days.indexOf(selectedDate)) : { short: 'Today', date: '' };
  const dataSourceLabel = data.dataStatus?.source === 'provider-rescue'
    ? 'Rescue feed active'
    : data.dataStatus?.source === 'retained-database'
      ? 'Protected saved feed'
      : data.dataStatus?.source === 'fresh-provider'
        ? 'Fresh provider feed'
        : data.currentEngineReady
          ? 'Engine version'
          : data.rebuilding
            ? 'Engine syncing'
            : 'Fallback feed';

  const toggleList = (fixtureId: string) => {
    setAnalysisList((current) => {
      const next = new Set(current);
      if (next.has(fixtureId)) next.delete(fixtureId);
      else next.add(fixtureId);
      return next;
    });
  };

  const addAllBankers = () => {
    setAnalysisList((current) => {
      const next = new Set(current);
      bankers.forEach((prediction) => next.add(prediction.fixtureId));
      return next;
    });
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Betynz home">
          <span className="brand-mark">ϟ</span>
          <span className="brand-copy"><strong>BETYNZ</strong><small>.com</small></span>
        </a>
        <label className="search-box">
          <Search size={18} />
          <input value={query} onChange={(event: { target: { value: string } }) => setQuery(event.target.value)} placeholder="Search teams, leagues or picks" />
        </label>
        <div className="header-actions">
          <div className="last-updated"><Clock3 size={14} /><span>Updated</span><strong>{updatedLabel(data.generatedAt)}</strong></div>
          <button className="install-button" onClick={install} disabled={!installPrompt}><Download size={17} />Install App</button>
          <button className="analysis-pill"><ListPlus size={17} />Analysis List <b>{analysisList.size}</b></button>
          <button className="icon-button" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu /></button>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow"><Sparkles size={14} /> ZEUS + ARES AUTO PICKS 2.8.2</span>
            <h1>One battle. One tip.<br /><span>Ares finds the strongest sub-1.60 streak favorites.</span></h1>
            <p>Zeus still makes every market compete, while Ares independently grades every clear 1X2 favorite priced from 1.19 to 1.59 using two-sided or strong one-sided streak support.</p>
            <div className="hero-actions">
              <a className="primary-button" href="#bankers"><Star size={18} />See Today’s Bankers</a>
              <a className="secondary-button" href="#board"><BarChart3 size={18} />Open Full Board</a>
            </div>
            <div className="trust-row">
              <span><ShieldCheck size={15} /> No forced picks</span>
              <span><TrendingUp size={15} /> Sub-1.19 picks need a strict upgrade</span>
              <span><History size={15} /> {history.metrics.matches.toLocaleString()} settled matches</span>
            </div>
          </div>
          <div className="hero-panel">
            <div className="hero-orbit"><span>ZEUS</span><strong>{data.metrics.picks}</strong><small>Zeus one-tip selections over six days</small></div>
            <div className="hero-metric-grid">
              <span><small>Bankers</small><strong>{data.metrics.bankers}</strong></span>
              <span><small>Priced fixtures</small><strong>{data.metrics.pricedFixtures}</strong></span>
              <span><small>Ares &lt;1.60</small><strong>{data.metrics.streakFavorites}</strong></span>
              <span><small>Auto picks</small><strong>{data.metrics.zeusAutoPicks}</strong></span>
            </div>
          </div>
        </section>

        <section className="date-bar" aria-label="Prediction dates">
          <div className="date-tabs">
            {data.window.days.map((date, index) => {
              const label = dayLabel(date, index);
              const count = data.predictions.filter((prediction) => prediction.date === date).length;
              const fixtureCount = (data.radarFixtures ?? []).filter((fixture) => fixture.date === date).length;
              return (
                <button key={date} className={selectedDate === date ? 'active' : ''} onClick={() => setSelectedDate(date)}>
                  <span>{label.short}</span><strong>{label.date}</strong><small>{count} picks · {fixtureCount} fixtures</small>
                </button>
              );
            })}
          </div>
        </section>

        <section className="metrics-row">
          <article><span><Target /></span><div><small>{selectedLabel.short} qualified picks</small><strong>{datePredictions.length}</strong></div></article>
          <article><span><Trophy /></span><div><small>{selectedLabel.short} bankers</small><strong>{bankers.length}</strong></div></article>
          <article><span><BrainCircuit /></span><div><small>{dataSourceLabel}</small><strong>{data.engineVersion.split('-').at(-1) || '2.8.2'}</strong></div></article>
          <article><span><Target /></span><div><small>{selectedLabel.short} Ares favorites</small><strong>{streakFavorites.length}</strong></div></article>
        </section>

        {data.dataStatus && data.dataStatus.source !== 'fresh-provider' && (
          <section className={`sync-status-banner ${data.dataStatus.source === 'retained-database' ? 'retained' : 'rescued'}`}>
            <Activity size={18} />
            <div><strong>{data.dataStatus.source === 'retained-database' ? 'Saved fixture protection is active' : 'Automatic provider rescue is active'}</strong><span>{data.dataStatus.message}</span></div>
          </section>
        )}

        <section className="content-section ares-section" id="ares-favorites">
          <div className="section-heading">
            <div><span className="eyebrow"><Target size={14} /> ARES STREAK FAVORITES</span><h2>Favorites below 1.60 with refined streak grading</h2><p>Ares now runs independently from Zeus. A team may qualify through two-sided streak agreement or one strong directional streak backed by the sub-1.60 market, while contradictory favorites remain blocked.</p></div>
            <span className="board-count">{streakFavorites.length} picks · {aresWatchlist.length} monitored</span>
          </div>
          <div className="ares-diagnostic-strip">
            <span><small>Price-qualified candidates</small><strong>{streakFavorites.length + aresWatchlist.length}</strong></span>
            <span><small>Published Ares picks</small><strong>{streakFavorites.length}</strong></span>
            <span><small>Watchlist only</small><strong>{aresWatchlist.length}</strong></span>
          </div>
          {streakFavorites.length === 0 ? (
            <div className="empty-panel compact"><ShieldCheck /><div><h3>No Ares favorite qualified for this day</h3><p>{aresWatchlist.length ? `${aresWatchlist.length} sub-1.60 favorite${aresWatchlist.length === 1 ? '' : 's'} were found, but they remain on the watchlist because the streak sample, agreement or contradiction gate is not strong enough.` : 'No complete 1X2 favorite between 1.19 and 1.59 was available for this date.'}</p></div></div>
          ) : (
            <div className="prediction-grid ares-grid">
              {streakFavorites.map((prediction) => (
                <PredictionCard
                  key={`ares-${prediction.fixtureId}`}
                  prediction={prediction}
                  onExplain={() => setSelectedPrediction(prediction)}
                  inList={analysisList.has(prediction.fixtureId)}
                  onToggleList={() => toggleList(prediction.fixtureId)}
                />
              ))}
            </div>
          )}
          {aresWatchlist.length > 0 && (
            <div className="ares-watchlist-section">
              <div className="watchlist-heading"><div><span className="eyebrow"><Info size={14} /> ARES WATCHLIST</span><h3>Sub-1.60 favorites that are not picks yet</h3><p>Open a card to see the exact missing streak confirmation or contradiction.</p></div><span className="board-count">{aresWatchlist.length} watching</span></div>
              <div className="prediction-grid ares-grid">
                {aresWatchlist.map((prediction) => (
                  <PredictionCard
                    key={`ares-watch-${prediction.fixtureId}`}
                    prediction={prediction}
                    onExplain={() => setSelectedPrediction(prediction)}
                    inList={false}
                    onToggleList={() => undefined}
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="content-section zeus-auto-section" id="zeus-auto">
          <div className="section-heading">
            <div><span className="eyebrow"><Zap size={14} /> ZEUS AUTO PICKS</span><h2>One final tip per qualified match</h2><p>Wins, draws, losses, no-win, no-draw, unbeaten, O/U 2.5 and HT/FT splits all enter the market competition.</p></div>
            <span className="board-count">{zeusAutoPicks.length} auto picks</span>
          </div>
          {zeusAutoPicks.length === 0 ? (
            <div className="empty-panel compact"><ShieldCheck /><div><h3>{loadError || (data.rebuilding ? 'Zeus is rebuilding the Auto Picks feed' : 'No Zeus pick survived for this day')}</h3><p>{loadError ? 'The page is loaded, but it could not receive the latest prediction feed.' : data.rebuilding ? 'The API found fixtures but no current-engine picks, so it started a safe rebuild. Refresh shortly.' : 'The engine did not force a tip after the streak and Leonidas checks. Try another date or refresh the feed.'}</p><button className="why-button" onClick={refreshPicks} disabled={loading}><Activity size={16} />{loading ? 'Refreshing…' : 'Refresh picks'}</button></div></div>
          ) : (
            <div className="zeus-auto-list">
              {zeusAutoPicks.map((prediction, index) => (
                <ZeusAutoCard key={prediction.fixtureId} prediction={prediction} rank={index + 1} onExplain={() => setSelectedPrediction(prediction)} />
              ))}
            </div>
          )}
        </section>

        <section className="content-section banker-section" id="bankers">
          <div className="section-heading">
            <div><span className="eyebrow"><Flame size={14} /> STRICTEST SECTION</span><h2>{selectedLabel.short}’s Bankers</h2><p>The top three picks only when all four engines agree. Banker does not mean guaranteed.</p></div>
            {bankers.length > 0 && <button className="add-all-button" onClick={addAllBankers}><ListPlus size={17} />Add all {bankers.length}</button>}
          </div>
          {bankers.length > 0 ? (
            <div className="banker-grid">
              {bankers.map((prediction) => (
                <PredictionCard
                  key={prediction.fixtureId}
                  prediction={prediction}
                  onExplain={() => setSelectedPrediction(prediction)}
                  inList={analysisList.has(prediction.fixtureId)}
                  onToggleList={() => toggleList(prediction.fixtureId)}
                />
              ))}
            </div>
          ) : (
            <div className="empty-panel compact">
              <ShieldCheck />
              <div><h3>No banker passed for this day</h3><p>Leonidas rejected every candidate that did not meet the strictest limits.</p></div>
            </div>
          )}
        </section>

        <section className="engine-consensus content-section">
          <div className="section-heading">
            <div><span className="eyebrow">THE OLYMPIAN ROOM</span><h2>How every pick is checked</h2></div>
            <span className="status-pill">4 validators + Ares</span>
          </div>
          <div className="engine-grid">
            <article><span>◴</span><div><h3>Chronos</h3><p>Compares the fixture with the closest historical 1X2 and goal-odds profiles.</p></div></article>
            <article><span>Α</span><div><h3>Athena</h3><p>Validates form, venue splits, O/U 2.5 streaks and HT/FT overall, home and away records.</p></div></article>
            <article><span>ϟ</span><div><h3>Zeus</h3><p>Makes every eligible market compete and publishes only the highest battle score.</p></div></article>
            <article><span>ΑΡ</span><div><h3>Ares</h3><p>Grades every 1.19-1.59 win favorite independently, publishes strong streak matches and explains every watchlist rejection.</p></div></article>
            <article><span>Λ</span><div><h3>Leonidas</h3><p>Rejects conflicting streaks, thin samples, weak value and failed 1.19 upgrades.</p></div></article>
          </div>
        </section>

        <section className="content-section board-section" id="board">
          <div className="section-heading">
            <div><span className="eyebrow"><CalendarDays size={14} /> {selectedLabel.short.toUpperCase()} BOARD</span><h2>All qualified predictions</h2><p>One best market per fixture, explained in simple English.</p></div>
            <span className="board-count">{regular.length} regular + {bankers.length} bankers</span>
          </div>

          {loading ? (
            <div className="loading-panel"><div className="spinner" /><h3>Chronos is loading the six-day board…</h3></div>
          ) : data.source === 'offline' ? (
            <div className="empty-panel"><Info /><div><h3>The live prediction API is unavailable</h3><p>No demo picks are shown. Check the frontend API URL and Render CORS settings.</p></div></div>
          ) : fullPredictions.length === 0 ? (
            <div className="empty-panel"><ShieldCheck /><div><h3>No qualified picks for {selectedLabel.short.toLowerCase()}</h3><p>This is normal. Betynz will not force a selection when the statistics or odds do not agree.</p></div></div>
          ) : (
            <div className="prediction-grid">
              {regular.map((prediction) => (
                <PredictionCard
                  key={prediction.fixtureId}
                  prediction={prediction}
                  onExplain={() => setSelectedPrediction(prediction)}
                  inList={analysisList.has(prediction.fixtureId)}
                  onToggleList={() => toggleList(prediction.fixtureId)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="content-section provisional-section" id="provisional">
          <div className="section-heading">
            <div><span className="eyebrow"><Info size={14} /> LIMITED LOCAL HISTORY</span><h2>Provisional global-odds picks</h2><p>These use complete 1X2 prices and closely matched historical odds profiles. They are medium risk and never qualify as Bankers.</p></div>
            <span className="board-count">{provisionalPredictions.length} provisional</span>
          </div>
          {provisionalPredictions.length === 0 ? (
            <div className="empty-panel compact"><ShieldCheck /><div><h3>No provisional pick passed for this day</h3><p>The price pattern or model edge was not strong enough.</p></div></div>
          ) : (
            <div className="prediction-grid">
              {provisionalPredictions.map((prediction) => (
                <PredictionCard
                  key={prediction.fixtureId}
                  prediction={prediction}
                  onExplain={() => setSelectedPrediction(prediction)}
                  inList={analysisList.has(prediction.fixtureId)}
                  onToggleList={() => toggleList(prediction.fixtureId)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="content-section radar-section" id="radar">
          <div className="section-heading">
            <div><span className="eyebrow"><Activity size={14} /> MATCH RADAR</span><h2>Every priced fixture found</h2><p>This is the complete fixture-and-1X2-odds feed for the selected day. A fixture can appear here without becoming a prediction.</p></div>
            <span className="board-count">{radarFixtures.length} priced fixtures</span>
          </div>
          {radarFixtures.length === 0 ? (
            <div className="empty-panel compact"><Info /><div><h3>No priced fixtures captured for this day</h3><p>The next sync will continue scanning the wider league catalogue.</p></div></div>
          ) : (
            <div className="radar-grid">
              {radarFixtures.map((fixture) => (
                <RadarCard key={fixture.id} fixture={fixture} prediction={predictionByFixture.get(fixture.id)} />
              ))}
            </div>
          )}
        </section>

        <section className="method-note">
          <Zap />
          <div><h3>The 1.19 minimum is enforced</h3><p>When a selected market is priced below 1.19, Betynz tests the next stronger related market. The upgrade is published only when it passes stricter probability, sample and contradiction checks.</p></div>
        </section>
      </main>

      <footer className="footer">
        <span>© 2026 Betynz.com</span>
        <nav><a href="#">Responsible Gambling</a><a href="#">Terms</a><a href="#">Privacy</a><a href="#">Disclaimer</a></nav>
        <p>Football analytics only. 18+. No outcome is guaranteed.</p>
      </footer>

      <div className={`drawer-backdrop ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)} />
      <aside className={`drawer ${menuOpen ? 'open' : ''}`}>
        <button className="drawer-close" onClick={() => setMenuOpen(false)}><X /></button>
        <span className="eyebrow">BETYNZ NAVIGATION</span>
        <a href="#top" onClick={() => setMenuOpen(false)}>Overview</a>
        <a href="#ares-favorites" onClick={() => setMenuOpen(false)}>Ares Favorites</a>
        <a href="#zeus-auto" onClick={() => setMenuOpen(false)}>Zeus Auto Picks</a>
        <a href="#bankers" onClick={() => setMenuOpen(false)}>Bankers</a>
        <a href="#board" onClick={() => setMenuOpen(false)}>Full board</a>
        <a href="#provisional" onClick={() => setMenuOpen(false)}>Provisional picks</a>
        <a href="#radar" onClick={() => setMenuOpen(false)}>Match Radar</a>
        <a href="#" onClick={() => setMenuOpen(false)}>Chronos Lab</a>
        <a href="#" onClick={() => setMenuOpen(false)}>Proof</a>
      </aside>

      <div className={`modal-backdrop ${selectedPrediction ? 'open' : ''}`} onClick={() => setSelectedPrediction(null)} />
      <aside className={`explanation-drawer ${selectedPrediction ? 'open' : ''}`}>
        {selectedPrediction && (
          <>
            <button className="drawer-close" onClick={() => setSelectedPrediction(null)}><X /></button>
            <span className="eyebrow"><BrainCircuit size={14} /> WHY THIS PICK?</span>
            <h2>{selectedPrediction.selection}</h2>
            <p className="modal-fixture">{selectedPrediction.homeTeam} vs {selectedPrediction.awayTeam}</p>
            <div className="modal-summary"><ShieldCheck /><p>{selectedPrediction.summary}</p></div>
            {selectedPrediction.qualification === 'ARES_STREAK_FAVOURITE' && (
              <div className="ares-note"><Target /><div><strong>{evidenceValue(selectedPrediction, 'aresGrade')} Ares streak favorite</strong><p>The favorite is priced from 1.19 to 1.59 and passed the refined streak, market and contradiction gates. This is still a model selection, not a guaranteed result.</p></div></div>
            )}
            {selectedPrediction.qualification === 'ARES_WATCHLIST' && (
              <div className="watchlist-note"><Info /><div><strong>Ares watchlist — not a pick</strong><p>This favorite is inside the price range but has not passed every required streak or contradiction check.</p></div></div>
            )}
            {selectedPrediction.tier === 'provisional' && selectedPrediction.qualification === 'ARES_STREAK_FAVOURITE' && (
              <div className="provisional-note"><Info /><div><strong>Provisional Ares selection</strong><p>The streak and price direction passed, but the sample is not deep enough for full Ares status or Banker eligibility.</p></div></div>
            )}
            {selectedPrediction.tier === 'provisional' && selectedPrediction.qualification !== 'ARES_STREAK_FAVOURITE' && selectedPrediction.qualification !== 'ARES_WATCHLIST' && (
              <div className="provisional-note"><Info /><div><strong>Provisional selection</strong><p>This pick passed the global 1X2 odds-pattern gate, but local league and team history is not yet deep enough for full Chronos status or Banker eligibility.</p></div></div>
            )}
            {selectedPrediction.upgraded && (
              <div className="upgrade-note"><TrendingUp /><div><strong>Low-odds upgrade</strong><p>{selectedPrediction.originalMarketLabel} at {selectedPrediction.originalOdds?.toFixed(2)} was below the 1.19 minimum, so the engine tested and approved the stronger market.</p></div></div>
            )}
            <h3>Simple statistical reasons</h3>
            <ol className="reason-list">{selectedPrediction.explanation.map((reason, index) => <li key={`${reason}-${index}`}>{reason}</li>)}</ol>
            <div className="evidence-grid">
              <span><small>Historical sample</small><strong>{selectedPrediction.sample}</strong></span>
              <span><small>Historical hit rate</small><strong>{evidenceValue(selectedPrediction, 'historicalHitRate')}%</strong></span>
              <span><small>Local league matches</small><strong>{evidenceValue(selectedPrediction, 'localLeagueMatches', evidenceValue(selectedPrediction, 'leagueSample'))}</strong></span>
              <span><small>Home team history</small><strong>{evidenceValue(selectedPrediction, 'homeTeamHistory', evidenceValue(selectedPrediction, 'homePosition'))}</strong></span>
              <span><small>Away team history</small><strong>{evidenceValue(selectedPrediction, 'awayTeamHistory', evidenceValue(selectedPrediction, 'awayPosition'))}</strong></span>
              <span><small>Qualification</small><strong>{selectedPrediction.tier === 'full' ? 'Full' : 'Provisional'}</strong></span>
              <span><small>Confrontation</small><strong>{evidenceValue(selectedPrediction, 'confrontationSignal')}</strong></span>
              <span><small>Streak compatibility</small><strong>{evidenceValue(selectedPrediction, 'confrontationCompatibility')}%</strong></span>
              <span><small>Home unbeaten / no-win</small><strong>{evidenceValue(selectedPrediction, 'homeUnbeatenStreak')} / {evidenceValue(selectedPrediction, 'homeNoWinStreak')}</strong></span>
              <span><small>Away unbeaten / no-win</small><strong>{evidenceValue(selectedPrediction, 'awayUnbeatenStreak')} / {evidenceValue(selectedPrediction, 'awayNoWinStreak')}</strong></span>
              <span><small>Home O2.5 / U2.5</small><strong>{evidenceValue(selectedPrediction, 'homeOver25Streak')} / {evidenceValue(selectedPrediction, 'homeUnder25Streak')}</strong></span>
              <span><small>Away O2.5 / U2.5</small><strong>{evidenceValue(selectedPrediction, 'awayOver25Streak')} / {evidenceValue(selectedPrediction, 'awayUnder25Streak')}</strong></span>
              <span><small>Home HT lead → win</small><strong>{evidenceValue(selectedPrediction, 'homeLeadToWinRate')}%</strong></span>
              <span><small>Away HT lead → win</small><strong>{evidenceValue(selectedPrediction, 'awayLeadToWinRate')}%</strong></span>
              {(selectedPrediction.qualification === 'ARES_STREAK_FAVOURITE' || selectedPrediction.qualification === 'ARES_WATCHLIST') && <>
                <span><small>Ares grade</small><strong>{evidenceValue(selectedPrediction, 'aresGrade')}</strong></span>
                <span><small>Ares score</small><strong>{evidenceValue(selectedPrediction, 'aresScore')}%</strong></span>
                <span><small>Ares confirmations</small><strong>{evidenceValue(selectedPrediction, 'aresConfirmations')}</strong></span>
                <span><small>Favorite wins / unbeaten</small><strong>{evidenceValue(selectedPrediction, 'aresFavouriteWinStreak')} / {evidenceValue(selectedPrediction, 'aresFavouriteUnbeatenStreak')}</strong></span>
                <span><small>Opponent losses / no-win</small><strong>{evidenceValue(selectedPrediction, 'aresOpponentLossStreak')} / {evidenceValue(selectedPrediction, 'aresOpponentNoWinStreak')}</strong></span>
              </>}
            </div>
            <h3>Engine checks</h3>
            <div className="engine-detail-list">
              {selectedPrediction.engines.map((engine) => (
                <div key={engine.key} className={engine.pass ? 'pass' : 'fail'}>
                  <span>{engine.pass ? <Check /> : <X />}</span>
                  <div><strong>{engine.name} · {engineName(engine.key)}</strong><p>{engine.note}</p></div>
                  <b>{Math.round(engine.score)}</b>
                </div>
              ))}
            </div>
            <p className="disclaimer-note">Confidence is a model score, not a guarantee. Only stake what you can afford to lose.</p>
          </>
        )}
      </aside>

      <nav className="mobile-nav">
        <a href="#top"><Activity /><span>Home</span></a>
        <a href="#ares-favorites"><Target /><span>Ares</span></a>
        <a href="#zeus-auto"><Zap /><span>Auto Picks</span></a>
        <button onClick={() => setMenuOpen(true)}><Menu /><span>Menu</span></button>
      </nav>
    </div>
  );
}
