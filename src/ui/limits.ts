// Studio/import limits: 60 seconds Free, 90 Plus, 180 Pro. Home mic stays at 60 seconds.
import { isPlus, isPro } from '../pro/pro';
import { h, sheet } from './dom';
import { btn2, mainBtn } from './kit';
import { openPaywall } from './paywall';

export const FREE_SECONDS = 60;
export const PLUS_SECONDS = 90;
export const PRO_SECONDS = 180;

export const maxSeconds = (): number => isPro() ? PRO_SECONDS : isPlus() ? PLUS_SECONDS : FREE_SECONDS;

export function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "One minute is free": resolves once they chose to keep their minute or to look at Pro. */
export function limitSheet(): Promise<void> {
  return new Promise((resolve) => {
    const seconds = maxSeconds();
    let done = false;
    const finish = (pro: boolean): void => {
      if (done) return;
      done = true;
      close();
      if (pro) openPaywall('Plus imports up to 90 seconds. Pro imports up to 3 minutes.');
      resolve();
    };
    const close = sheet(h('div', { class: 'stack' },
      h('p', { class: 'body muted' }, `Keep the first ${seconds} seconds, or choose a plan for longer imports and Studio recordings. The Home mic stays at one minute.`),
      mainBtn('See plans', () => finish(true), { icon: 'pro' }),
      btn2(`Use ${seconds} seconds`, () => finish(false))),
    () => finish(false), 'Recording limit');
  });
}
