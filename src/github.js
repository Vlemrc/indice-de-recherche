// En développement, les appels passent par le serveur local, qui ajoute le jeton
// GitHub s'il y en a un dans .env.local. Le jeton n'arrive jamais dans le navigateur.
const API = import.meta.env.DEV ? '/gh-api' : 'https://api.github.com';
const LOGIN_RE = /^[a-z\d](?:[a-z\d-]{0,38})$/i;

async function get(path) {
  const res = await fetch(API + path, { headers: { Accept: 'application/vnd.github+json' } });
  if (res.status === 404) throw new Error('Profil introuvable sur GitHub.');
  if (res.status === 403 || res.status === 429) {
    const reset = Number(res.headers.get('X-RateLimit-Reset')) * 1000;
    const minutes = reset ? Math.max(1, Math.ceil((reset - Date.now()) / 60000)) : null;
    throw new Error(
      minutes
        ? `Quota de l'API GitHub épuisé (60 requêtes par heure sans jeton). Réessayez dans ${minutes} min.`
        : "Limite de l'API GitHub atteinte. Réessayez dans quelques minutes."
    );
  }
  if (!res.ok) throw new Error(`GitHub a répondu ${res.status}.`);
  return res.json();
}

// Les recherches ont un quota séparé (10 par minute) : en cas d'échec on affiche « — ».
async function count(path) {
  try {
    const data = await get(path);
    return typeof data.total_count === 'number' ? data.total_count : null;
  } catch {
    return null;
  }
}

// Identifiant du compte auquel appartient le jeton, ou null sans jeton.
let viewerPromise;
function viewer() {
  if (!import.meta.env.DEV) return Promise.resolve(null);
  viewerPromise ??= fetch(`${API}/user`, { headers: { Accept: 'application/vnd.github+json' } })
    .then((res) => (res.ok ? res.json() : null))
    .then((user) => (user ? user.login : null))
    .catch(() => null);
  return viewerPromise;
}

// Avec le jeton de la personne elle-même, on voit aussi ses dépôts privés.
async function ownRepos(login, total, mine) {
  if (mine) {
    const repos = [];
    for (let page = 1; page <= 3; page++) {
      const list = await get(
        `/user/repos?affiliation=owner,collaborator,organization_member&per_page=100&sort=pushed&page=${page}`
      );
      repos.push(...list);
      if (list.length < 100) break;
    }
    return repos.filter((r) => !r.fork);
  }
  const pages = Math.min(3, Math.max(1, Math.ceil(total / 100)));
  const lists = await Promise.all(
    Array.from({ length: pages }, (_, i) =>
      get(`/users/${login}/repos?per_page=100&type=owner&sort=pushed&page=${i + 1}`)
    )
  );
  return lists.flat().filter((r) => !r.fork);
}

function topLanguage(repos) {
  const tally = {};
  for (const r of repos) if (r.language) tally[r.language] = (tally[r.language] || 0) + 1;
  const best = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : null;
}

const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

function mode(values) {
  const tally = new Map();
  for (const v of values) tally.set(v, (tally.get(v) || 0) + 1);
  return [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

// Jour et heure d'activité les plus fréquents, d'après les ~100 derniers événements publics.
async function habit(login) {
  try {
    const events = await get(`/users/${login}/events/public?per_page=100`);
    if (!Array.isArray(events) || events.length < 5) return null;
    const dates = events.map((e) => new Date(e.created_at));
    return { day: DAYS[mode(dates.map((d) => d.getDay()))], hour: mode(dates.map((d) => d.getHours())) };
  } catch {
    return null;
  }
}

function summarize(days) {
  let longest = 0;
  let run = 0;
  let best = days[0];
  const byWeekday = new Array(7).fill(0);
  for (const d of days) {
    run = d.count > 0 ? run + 1 : 0;
    if (run > longest) longest = run;
    if (d.count > best.count) best = d;
    byWeekday[new Date(`${d.date}T12:00:00`).getDay()] += d.count;
  }
  const total = days.reduce((sum, d) => sum + d.count, 0);
  return {
    total,
    days,
    longest,
    active: days.filter((d) => d.count > 0).length,
    best: best.count,
    weekday: total ? DAYS[byWeekday.indexOf(Math.max(...byWeekday))] : null,
  };
}

// Calendrier de contributions du profil public (inclut le privé si la personne l'affiche).
async function calendar(login) {
  try {
    const res = await fetch(`/gh-contrib/${login}`);
    if (!res.ok) return null;
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    const counts = new Map();
    doc.querySelectorAll('tool-tip[for]').forEach((tip) => {
      const match = tip.textContent.trim().match(/^(\d+)\s+contribution/);
      counts.set(tip.getAttribute('for'), match ? Number(match[1]) : 0);
    });
    const days = [...doc.querySelectorAll('td[data-date]')]
      .map((td) => ({
        date: td.dataset.date,
        level: Number(td.dataset.level) || 0,
        count: counts.get(td.id) || 0,
      }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    return days.length >= 300 ? summarize(days) : null;
  } catch {
    return null;
  }
}

// Nombre de commits de la personne sur un dépôt depuis une date : on demande une
// seule entrée par page et on lit le numéro de la dernière page.
async function commitCount(fullName, login, since) {
  try {
    const res = await fetch(
      `${API}/repos/${fullName}/commits?author=${login}&since=${since.toISOString()}&per_page=1`,
      { headers: { Accept: 'application/vnd.github+json' } }
    );
    if (res.status === 409) return 0; // dépôt vide
    if (!res.ok) return null;
    const last = (res.headers.get('Link') || '').match(/[?&]page=(\d+)>; rel="last"/);
    if (last) return Number(last[1]);
    return (await res.json()).length;
  } catch {
    return null;
  }
}


// Projets phares : les dépôts publics où la personne a le plus commité depuis un an.
// On ne compte que les derniers dépôts touchés, chaque comptage coûtant une requête.
async function topRepos(all, since, login, candidates) {
  // Le dépôt du README de profil n'est pas un projet.
  const repos = all.filter((r) => r.name.toLowerCase() !== login.toLowerCase());
  const byPush = (a, b) => new Date(b.pushed_at) - new Date(a.pushed_at);
  const recent = repos.filter((r) => new Date(r.pushed_at) >= since).sort(byPush);
  const pool = (recent.length ? recent : [...repos].sort(byPush)).slice(0, candidates);
  const counts = recent.length
    ? await Promise.all(pool.map((r) => commitCount(r.full_name, login, since)))
    : pool.map(() => null);
  const counted = counts.every((n) => n !== null);
  const list = pool.map((r, i) => ({
    name: r.name,
    stars: r.stargazers_count,
    language: r.language,
    commits: counted ? counts[i] : null,
    private: Boolean(r.private),
  }));
  list.sort((a, b) => (counted ? b.commits - a.commits : 0) || b.stars - a.stars);
  return {
    recent: recent.length > 0,
    list: list.filter((r) => !counted || r.commits > 0).slice(0, 3),
  };
}

// Les stats d'un compte sont gardées une heure dans le navigateur : régénérer la
// même carte ne consomme pas de quota.
const CACHE_TTL = 60 * 60 * 1000;
const cacheKey = (login) => `indice-de-recherche:v1:${login.toLowerCase()}`;

function readCache(login) {
  try {
    const entry = JSON.parse(localStorage.getItem(cacheKey(login)));
    return entry && Date.now() - entry.at < CACHE_TTL ? entry.data : null;
  } catch {
    return null;
  }
}

function writeCache(login, data) {
  try {
    localStorage.setItem(cacheKey(login), JSON.stringify({ at: Date.now(), data }));
  } catch {
    // stockage indisponible : on s'en passe
  }
}

export async function fetchStats(rawLogin) {
  const login = rawLogin.trim().replace(/^@/, '');
  if (!LOGIN_RE.test(login)) throw new Error('Identifiant GitHub invalide.');
  // Avec un jeton le quota est large : pas de cache, pour toujours voir l'état réel.
  const authed = Boolean(await viewer());
  const cached = authed ? null : readCache(login);
  if (cached) return cached;
  const data = await loadStats(login);
  // On ne garde pas une carte incomplète (recherches ou calendrier en échec).
  if (!authed && data.commits !== null && data.prs !== null && data.contrib) writeCache(login, data);
  return data;
}

async function loadStats(login) {

  const user = await get(`/users/${login}`);
  if (user.type && user.type !== 'User') {
    throw new Error("Ce compte est une organisation : entrez l'identifiant d'une personne.");
  }

  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);
  const day = since.toISOString().slice(0, 10);

  const me = await viewer();
  // Par défaut la carte ne montre que les dépôts publics. Les dépôts privés ne sont
  // inclus qu'en local, pour son propre compte, et sur demande : http://localhost:…/?prive
  const wantsPrivate = import.meta.env.DEV && new URLSearchParams(location.search).has('prive');
  const mine = wantsPrivate && Boolean(me) && me.toLowerCase() === user.login.toLowerCase();
  const repos = await ownRepos(user.login, user.public_repos, mine);
  const owned = repos.filter((r) => r.owner.login.toLowerCase() === user.login.toLowerCase());
  // Avec un jeton le quota est large : on compte les commits sur plus de dépôts.
  const [top, routine, contrib, commits, prs] = await Promise.all([
    topRepos(repos, since, user.login, me ? 15 : 6),
    habit(user.login),
    calendar(user.login),
    count(`/search/commits?q=author:${user.login}+author-date:>=${day}&per_page=1`),
    count(`/search/issues?q=author:${user.login}+type:pr&per_page=1`),
  ]);

  return {
    login: user.login,
    name: user.name || user.login,
    avatar: user.avatar_url ? `${user.avatar_url}&s=800` : null,
    commits,
    prs,
    stars: owned.reduce((sum, r) => sum + r.stargazers_count, 0),
    repos: user.public_repos,
    followers: user.followers,
    since: new Date(user.created_at).getFullYear(),
    top,
    habit: routine,
    contrib,
    language: topLanguage(owned),
    withPrivate: mine && repos.some((r) => r.private),
  };
}

function demoDays() {
  const days = [];
  const start = new Date();
  start.setDate(start.getDate() - 370 - start.getDay());
  let seed = 7;
  for (let i = 0; i < 371; i++) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    const roll = seed / 2147483648;
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    const count = roll < (weekend ? 0.6 : 0.2) ? 0 : Math.ceil(roll * roll * 14);
    days.push({
      date: date.toISOString().slice(0, 10),
      count,
      level: count === 0 ? 0 : count < 3 ? 1 : count < 6 ? 2 : count < 10 ? 3 : 4,
    });
  }
  return days;
}

export const DEMO = {
  login: 'camilledev',
  name: 'Camille Durand',
  avatar: null,
  commits: 1248,
  prs: 312,
  stars: 486,
  repos: 47,
  followers: 203,
  since: 2019,
  top: {
    recent: true,
    list: [
      { name: 'atlas-ui', stars: 312, language: 'TypeScript', commits: 412 },
      { name: 'carnet-de-bord', stars: 128, language: 'Svelte', commits: 187 },
      { name: 'pixel-braquage', stars: 46, language: 'Rust', commits: 96 },
    ],
  },
  habit: { day: 'mardi', hour: 23 },
  contrib: summarize(demoDays()),
  language: 'TypeScript',
};
