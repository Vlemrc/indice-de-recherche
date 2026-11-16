export const MAX_LEVEL = 6;

const TITLES = [
  'Petit délinquant du commit',
  'Récidiviste du push',
  'Ennemi juré du linter',
  "Baron de l'open source",
  'Parrain du merge',
  'Ennemi public numéro un',
];

const THRESHOLDS = [50, 200, 600, 1500, 4000];

export function wanted(d) {
  const score =
    (d.contrib ? d.contrib.total : d.commits || 0) + (d.stars || 0) * 2 + (d.prs || 0) * 3 + (d.followers || 0) + (d.repos || 0) * 2;
  const level = 1 + THRESHOLDS.filter((t) => score >= t).length;
  return { score, level, title: TITLES[level - 1], bounty: score * 1000 };
}

const nf = new Intl.NumberFormat('fr-FR');
const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });

export function fmt(n) {
  if (n === null || n === undefined) return '—';
  return n >= 100000 ? compact.format(n) : nf.format(n);
}

export function caption(d) {
  const w = wanted(d);
  const stars = '★'.repeat(w.level) + '☆'.repeat(MAX_LEVEL - w.level);
  const facts = [
    d.contrib
      ? `${fmt(d.contrib.total)} contributions sur 12 mois`
      : d.commits !== null
        ? `${fmt(d.commits)} commits sur 12 mois`
        : null,
    d.contrib ? `${fmt(d.contrib.longest)} jours d'affilée au plus fort` : null,
    d.contrib ? `${fmt(d.contrib.active)} jours actifs` : `${fmt(d.stars)} étoiles`,
  ].filter(Boolean);
  return [
    `Indice de recherche : ${stars} (${w.level}/${MAX_LEVEL}) — ${w.title}.`,
    '',
    `${facts.join(', ')}.`,
    ...(d.top && d.top.list.length ? ['', `Plus gros coup : ${d.top.list[0].name}.`] : []),
    '',
    'Et vous, quel est votre niveau ?',
    '',
    '#GitHub #OpenSource #Dev',
  ].join('\n');
}
