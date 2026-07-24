import { parseBetExplorerStreakHtml } from './betexplorer-streaks.js';

const html = `<!doctype html><html><body>
<h2>Home streaks</h2>
<table>
  <thead><tr><th>Team</th><th>Wins</th><th>Draws</th><th>Losses</th><th>No win</th><th>No draw</th><th>Unbeaten</th><th>Over 2.5</th><th>Under 2.5</th><th>Played</th></tr></thead>
  <tbody>
    <tr><td>Zeus FC</td><td>4</td><td>0</td><td>0</td><td>0</td><td>6</td><td>7</td><td>3</td><td>0</td><td>10</td></tr>
    <tr><td>Athena United</td><td>0</td><td>2</td><td>1</td><td>5</td><td>0</td><td>0</td><td>0</td><td>4</td><td>9</td></tr>
  </tbody>
</table>
<h2>HT/FT overall</h2>
<table data-scope="overall">
  <thead><tr><th>Team</th><th>W/W</th><th>D/W</th><th>L/D</th><th>Played</th><th>Lead to win</th><th>Draw to win</th><th>Trail recovery</th></tr></thead>
  <tbody><tr><td>Zeus FC</td><td>5</td><td>2</td><td>1</td><td>10</td><td>83</td><td>50</td><td>25</td></tr></tbody>
</table>
</body></html>`;

const parsed = parseBetExplorerStreakHtml(
  html,
  'https://www.betexplorer.com/football/england/premier-league/streaks/',
  '2026-07-23'
);

if (parsed.snapshots.length !== 3) throw new Error(`Expected 3 snapshots, got ${parsed.snapshots.length}`);
const home = parsed.snapshots.find((snapshot) => snapshot.team === 'Zeus FC' && snapshot.scope === 'home');
if (!home) throw new Error('Home streak snapshot was not parsed.');
if (home.streaks.wins !== 4 || home.streaks.unbeaten !== 7 || home.streaks.noDraw !== 6 || home.streaks.over25 !== 3) {
  throw new Error(`Unexpected streak values: ${JSON.stringify(home.streaks)}`);
}
const htft = parsed.snapshots.find((snapshot) => snapshot.team === 'Zeus FC' && snapshot.scope === 'overall');
if (!htft || htft.htft.sample !== 10 || htft.htft.combinations.W_W !== 5 || htft.htft.leadToWinRate !== 83) {
  throw new Error(`Unexpected HT/FT profile: ${JSON.stringify(htft?.htft)}`);
}

console.log(JSON.stringify({
  ok: true,
  tables: parsed.tables,
  rows: parsed.rows,
  snapshots: parsed.snapshots.map((snapshot) => ({ team: snapshot.team, scope: snapshot.scope, streaks: snapshot.streaks, htft: snapshot.htft }))
}, null, 2));
