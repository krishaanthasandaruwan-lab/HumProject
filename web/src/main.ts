import './common';
import { initPiano } from './piano';

const image = document.querySelector<HTMLImageElement>('#feature-image')!;
const frame = document.querySelector('#feature-screen')!;
const screens: Record<string, string> = {
  studio: 'HUMM Studio: choose sounds and mix your band',
  choices: 'HUMM Pick your sound: hear different arrangements of your melody',
  drums: 'HUMM drum editor: beatbox and edit kick, snare and hi-hat hits',
  taste: 'HUMM music preferences: choose the styles you like',
};
let imageRequest = 0;
document.querySelectorAll<HTMLButtonElement>('[data-screen]').forEach(button => {
  button.addEventListener('click', async () => {
    const screen = button.dataset.screen!;
    const request = ++imageRequest;
    const next = new Image();
    next.src = `${import.meta.env.BASE_URL}screens/${screen}.png`;
    try { await next.decode(); } catch { return; }
    if (request !== imageRequest) return;
    image.src = next.src;
    image.alt = screens[screen];
    document.querySelectorAll('[data-screen]').forEach(el => el.setAttribute('aria-pressed', String(el === button)));
    frame.classList.remove('changing');
    requestAnimationFrame(() => frame.classList.add('changing'));
  });
});

// Load the app's audio engine only when the visitor approaches the demo.
let demoLoad: Promise<unknown> | undefined;
const loadDemo = (): Promise<unknown> => demoLoad ??= import('./demo').then(({ initDemo }) => initDemo()).catch(error => {
  demoLoad = undefined;
  document.querySelector('#demo-status')!.textContent = 'The studio could not load. Tap the microphone to retry.';
  throw error;
});
const demoButton = document.querySelector<HTMLButtonElement>('#demo-mic')!;
demoButton.addEventListener('click', event => {
  if (demoButton.dataset.loaded) return;
  event.stopImmediatePropagation();
  demoButton.disabled = true;
  void loadDemo().then(() => { demoButton.disabled = false; demoButton.click(); }).catch(() => { demoButton.disabled = false; });
});
const demoObserver = new IntersectionObserver(entries => {
  if (entries.some(entry => entry.isIntersecting)) { void loadDemo().catch(() => undefined); demoObserver.disconnect(); }
}, { rootMargin: '400px' });
demoObserver.observe(document.querySelector('#try-now')!);
initPiano();
