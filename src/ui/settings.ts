// Settings: latency correction, recording options, calibration, privacy.
import { outputLatency } from '../audio/context';
import { refreshKey } from '../model/music';
import { clearProfile, getProfile } from '../profile';
import { edit } from '../state';
import { canBuy, restorePro } from '../pro/billing';
import { DEV_PRO, isPro, setDevPro } from '../pro/pro';
import { openPaywall } from './paywall';
import { navigate, type Params } from '../router';
import { settings, updateSettings, type Settings } from '../settings';
import { append, h, toast } from './dom';

function toggle(key: keyof Settings, label: string, onChange?: (on: boolean) => void): HTMLLabelElement {
  const box = h('input', { type: 'checkbox', checked: Boolean(settings()[key]) });
  box.addEventListener('change', () => {
    updateSettings({ [key]: box.checked } as Partial<Settings>);
    onChange?.(box.checked);
  });
  return h('label', { class: 'check' }, box, label);
}

function proSection(): HTMLElement {
  const box = h('section', { class: 'card stack' });
  const render = (): void => {
    const dev = import.meta.env.DEV ? h('input', { type: 'checkbox', checked: isPro() }) : null;
    dev?.addEventListener('change', () => { setDevPro(dev.checked); render(); });
    box.replaceChildren();
    append(box, [
      h('h2', null, 'MouthBand Pro', isPro() ? h('span', { class: 'pro-chip' }, 'ON') : null),
      h('p', { class: 'small muted' }, isPro()
        ? DEV_PRO ? 'Unlocked by the DEV_PRO test build flag.' : 'Thank you! No watermark, all kits and instruments, WAV + MIDI, unlimited songs.'
        : 'Free: watermark on videos, 2 drum kits, 8 instruments, 3 saved songs.'),
      isPro() ? null : h('button', { class: 'primary', onClick: () => openPaywall() }, 'Unlock Pro — $0.99 once'),
      canBuy() && !isPro() ? h('button', { onClick: async () => { toast((await restorePro()) ? 'Pro restored 🎉' : 'No purchase found'); render(); } }, 'Restore purchase') : null,
      dev ? h('label', { class: 'check' }, dev, 'Developer: pretend I bought Pro') : null,
    ]);
  };
  render();
  return box;
}

export function mountSettings(root: HTMLElement, params: Params): () => void {
  const back = params.back || 'studio';
  const latLabel = h('span', { class: 'small muted' });
  const lat = h('input', { type: 'range', min: -100, max: 300, step: 5, value: String(settings().latencyMs) });
  const showLat = (): void => {
    latLabel.textContent = `auto ${Math.round(outputLatency() * 1000)} ms ${settings().latencyMs >= 0 ? '+' : '−'} ${Math.abs(settings().latencyMs)} ms`;
  };
  lat.addEventListener('input', () => {
    updateSettings({ latencyMs: Number(lat.value) });
    showLat();
  });
  showLat();

  const calibBox = h('div', { class: 'stack' });
  const renderCalib = (): void => {
    const p = getProfile();
    calibBox.replaceChildren(
      h('p', { class: 'small muted' }, p
        ? `Using your personal sound profile (${p.samples.length} sounds, ${new Date(p.createdAt).toLocaleDateString()}).`
        : 'Not calibrated yet — MouthBand uses generic rules. Calibrating takes 20 seconds and improves accuracy a lot.'),
      h('div', { class: 'row' },
        h('button', { class: 'primary grow', onClick: () => navigate('calibrate', { back: 'settings' }) }, p ? 'Recalibrate' : 'Calibrate now'),
        p ? h('button', { onClick: async () => { await clearProfile(); renderCalib(); toast('Calibration removed'); } }, 'Reset') : null),
    );
  };
  renderCalib();

  root.append(
    h('header', { class: 'topbar' },
      h('button', { class: 'icon ghost', 'aria-label': 'Back', onClick: () => navigate(back) }, '←'),
      h('h1', null, 'Settings')),
    h('section', { class: 'card stack' },
      h('h2', null, 'Recording'),
      h('div', null, h('div', { class: 'row between' }, h('span', null, 'Latency correction'), latLabel), lat,
        h('p', { class: 'tiny muted' }, 'Hits landing late on the grid? Drag right. Early? Drag left.')),
      toggle('clickDuringTake', 'Metronome click while recording'),
      toggle('bandDuringTake', 'Play my other tracks while recording'),
      h('p', { class: 'tiny muted' }, 'Use headphones so the speaker does not leak into the mic.'),
    ),
    h('section', { class: 'card stack' },
      h('h2', null, 'Start'),
      toggle('startWithMic', 'Open MouthBand on the mic (hum → song)'),
      h('p', { class: 'tiny muted' }, 'Off: open straight into your last song.')),
    h('section', { class: 'card stack' }, h('h2', null, 'Beatbox calibration'), calibBox),
    h('section', { class: 'card stack' },
      h('h2', null, 'Melody'),
      toggle('snapToScale', 'Snap hummed notes to the key (gentle auto-tune)', (on) => edit((p) => refreshKey(p, on))),
    ),
    proSection(),
    h('section', { class: 'card stack' },
      h('h2', null, 'Privacy'),
      h('p', { class: 'small muted' }, 'Audio never leaves your device. All listening, analysis and sound making happens on your phone. No account, no tracking.'),
      h('p', { class: 'tiny muted' }, `MouthBand ${__APP_VERSION__}`),
    ),
  );
  return () => undefined;
}
