import { parseBetExplorerHtmlDetailed } from './betexplorer.js';

const html = `<!doctype html><html><head><title>Football fixtures</title></head><body>
<table class="table-main">
  <tbody>
    <tr class="js-tournament">
      <th colspan="2"><a class="table-main__tournament" href="/football/europe/conference-league/"><img alt="Europe">Europe: Conference League</a></th>
      <th class="table-main__odds">1</th><th class="table-main__odds">X</th><th class="table-main__odds">2</th>
    </tr>
    <tr data-dt="23,7,2026,19,45">
      <td class="h-text-left"><span class="table-main__time">18:45</span><a href="/football/europe/conference-league/fcsb-auda/abc123/">FCSB - Auda</a></td>
      <td class="table-main__streams"></td>
      <td class="table-main__odds" data-oid="o1"><button>1.16</button></td>
      <td class="table-main__odds" data-oid="ox"><button>6.53</button></td>
      <td class="table-main__odds" data-oid="o2"><button>14.67</button></td>
    </tr>
    <tr data-dt="23,7,2026,20,00">
      <td class="h-text-left"><span class="table-main__time">19:00</span><a href="/football/europe/conference-league/alpha-beta/def456/">Alpha - Beta</a></td>
      <td class="table-main__streams"></td>
      <td class="table-main__odds"><button>2.50</button></td>
      <td class="table-main__odds"><button>3.10</button></td>
      <td class="table-main__odds"><button>2.50</button></td>
    </tr>
  </tbody>
</table>
<table class="table-main">
  <tbody>
    <tr class="js-tournament"><th colspan="5"><a class="table-main__tournament">Yesterday League</a></th></tr>
    <tr data-def="1" data-dt="22,7,2026,20,00">
      <td class="table-main__tt"><span class="table-main__time">19:00</span><a href="/football/test/yesterday/old1/">Old Home - Old Away</a></td>
      <td class="table-main__result"><strong>1:0</strong></td>
      <td class="table-main__partial" colspan="3">(1:0, 0:0)</td>
    </tr>
  </tbody>
</table>
</body></html>`;

const parsed = parseBetExplorerHtmlDetailed(html, '2026-07-23', 'https://www.betexplorer.com/football/');
if (parsed.fixtures.length !== 2) throw new Error(`Expected 2 fixtures, got ${parsed.fixtures.length}`);
if (parsed.tableFixtures !== 2) throw new Error(`Expected 2 table fixtures, got ${parsed.tableFixtures}`);
if (parsed.jsonFixtures !== 0) throw new Error(`Expected 0 JSON fixtures, got ${parsed.jsonFixtures}`);

const first = parsed.fixtures[0];
if (first.homeTeam !== 'FCSB' || first.awayTeam !== 'Auda') {
  throw new Error(`Unexpected teams: ${first.homeTeam} v ${first.awayTeam}`);
}
if (first.country !== 'Europe' || first.leagueName !== 'Conference League') {
  throw new Error(`Unexpected competition: ${first.country} / ${first.leagueName}`);
}
if (first.odds.home !== 1.16 || first.odds.draw !== 6.53 || first.odds.away !== 14.67) {
  throw new Error('Expected complete 1X2 odds from current BetExplorer cells.');
}
const second = parsed.fixtures[1];
if (second.odds.home !== 2.5 || second.odds.away !== 2.5) {
  throw new Error('Equal home and away odds must not be deduplicated.');
}

console.log(JSON.stringify({
  ok: true,
  fixtures: parsed.fixtures.length,
  tableFixtures: parsed.tableFixtures,
  sample: parsed.fixtures.map((fixture) => ({
    date: fixture.date,
    country: fixture.country,
    league: fixture.leagueName,
    match: `${fixture.homeTeam} v ${fixture.awayTeam}`,
    odds: fixture.odds
  }))
}, null, 2));
