import { wanted, fmt, MAX_LEVEL } from './level.js';
import { toon } from './toon.js';

const W = 1080;
const H = 1350;
const HORIZON = 640;
const PAD = 70;
const MARGIN_Y = 44;
const PLUM = '#3b1178';
const YELLOW = '#ffcf55';

const anton = (s) => `400 ${s}px Pricedown, Anton, Impact, sans-serif`;
const inter = (s, w = 600) => `${w} ${s}px Inter, system-ui, sans-serif`;

function spacing(c, px) {
  if ('letterSpacing' in c) c.letterSpacing = `${px}px`;
}

function fit(c, text, font, max, size, min = 36) {
  c.font = font(size);
  while (c.measureText(text).width > max && size > min) {
    size -= 2;
    c.font = font(size);
  }
  return size;
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Palette inspirée d'un coucher de soleil tropical : bleu, violet, magenta, orange, jaune.
// Emblème facultatif : si un fichier public/emblem.webp ou public/emblem.png existe,
// il remplace l'étoile derrière le titre.
let emblemPromise;
function customEmblem() {
  emblemPromise ??= loadImage('/emblem.webp').then((img) => img || loadImage('/emblem.png'));
  return emblemPromise;
}

function sunset(c, y0, y1) {
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, '#3f51c9');
  g.addColorStop(0.32, '#7b3fd0');
  g.addColorStop(0.6, '#e0409f');
  g.addColorStop(0.82, '#ff7e3e');
  g.addColorStop(1, '#ffcf55');
  return g;
}

// Texte blanc cerné d'un contour violet épais, avec une ombre portée décalée.
function outlined(c, text, x, y, size) {
  c.save();
  c.lineJoin = 'round';
  c.miterLimit = 2;
  c.strokeStyle = PLUM;
  c.lineWidth = Math.max(8, size * 0.2);
  c.strokeText(text, x + size * 0.035, y + size * 0.05);
  c.strokeText(text, x, y);
  c.fillStyle = '#ffffff';
  c.fillText(text, x, y);
  c.restore();
}

function backdrop(c) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#07030f');
  g.addColorStop(1, '#140726');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
}

function divider(c) {
  c.fillStyle = sunsetAcross(c);
  c.fillRect(PAD, HORIZON - 2, W - PAD * 2, 4);
}

function sunsetAcross(c) {
  const g = c.createLinearGradient(PAD, 0, W - PAD, 0);
  g.addColorStop(0, '#3f51c9');
  g.addColorStop(0.4, '#e0409f');
  g.addColorStop(0.75, '#ff7e3e');
  g.addColorStop(1, '#ffcf55');
  return g;
}

function palm(c, x, y, h, lean, color) {
  const tx = x + lean;
  const ty = y - h;
  const L = h * 0.44;
  c.save();
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineCap = 'round';
  c.lineWidth = Math.max(6, h * 0.035);
  c.beginPath();
  c.moveTo(x, y);
  c.quadraticCurveTo(x + lean * 0.15, y - h * 0.6, tx, ty);
  c.stroke();
  for (const a of [-3.0, -2.5, -2.0, -1.45, -0.95, -0.45, 0.05, 3.25]) {
    const ex = tx + Math.cos(a) * L;
    const ey = ty + Math.sin(a) * L * 0.55 + L * 0.42;
    const mx = tx + Math.cos(a) * L * 0.6;
    const my = ty + Math.sin(a) * L * 0.75 - L * 0.1;
    c.beginPath();
    c.moveTo(tx, ty);
    c.quadraticCurveTo(mx, my - L * 0.16, ex, ey);
    c.quadraticCurveTo(mx, my + L * 0.12, tx, ty);
    c.fill();
  }
  c.restore();
}

function starPath(c, cx, cy, r, inner = 0.45) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    c.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  c.closePath();
}

function star(c, cx, cy, r, filled) {
  starPath(c, cx, cy, r);
  c.lineJoin = 'round';
  if (filled) {
    c.strokeStyle = PLUM;
    c.lineWidth = 10;
    c.stroke();
    c.fillStyle = sunset(c, cy - r * 3.2, cy + r);
    c.fill();
  } else {
    c.strokeStyle = 'rgba(190, 150, 255, 0.45)';
    c.lineWidth = 4;
    c.stroke();
  }
}

// Emblème de la carte : une étoile d'avis de recherche remplie du coucher de soleil,
// avec le titre empilé par-dessus.
function emblem(c, custom) {
  const cx = 800, cy = 236, r = 186;
  if (custom) {
    // Image d'emblème fournie par l'utilisateur (public/emblem.webp ou .png).
    const scale = Math.min(430 / custom.naturalWidth, 380 / custom.naturalHeight);
    const w = custom.naturalWidth * scale;
    const h = custom.naturalHeight * scale;
    c.imageSmoothingQuality = 'high';
    c.drawImage(custom, cx - w / 2, cy - h / 2, w, h);
    lockup(c, cx);
    return;
  }
  c.save();
  c.lineJoin = 'miter';
  starPath(c, cx, cy, r, 0.5);
  c.strokeStyle = PLUM;
  c.lineWidth = 30;
  c.stroke();
  c.fillStyle = sunset(c, cy - r, cy + r * 0.85);
  c.fill();
  c.clip();
  palm(c, cx - 70, cy + r, 250, -30, 'rgba(60, 20, 130, 0.28)');
  palm(c, cx + 80, cy + r, 300, 40, 'rgba(60, 20, 130, 0.28)');
  starPath(c, cx, cy, r, 0.5);
  c.strokeStyle = '#ffb347';
  c.lineWidth = 12;
  c.stroke();
  c.restore();
  lockup(c, cx);
}

function lockup(c, cx) {
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  spacing(c, 1);
  [['indice', 78, 206], ['de', 62, 262], ['recherche', 78, 332]].forEach(([word, size, y]) => {
    c.font = anton(size);
    outlined(c, word, cx, y, size);
  });
}

function avatar(c, img, d) {
  const size = 400;
  const x = PAD + 14;
  const y = 150;
  c.save();
  c.translate(x + size / 2, y + size / 2);
  c.rotate(-0.045);
  c.fillStyle = PLUM;
  c.fillRect(-size / 2 - 22, -size / 2 - 22, size + 44, size + 44);
  c.fillStyle = sunset(c, -size / 2 - 14, size / 2 + 14);
  c.fillRect(-size / 2 - 14, -size / 2 - 14, size + 28, size + 28);
  if (img) {
    c.imageSmoothingQuality = 'high';
    c.drawImage(toon(img), -size / 2, -size / 2, size, size);
  } else {
    c.fillStyle = '#1a0b33';
    c.fillRect(-size / 2, -size / 2, size, size);
    const initials = d.name
      .split(/\s+/)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    c.font = anton(210);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    outlined(c, initials, 0, 12, 210);
  }
  c.restore();
}

function header(c, w) {
  c.textBaseline = 'alphabetic';
  c.fillStyle = 'rgba(255, 255, 255, 0.75)';
  spacing(c, 6);
  c.font = inter(24, 800);
  c.textAlign = 'left';
  c.fillText(`GITHUB · ${new Date().getFullYear()}`, PAD, 92);

  // Colonne de droite, sous l'emblème : niveau puis prime.
  for (let i = 0; i < MAX_LEVEL; i++) {
    star(c, W - PAD - 28 - (MAX_LEVEL - 1 - i) * 70, 446, 26, i < w.level);
  }
  c.textAlign = 'right';
  c.fillStyle = YELLOW;
  c.font = inter(22, 800);
  c.fillText('PRIME', W - PAD + 6, 508);
  spacing(c, 1);
  const amount = `${fmt(w.bounty)} $`;
  const size = fit(c, amount, anton, 450, 96);
  outlined(c, amount, W - PAD, 596, size);
}

function identity(c, d, w) {
  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
  spacing(c, 1);
  c.fillStyle = '#ffffff';
  const name = d.name.toUpperCase();
  const size = fit(c, name, anton, W - PAD * 2 - 10, 116, 56);
  outlined(c, name, PAD, 770, size);

  spacing(c, 0);
  c.font = inter(30, 800);
  c.fillStyle = YELLOW;
  const handle = `@${d.login}`;
  c.fillText(handle, PAD, 824);
  const hw = c.measureText(handle).width;
  c.fillStyle = '#d9cdf0';
  const rest = `  ·  ${w.title}`;
  fit(c, rest, (s) => inter(s, 600), W - PAD * 2 - hw, 30, 20);
  c.fillText(rest, PAD + hw, 824);
}

function stats(c, d) {
  const cells = d.contrib
    ? [
        [d.contrib.total, 'Contributions'],
        [d.contrib.longest, "Jours d'affilée"],
        [d.contrib.best, 'Record en un jour'],
        [d.contrib.active, 'Jours actifs'],
      ]
    : [
        [d.commits, 'Commits en 12 mois'],
        [d.stars, 'Étoiles raflées'],
        [d.prs, 'Pull requests'],
        [d.followers, 'Complices'],
      ];
  const colW = (W - PAD * 2) / cells.length;
  c.textAlign = 'left';
  cells.forEach(([value, label], i) => {
    const x = PAD + i * colW;
    spacing(c, 1);
    c.fillStyle = '#ffffff';
    fit(c, fmt(value), anton, colW - 28, 62, 34);
    c.fillText(fmt(value), x, 912);
    spacing(c, 1.5);
    c.fillStyle = '#b9a8d9';
    c.font = inter(17, 800);
    c.fillText(label.toUpperCase(), x, 946);
  });
}

const HEAT = ['rgba(255, 255, 255, 0.08)', '#4a45c4', '#8a3fd0', '#e0409f', '#ffb347'];

function heatmap(c, d) {
  if (!d.contrib) return;
  const days = d.contrib.days;
  const offset = new Date(`${days[0].date}T12:00:00`).getDay();
  const cols = Math.ceil((days.length + offset) / 7);
  const pitch = (W - PAD * 2 + 3.5) / cols;
  const size = pitch - 3.5;
  const top = 976;
  days.forEach((day, i) => {
    const slot = i + offset;
    const x = PAD + Math.floor(slot / 7) * pitch;
    const y = top + (slot % 7) * pitch;
    c.fillStyle = HEAT[day.level] || HEAT[0];
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, size, size, 3);
    else c.rect(x, y, size, size);
    c.fill();
  });
}

function signalement(c, d) {
  const parts = [];
  const day = (d.contrib && d.contrib.weekday) || (d.habit && d.habit.day);
  if (day) parts.push(`Frappe surtout le ${day}${d.habit ? ` vers ${d.habit.hour} h` : ''}`);
  parts.push(`${parts.length ? 'en' : 'En'} cavale depuis ${d.since}`);
  if (d.language) parts.push(`arme : ${d.language}`);
  spacing(c, 0);
  c.textAlign = 'left';
  c.fillStyle = '#d9cdf0';
  const text = parts.join('  ·  ');
  fit(c, text, (s) => inter(s, 600), W - PAD * 2, 22, 16);
  c.fillText(text, PAD, d.contrib ? 1136 : 1010);
}

function heists(c, d) {
  const { list, recent } = d.top;
  const base = d.contrib ? 1190 : 1080;
  c.textAlign = 'left';
  spacing(c, 4);
  c.fillStyle = YELLOW;
  c.font = inter(20, 800);
  c.fillText(recent ? "GROS COUPS DE L'ANNÉE" : 'GROS COUPS', PAD, base);

  spacing(c, 0);
  if (!list.length) {
    c.fillStyle = '#d9cdf0';
    c.font = inter(26, 600);
    c.fillText('Aucun coup revendiqué publiquement.', PAD, base + 46);
    return;
  }
  list.forEach((repo, i) => {
    const y = base + 44 + i * 42;
    c.textAlign = 'right';
    c.font = inter(22, 600);
    c.fillStyle = '#d9cdf0';
    const meta = [
      repo.commits != null ? `${fmt(repo.commits)} commit${repo.commits > 1 ? 's' : ''}` : null,
      repo.stars > 0 ? `★ ${fmt(repo.stars)}` : null,
      repo.language,
    ]
      .filter(Boolean)
      .join('  ·  ');
    c.fillText(meta, W - PAD, y);
    const metaW = c.measureText(meta).width;

    c.textAlign = 'left';
    c.font = inter(20, 800);
    c.fillStyle = '#8f7db3';
    c.fillText(`0${i + 1}`, PAD, y);
    c.fillStyle = '#ffffff';
    let name = repo.name;
    c.font = inter(27, 800);
    const max = W - PAD * 2 - 52 - metaW - 30;
    while (c.measureText(name).width > max && name.length > 4) name = name.slice(0, -2).trimEnd() + '…';
    c.fillText(name, PAD + 52, y);
  });
}

export async function drawCard(canvas, d) {
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext('2d');
  const [img, custom] = await Promise.all([
    loadImage(d.avatar),
    customEmblem(),
    document.fonts.load(anton(100)).catch(() => {}),
    document.fonts.load(inter(30, 600)).catch(() => {}),
    document.fonts.load(inter(30, 800)).catch(() => {}),
  ]);
  const w = wanted(d);

  backdrop(c);
  // Marge intérieure : tout le contenu est réduit et recentré, ce qui laisse de
  // l'air en haut et en bas sans changer le format 4:5 de l'image.
  const scale = (H - MARGIN_Y * 2) / H;
  c.save();
  c.translate((W * (1 - scale)) / 2, MARGIN_Y);
  c.scale(scale, scale);
  divider(c);
  emblem(c, custom);
  header(c, w);
  avatar(c, img, d);
  identity(c, d, w);
  stats(c, d);
  heatmap(c, d);
  signalement(c, d);
  heists(c, d);
  c.restore();
}
