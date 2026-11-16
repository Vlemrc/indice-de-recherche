// Relais vers la page publique de contributions d'un profil GitHub.
// GitHub n'autorise pas sa lecture directe depuis un navigateur.
const LOGIN_RE = /^[a-z\d](?:[a-z\d-]{0,38})$/i;

export default async function handler(req, res) {
  const login = String(req.query.login || '');
  if (!LOGIN_RE.test(login)) {
    res.status(400).send('Identifiant invalide');
    return;
  }
  try {
    const upstream = await fetch(`https://github.com/users/${login}/contributions`, {
      headers: { 'X-Requested-With': 'XMLHttpRequest', 'User-Agent': 'indice-de-recherche' },
    });
    if (!upstream.ok) {
      res.status(upstream.status).send('');
      return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.status(200).send(await upstream.text());
  } catch {
    res.status(502).send('');
  }
}
