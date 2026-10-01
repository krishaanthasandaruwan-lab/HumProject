// 17 · Settings: the few things people may want to change. Nobody needs it to start; the rarely
// needed recording options sit closed under Advanced.
import { outputLatency } from '../audio/context';
import { refreshKey } from '../model/music';
import { edit } from '../state';
import { canBuy, restorePro } from '../pro/billing';
import { DEV_PRO, isPro, setDevPro } from '../pro/pro';
import { openPaywall } from './paywall';
import { navigate, type Params } from '../router';
import { settings, updateSettings, type Settings } from '../settings';
import { h, toast } from './dom';
import { icon } from './icons';
import { backBtn, group, listRow, range, titleBlock, toggle } from './kit';
import { openTaste, tasteSummary } from './taste';

function switchRow(key: keyof Settings, title: string, sub?: string, onChange?: (on: boolean) => void): HTMLElement {
  return listRow(title, toggle(Boolean(settings()[key]), (on) => {
    updateSettings({ [key]: on } as Partial<Settings>);
    onChange?.(on);
  }, title), { sub });
}

function timingRow(): HTMLElement {
  const label = h('span', { class: 'label num' });
  const show = (): void => {
    const ms = settings().latencyMs;
    label.textContent = `${ms > 0 ? '+' : ''}${ms} ms`;
  };
  show();
  return h('div', { class: 'lrow wide' },
    h('div', { class: 'row' }, h('b', { class: 'grow' }, 'Timing fix'), label),
    range(-100, 300, 5, settings().latencyMs, (v) => { updateSettings({ latencyMs: v }); show(); }, 'Timing fix'),
    h('small', null, `If recorded parts land late, slide right. Measured delay: ${Math.round(outputLatency() * 1000)} ms.`));
}

export function mountSettings(root: HTMLElement, params: Params): () => void {
  const back = params.back || 'studio';
  const pro = h('div');
  const renderPro = (): void => {
    const dev = import.meta.env.DEV ? toggle(isPro(), (on) => { setDevPro(on); renderPro(); }, 'Developer: pretend I bought Pro') : null;
    pro.replaceChildren(group('Pro',
      isPro()
        ? listRow('Pro is on', h('span', { class: 'pro' }, 'PRO'), { sub: DEV_PRO ? 'Unlocked by the test build.' : 'Thank you!' })
        : listRow('Unlock Pro', icon('open', 20), { sub: 'One time. No subscription.', onClick: () => openPaywall() }),
      canBuy() && !isPro() ? listRow('Restore purchase', icon('open', 20), { onClick: async () => { toast((await restorePro()) ? 'Welcome back to Pro' : 'No purchase found'); renderPro(); } }) : null,
      dev ? listRow('Developer: Pro on', dev) : null));
  };
  renderPro();

  root.append(h('div', { class: 'screen settings' },
    h('header', { class: 'top' }, backBtn(() => navigate(back))),
    titleBlock(['Settings']),
    group('Music',
      listRow('Music I like', icon('open', 20), { sub: tasteSummary(), onClick: () => openTaste(() => navigate('settings', params)) }),
      switchRow('snapToScale', 'Snap to key', 'Keeps hummed notes in the key.', (on) => edit((pp) => refreshKey(pp, on)))),
    pro,
    group('Privacy', h('div', { class: 'lrow wide' }, h('b', null, 'Audio never leaves your phone.'), h('small', null, `No account, no tracking. HUMM ${__APP_VERSION__}`))),
    h('details', { class: 'advanced' },
      h('summary', { class: 'label' }, 'Advanced', icon('down', 16)),
      group('While recording a part',
        switchRow('clickDuringTake', 'Metronome', 'A tick on every beat, so you stay in time.'),
        switchRow('bandDuringTake', 'Hear the song', 'Plays your other parts while you record a new one.'),
        timingRow()))));
  return () => undefined;
}
