import { fetchStats, DEMO } from './github.js';
import { drawCard } from './card.js';

const $ = (id) => document.getElementById(id);
const canvas = $('card');
const form = $('form');
const input = $('login');
const submit = $('submit');
const status = $('status');
const actions = $('actions');

let current = null;

function say(text, error = false) {
  status.textContent = text;
  status.classList.toggle('error', error);
}

async function show(data, message) {
  current = data;
  await drawCard(canvas, data);
  actions.hidden = false;
  say(message);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!input.value.trim()) return say('Entrez un identifiant GitHub.', true);
  submit.disabled = true;
  say('Consultation du casier…');
  try {
    const data = await fetchStats(input.value);
    await show(data, '');
  } catch (error) {
    say(error.message || 'Une erreur est survenue.', true);
  } finally {
    submit.disabled = false;
  }
});

$('download').addEventListener('click', () => {
  if (!current) return;
  canvas.toBlob((blob) => {
    if (!blob) return say("L'export a échoué.", true);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `indice-de-recherche-${current.login}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
});

drawCard(canvas, DEMO);
