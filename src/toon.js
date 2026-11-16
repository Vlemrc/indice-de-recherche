// Transforme une photo en portrait façon illustration : aplats de couleur,
// ombres découpées en paliers et contours encrés.

const INK = [14, 6, 28];
const SHADOW_TINT = [70, 30, 110];
const LIGHT_TINT = [255, 214, 150];

function boxBlur(ch, w, h, radius) {
  const tmp = new Float32Array(ch.length);
  const win = radius * 2 + 1;
  for (let y = 0; y < h; y++) {
    let sum = 0;
    const row = y * w;
    for (let i = -radius; i <= radius; i++) sum += ch[row + Math.min(w - 1, Math.max(0, i))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum / win;
      sum += ch[row + Math.min(w - 1, x + radius + 1)] - ch[row + Math.max(0, x - radius)];
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let i = -radius; i <= radius; i++) sum += tmp[Math.min(h - 1, Math.max(0, i)) * w + x];
    for (let y = 0; y < h; y++) {
      ch[y * w + x] = sum / win;
      sum += tmp[Math.min(h - 1, y + radius + 1) * w + x] - tmp[Math.max(0, y - radius) * w + x];
    }
  }
}

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
const smooth = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Sommes cumulées : permettent d'obtenir la moyenne d'un rectangle en quatre lectures.
function integral(ch, w, h) {
  const W1 = w + 1;
  const sat = new Float64Array(W1 * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += ch[y * w + x];
      sat[(y + 1) * W1 + x + 1] = sat[y * W1 + x + 1] + row;
    }
  }
  return sat;
}

// Filtre de Kuwahara : chaque pixel prend la couleur moyenne de la zone voisine la
// plus homogène. Les aplats deviennent lisses mais les arêtes restent nettes,
// contrairement à un flou qui bave sur les contours.
function kuwahara(r, g, b, w, h, radius) {
  const n = w * h;
  const luma = new Float32Array(n);
  const sq = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    luma[i] = 0.299 * r[i] + 0.587 * g[i] + 0.114 * b[i];
    sq[i] = luma[i] * luma[i];
  }
  const W1 = w + 1;
  const sr = integral(r, w, h);
  const sg = integral(g, w, h);
  const sb = integral(b, w, h);
  const sl = integral(luma, w, h);
  const ss = integral(sq, w, h);
  const sum = (sat, x0, y0, x1, y1) =>
    sat[y1 * W1 + x1] - sat[y0 * W1 + x1] - sat[y1 * W1 + x0] + sat[y0 * W1 + x0];
  const or = new Float32Array(n);
  const og = new Float32Array(n);
  const ob = new Float32Array(n);
  for (let y = 0; y < h; y++) {
    const ya = Math.max(0, y - radius), yb = y + 1, yc = y, yd = Math.min(h, y + radius + 1);
    for (let x = 0; x < w; x++) {
      const xa = Math.max(0, x - radius), xb = x + 1, xc = x, xd = Math.min(w, x + radius + 1);
      let best = Infinity;
      let bx0 = 0, by0 = 0, bx1 = 1, by1 = 1;
      for (let q = 0; q < 4; q++) {
        const x0 = q % 2 ? xc : xa, x1 = q % 2 ? xd : xb;
        const y0 = q < 2 ? ya : yc, y1 = q < 2 ? yb : yd;
        const area = (x1 - x0) * (y1 - y0);
        const mean = sum(sl, x0, y0, x1, y1) / area;
        const variance = sum(ss, x0, y0, x1, y1) / area - mean * mean;
        if (variance < best) {
          best = variance;
          bx0 = x0; by0 = y0; bx1 = x1; by1 = y1;
        }
      }
      const area = (bx1 - bx0) * (by1 - by0);
      const i = y * w + x;
      or[i] = sum(sr, bx0, by0, bx1, by1) / area;
      og[i] = sum(sg, bx0, by0, bx1, by1) / area;
      ob[i] = sum(sb, bx0, by0, bx1, by1) / area;
    }
  }
  return [or, og, ob];
}

// On travaille à 800 px, le double de la taille d'affichage : la réduction finale
// lisse les bords des aplats et des traits sans les rendre flous.
export function toon(img, size = 800) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const c = canvas.getContext('2d', { willReadFrequently: true });
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  c.imageSmoothingQuality = 'high';
  c.drawImage(
    img,
    (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side,
    0, 0, size, size
  );

  let image;
  try {
    image = c.getImageData(0, 0, size, size);
  } catch {
    return canvas; // image protégée : on garde la photo telle quelle
  }
  const px = image.data;
  const n = size * size;
  let r = new Float32Array(n);
  let g = new Float32Array(n);
  let b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    r[i] = px[i * 4];
    g[i] = px[i * 4 + 1];
    b[i] = px[i * 4 + 2];
  }

  // Aplats nets : deux passes de Kuwahara.
  const radius = Math.max(3, Math.round(size / 130));
  [r, g, b] = kuwahara(r, g, b, size, size, radius);
  [r, g, b] = kuwahara(r, g, b, size, size, Math.max(2, radius - 2));

  // Contours : gradient de Sobel sur l'image déjà simplifiée, donc sans bruit.
  const luma = new Float32Array(n);
  for (let i = 0; i < n; i++) luma[i] = 0.299 * r[i] + 0.587 * g[i] + 0.114 * b[i];
  boxBlur(luma, size, size, 1);
  const edge = new Float32Array(n);
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const i = y * size + x;
      const gx =
        luma[i - size + 1] + 2 * luma[i + 1] + luma[i + size + 1] -
        luma[i - size - 1] - 2 * luma[i - 1] - luma[i + size - 1];
      const gy =
        luma[i + size - 1] + 2 * luma[i + size] + luma[i + size + 1] -
        luma[i - size - 1] - 2 * luma[i - size] - luma[i - size + 1];
      edge[i] = Math.hypot(gx, gy);
    }
  }
  boxBlur(edge, size, size, 1);

  const LEVELS = 5;
  for (let i = 0; i < n; i++) {
    const l = 0.299 * r[i] + 0.587 * g[i] + 0.114 * b[i];
    const contrasted = clamp((l - 128) * 1.25 + 128);
    const step = Math.min(LEVELS - 1, Math.floor((contrasted / 256) * LEVELS));
    const t = step / (LEVELS - 1);
    const target = 34 + t * 214;
    const ratio = target / Math.max(l, 1);
    const tint = t < 0.5 ? SHADOW_TINT : LIGHT_TINT;
    const tintAmount = Math.abs(t - 0.5) * 0.3;
    const e = smooth(22, 58, edge[i]);
    const out = [r[i], g[i], b[i]];
    for (let j = 0; j < 3; j++) {
      let v = out[j] * ratio;
      v = target + (v - target) * 1.75; // saturation
      v = v * (1 - tintAmount) + tint[j] * tintAmount;
      v = v * (1 - e) + INK[j] * e;
      px[i * 4 + j] = clamp(v);
    }
    px[i * 4 + 3] = 255;
  }
  c.putImageData(image, 0, 0);
  return canvas;
}
