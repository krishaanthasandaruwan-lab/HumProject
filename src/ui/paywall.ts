// Paywall: one-time $0.99 unlock. On the web it points to the Android app.
import { PLAY_URL, buyPro, canBuy, isNative, proPrice, restorePro } from '../pro/billing';
import { currentScreen, navigate } from '../router';
import { h, sheet, toast } from './dom';

export const PAYWALL_HEADLINE = 'Remove watermark & unlock all sounds — $0.99 once. No subscription.';

const PERKS = [
  ['🚫', 'No watermark on your videos'],
  ['🥁', 'All 8 drum kits — Lo-fi, Trap, House, Acoustic, Techno, Retro 80s'],
  ['🎻', 'All 18 instruments — strings, choir, flute, brass, organ, marimba…'],
  ['🎵', 'WAV audio + MIDI export for your DAW'],
  ['💾', 'Unlimited saved songs'],
];

export function openPaywall(reason?: string): void {
  const buy = h('button', { class: 'primary big wide' }, canBuy() ? 'Unlock Pro — $0.99' : isNative() ? 'Store not available' : 'Get Pro in the Android app');
  const restore = h('button', { class: 'link' }, 'Restore purchase');
  const content = h('div', { class: 'stack paywall' },
    h('div', { class: 'pw-badge' }, 'MouthBand PRO'),
    h('h2', { class: 'pw-title' }, PAYWALL_HEADLINE),
    reason ? h('p', { class: 'small muted center' }, reason) : null,
    h('ul', { class: 'pw-list' }, PERKS.map(([em, text]) => h('li', null, h('span', null, em), text))),
    buy,
    canBuy() ? h('div', { class: 'center' }, restore) : h('p', { class: 'tiny muted center' }, 'The web version stays free. Pro is a one-time purchase in the Android app.'),
  );
  const close = sheet(content);
  if (canBuy()) {
    void proPrice().then((price) => { if (price) buy.textContent = `Unlock Pro — ${price}`; });
  }

  const unlocked = (): void => {
    toast('Welcome to Pro 🎉');
    close();
    navigate(currentScreen());
  };

  buy.addEventListener('click', async () => {
    if (!canBuy()) {
      if (!isNative()) window.open(PLAY_URL, '_blank', 'noopener');
      return;
    }
    buy.disabled = true;
    const res = await buyPro();
    buy.disabled = false;
    if (res === 'ok') unlocked();
    else if (res === 'unavailable') toast('The store is not available right now. Try again later.');
    else if (res === 'error') toast('The purchase did not go through.');
  });
  restore.addEventListener('click', async () => {
    restore.disabled = true;
    const ok = await restorePro();
    restore.disabled = false;
    if (ok) unlocked();
    else toast('No previous purchase found for this account.');
  });
}
