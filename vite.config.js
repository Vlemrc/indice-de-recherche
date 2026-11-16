import { defineConfig, loadEnv } from 'vite';
import { execFileSync } from 'node:child_process';

// Session de la commande `gh` de cette machine, si elle est connectée.
function ghToken() {
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

export default defineConfig(({ mode }) => {
  // Authentification facultative : la session `gh` d'abord, sinon GITHUB_TOKEN dans
  // .env.local. Le jeton reste côté serveur local : il n'est ni inclus dans le code
  // envoyé au navigateur, ni utilisé par `vite build`.
  const token = ghToken() || loadEnv(mode, process.cwd(), '').GITHUB_TOKEN;

  // Le calendrier de contributions n'existe pas dans l'API publique : on lit la page
  // publique du profil. GitHub n'autorisant pas l'appel direct depuis un navigateur,
  // le serveur local fait le relais. En production, il faudra une fonction équivalente.
  const contributions = {
    '/gh-contrib': {
      target: 'https://github.com',
      changeOrigin: true,
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      rewrite: (path) => path.replace(/^\/gh-contrib\/([A-Za-z0-9-]+)$/, '/users/$1/contributions'),
    },
  };

  const api = {
    '/gh-api': {
      target: 'https://api.github.com',
      changeOrigin: true,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      rewrite: (path) => path.replace(/^\/gh-api/, ''),
    },
  };

  return {
    server: { proxy: { ...contributions, ...api } },
    preview: { proxy: contributions },
  };
});
