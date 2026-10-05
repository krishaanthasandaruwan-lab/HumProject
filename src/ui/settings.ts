// 17 · Settings: the few things people may want to change. Nobody needs it to start; the rarely
// needed recording options sit closed under Advanced.
import { account, signOut } from '../account';
import { outputLatency } from '../audio/context';
import { refreshKey } from '../model/music';
import { edit } from '../state';
import { canBuy, restorePro, restoreMessage } from '../pro/billing';
import { endTesterPro, isPro, redeemTesterCode, setDevPro, STORE_READY, TESTER_BUILD, testerPro } from '../pro/pro';
import { openPaywall } from './paywall';
import { navigate, type Params } from '../router';
import { settings, updateSettings, type Settings } from '../settings';
import { ask, h, segmented, toast } from './dom';
import { setTheme, type Theme } from '../theme';
import { icon } from './icons';
import { backBtn, group, listRow, range, titleBlock, toggle } from './kit';
import { openTaste, tasteSummary } from './taste';
import { openAbout, openPrivacy } from './about';
import { rateApp } from '../native/review';
import { clearCaches } from '../cache';

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
    const dev = TESTER_BUILD ? toggle(isPro(), (on) => { setDevPro(on); renderPro(); }, 'Test build: Pro on') : null;
    pro.replaceChildren(group('Pro',
      isPro()
        ? listRow('Pro is on', h('span', { class: 'pro' }, 'PRO'), { sub: testerPro() ? 'Tester code.' : TESTER_BUILD ? 'Test build.' : 'Thank you!' })
        : listRow('Unlock Pro', icon('open', 20), { sub: 'One time. No subscription.', onClick: () => openPaywall() }),
      canBuy() && !isPro() ? listRow('Restore purchase', icon('open', 20), { onClick: async () => { toast(restoreMessage(await restorePro())); renderPro(); } }) : null,
      dev ? listRow('Test build: Pro on', dev, { sub: 'Only in test builds. Switch off to see the free app.' }) : null,
      // Until store purchases are set up, a tester code unlocks Pro on this phone.
      TESTER_BUILD && !STORE_READY && !isPro() ? listRow('Tester code', icon('open', 20), { sub: 'Unlock Pro on this phone for testing', onClick: () => void enterCode() }) : null,
      testerPro() ? listRow('Turn off tester Pro', icon('close', 20), { sub: 'Back to the free app', onClick: () => { endTesterPro(); renderPro(); } }) : null));
  };
  async function enterCode(): Promise<void> {
    const code = await ask('Tester code', '', 'Unlock', 'Code');
    if (!code) return;
    if (redeemTesterCode(code)) toast('Pro unlocked for testing');
    else toast('That code didn’t work');
    renderPro();
  }
  renderPro();

  // Let previous testers remove their stored identity; this release offers no account creation.
  const acct = h('div');
  const renderAccount = (): void => {
    const a = account();
    if (!a) return acct.replaceChildren();
    acct.replaceChildren(group('Account',
      listRow('Apple identity from a test build', icon('done', 20), { sub: a.name || a.email || 'Stored on this phone' }),
      listRow('Remove Apple identity', icon('close', 20), { sub: 'Forgets your Apple ID on this phone. Your songs stay.', onClick: async () => {
        await signOut();
        toast('Signed out');
        renderAccount();
      } })));
  };
  renderAccount();

  root.append(h('div', { class: 'screen settings' },
    h('header', { class: 'top' }, backBtn(() => navigate(back))),
    titleBlock(['Settings']),
    group('Appearance', segmented<Theme>([
      { value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' },
    ], settings().theme, (value) => { setTheme(value); navigate('settings', params); }, 'Color theme').el),
    group('Music',
      listRow('Music I like', icon('open', 20), { sub: tasteSummary(), onClick: () => openTaste(() => navigate('settings', params)) }),
      switchRow('snapToScale', 'Snap to key', 'Keeps hummed notes in the key.', (on) => edit((pp) => refreshKey(pp, on)))),
    acct,
    pro,
    group('HUMM',
      listRow('Rate HUMM', icon('open', 20), { sub: 'Tell others what you think', onClick: () => void rateApp() }),
      listRow('Privacy', icon('open', 20), { sub: 'Your audio never leaves your phone', onClick: () => openPrivacy() }),
      listRow('About HUMM', icon('open', 20), { sub: `Version ${__APP_VERSION__}`, onClick: () => openAbout() }),
      listRow('Clear cache', icon('delete', 20), { sub: 'Frees space. Your songs stay.', onClick: async () => {
        const n = await clearCaches();
        toast(n ? `Cache cleared · ${n} ${n === 1 ? 'file' : 'files'}` : 'Cache cleared');
      } })),
    h('details', { class: 'advanced' },
      h('summary', { class: 'label' }, 'Advanced', icon('down', 16)),
      group('While recording a part',
        switchRow('clickDuringTake', 'Metronome', 'A tick on every beat, so you stay in time.'),
        switchRow('bandDuringTake', 'Hear the song', 'Plays your other parts while you record a new one.'),
        timingRow()))));
  return () => undefined;
}
