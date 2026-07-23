const defaultAliases: Record<string, string> = {
  manchesterunited: 'manunited',
  manutd: 'manunited',
  manchesteru: 'manunited',
  manchestercity: 'mancity',
  nottinghamforest: 'nottmforest',
  nottmforest: 'nottmforest',
  wolverhamptonwanderers: 'wolves',
  wolverhampton: 'wolves',
  brightonandhovealbion: 'brighton',
  newcastleunited: 'newcastle',
  westhamunited: 'westham',
  leedsunited: 'leeds',
  leicestercity: 'leicester',
  tottenhamhotspur: 'tottenham',
  crystalpalacefc: 'crystalpalace',
  parisstgermain: 'psg',
  parissaintgermain: 'psg',
  intermilano: 'inter',
  internazionale: 'inter'
};

function extraAliases() {
  try {
    return JSON.parse(process.env.TEAM_ALIASES_JSON || '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

export function compact(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

export function teamKey(value: string) {
  const key = compact(value).replace(/footballclub$|fc$/g, '');
  const aliases = { ...defaultAliases, ...extraAliases() };
  return aliases[key] || key;
}

export function leagueKey(value: string) {
  let key = compact(value)
    .replace(/^english/, '')
    .replace(/^scottish/, '')
    .replace(/^german/, '')
    .replace(/^italian/, '')
    .replace(/^spanish/, '')
    .replace(/^french/, '')
    .replace(/^dutch/, '')
    .replace(/^portuguese/, '')
    .replace(/^turkish/, '')
    .replace(/^greek/, '')
    .replace(/^belgian/, '')
    .replace(/premiership/g, 'premierleague')
    .replace(/ligue1ubereats/g, 'ligue1');
  if (key === 'epl') key = 'premierleague';
  return key;
}

export function sameLeague(a: string, b: string) {
  const ka = leagueKey(a);
  const kb = leagueKey(b);
  return ka === kb || (ka.length >= 6 && kb.includes(ka)) || (kb.length >= 6 && ka.includes(kb));
}
