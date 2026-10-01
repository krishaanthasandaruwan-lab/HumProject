// 18 · Pro: explain Pro in five lines and sell it in one tap ($0.99 once). On the web it points to the stores.
import { buyPro, canBuy, isNative, proPrice, restorePro, storeUrl } from '../pro/billing';
import { reload } from '../router';
import { h, sheet, toast } from './dom';
import { icon, type IconName } from './icons';
import { art, iconBtn, link, mainBtn, setLabel } from './kit';
import { INSTRUMENTS, KITS } from '../synth/kits';

const PERKS: [IconName, string][] = [
  ['video', 'No watermark on videos'],
  ['drums', `All ${KITS.length} drum kits`],
  ['chords', `All ${INSTRUMENTS.length} instruments`],
  ['audio', 'Audio and MIDI files'],
  ['songs', 'Unlimited songs'],
];

/** Red confetti squares fall once (skipped with Reduce Motion). */
export function confetti(): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = h('div', { class: 'confetti', 'aria-hidden': 'true' });
  for (let i = 0; i < 36; i++) {
    const s = h('i', { style: `left:${Math.random() * 100}%;width:${6 + Math.random() * 8}px;height:${6 + Math.random() * 8}px;${i % 4 === 0 ? 'background:var(--ink)' : ''}` });
    layer.append(s);
    s.animate([{ transform: 'translateY(-20px) rotate(0)' }, { transform: `translateY(${innerHeight + 40}px) rotate(${360 + Math.random() * 360}deg)` }],
      { duration: 900 + Math.random() * 600, delay: Math.random() * 250, easing: 'cubic-bezier(.3,.6,.6,1)', fill: 'both' });
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 1800);
}

export function openPaywall(reason?: string): void {
  const buy = mainBtn(canBuy() ? 'Unlock · $0.99' : isNative() ? 'Store not available' : 'Get Pro in the app', undefined, { icon: 'pro' });
  const restore = link('Restore');
  const content = h('div', { class: 'paywall' },
    h('div', { class: 'row' }, h('span', { class: 'pro' }, 'PRO'), h('span', { class: 'grow' }), iconBtn('close', 'Close', () => close(), { ghost: true })),
    h('h2', { class: 'h1' }, 'Unlock', h('br'), h('span', { class: 'hl' }, 'everything')),
    art('ill-09-pro', 0.8),
    reason ? h('p', { class: 'body muted' }, reason) : null,
    h('ul', { class: 'perks' }, PERKS.map(([ic, text]) => h('li', null, h('span', { class: 'tile48' }, icon(ic, 22)), h('span', { class: 'body' }, text)))),
    buy,
    h('p', { class: 'small muted center' }, canBuy() ? 'One time. No subscription.' : 'The web version stays free. Pro is a one-time purchase in the iPhone and Android apps.'),
    canBuy() ? h('div', { class: 'center' }, restore) : null,
    h('div', { class: 'piano-band', 'aria-hidden': 'true' }));
  const close = sheet(content, undefined);
  if (canBuy()) void proPrice().then((price) => { if (price) setLabel(buy, `Unlock · ${price}`); });

  const unlocked = (): void => {
    navigator.vibrate?.(20);
    confetti();
    toast('Welcome to Pro');
    close();
    reload();
  };

  buy.addEventListener('click', async () => {
    if (!canBuy()) {
      if (!isNative()) window.open(storeUrl(), '_blank', 'noopener');
      return;
    }
    buy.disabled = true;
    buy.classList.add('busy');
    const res = await buyPro();
    buy.disabled = false;
    buy.classList.remove('busy');
    if (res === 'ok') unlocked();
    else if (res === 'unavailable') toast('Can’t reach the store. Try again.');
    else if (res === 'error') toast('The purchase didn’t go through.');
  });
  restore.addEventListener('click', async () => {
    restore.disabled = true;
    const ok = await restorePro();
    restore.disabled = false;
    if (ok) unlocked();
    else toast('No earlier purchase found.');
  });
}
