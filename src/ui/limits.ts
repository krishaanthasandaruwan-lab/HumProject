// How long a hum or an imported file can be: one minute free, three minutes with Pro.
// When the free minute runs out, the person keeps that minute or unlocks Pro.
import { isPro } from '../pro/pro';
import { h, sheet } from './dom';
import { btn2, mainBtn } from './kit';
import { openPaywall } from './paywall';

export const FREE_SECONDS = 60;
export const PRO_SECONDS = 180;

export const maxSeconds = (): number => (isPro() ? PRO_SECONDS : FREE_SECONDS);

export function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "One minute is free": resolves once they chose to keep their minute or to look at Pro. */
export function limitSheet(): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (pro: boolean): void => {
      if (done) return;
      done = true;
      close();
      if (pro) openPaywall('Pro records and imports up to 3 minutes.');
      resolve();
    };
    const close = sheet(h('div', { class: 'stack' },
      h('p', { class: 'body muted' }, 'Pro records up to 3 minutes. Keep your minute, or unlock Pro.'),
      mainBtn('Unlock Pro', () => finish(true), { icon: 'pro' }),
      btn2('Use my minute', () => finish(false))),
    () => finish(false), 'One minute is free');
  });
}
