// 17 · Settings: the few things people may want to change. Nobody needs it to start.
import { outputLatency } from '../audio/context';
import { refreshKey } from '../model/music';
import { clearProfile, getProfile } from '../profile';
import { edit } from '../state';
import { canBuy, restorePro } from '../pro/billing';
import { DEV_PRO, isPro, setDevPro } from '../pro/pro';
import { openPaywall } from './paywall';
import { navigate, type Params } from '../router';
import { settings, updateSettings, type Settings } from '../settings';
import { h, toast } from './dom';
import { icon } from './icons';
import { backBtn, group, listRow, range, titleBlock, toggle } from './kit';

function switchRow(key: keyof Settings, title: string, sub?: string, onChange?: (on: boolean) => void): HTMLElement {
  return listRow(title, toggle(Boolean(settings()[key]), (on) => {
    updateSettings({ [key]: on } as Partial<Settings>);
    onChange?.(on);
  }, title), { sub });
}

export function mountSettings(root: HTMLElement, params: Params): () => void {
  const back = params.back || 'studio';
  const latLabel = h('span', { class: 'label num' });
  const showLat = (): void => {
    const ms = settings().latencyMs;
    latLabel.textContent = `${ms > 0 ? '+' : ''}${ms} ms`;
  };
  showLat();
  const timing = h('div', { class: 'lrow wide' },
    h('div', { class: 'row' }, h('b', { class: 'grow' }, 'Timing fix'), latLabel),
    range(-100, 300, 5, settings().latencyMs, (v) => { updateSettings({ latencyMs: v }); showLat(); }, 'Timing fix'),
    h('small', null, `Late? Slide right. Measured: ${Math.round(outputLatency() * 1000)} ms.`));

  const sounds = h('div');
  const renderSounds = (): void => {
    const p = getProfile();
    sounds.replaceChildren(group('Sounds',
      listRow('Teach my sounds', icon('open', 20), { sub: p ? `Done · ${p.samples.length} sounds` : 'Better beatbox drums in 20 seconds', onClick: () => navigate('calibrate', { back: 'settings' }) }),
      p ? listRow('Forget my sounds', icon('delete', 20), { onClick: async () => { await clearProfile(); renderSounds(); toast('Forgotten'); } }) : null,
      switchRow('snapToScale', 'Snap to key', 'Keeps hummed notes in the key.', (on) => edit((pp) => refreshKey(pp, on)))));
  };
  renderSounds();

  const pro = h('div');
  const renderPro = (): void => {
    const dev = import.meta.env.DEV ? toggle(isPro(), (on) => { setDevPro(on); renderPro(); }, 'Developer: pretend I bought Pro') : null;
    pro.replaceChildren(group('Pro',
      isPro()
        ? listRow('Pro is on', h('span', { class: 'pro' }, 'PRO'), { sub: DEV_PRO ? 'Unlocked by the DEV_PRO test build.' : 'Thank you!' })
        : listRow('Unlock Pro', icon('open', 20), { sub: 'One time. No subscription.', onClick: () => openPaywall() }),
      canBuy() && !isPro() ? listRow('Restore purchase', icon('open', 20), { onClick: async () => { toast((await restorePro()) ? 'Welcome back to Pro' : 'No purchase found'); renderPro(); } }) : null,
      dev ? listRow('Developer: Pro on', dev) : null));
  };
  renderPro();

  root.append(h('div', { class: 'screen settings' },
    h('header', { class: 'top' }, backBtn(() => navigate(back))),
    titleBlock(['Settings']),
    group('Recording',
      switchRow('clickDuringTake', 'Click while recording'),
      switchRow('bandDuringTake', 'Play other parts'),
      timing),
    group('Start', switchRow('startWithMic', 'Open on the mic', 'Off opens your last song.')),
    sounds,
    pro,
    group('Privacy', h('div', { class: 'lrow wide' }, h('b', null, 'Audio never leaves your phone.'), h('small', null, `No account, no tracking. MouthBand ${__APP_VERSION__}`)))));
  return () => undefined;
}
