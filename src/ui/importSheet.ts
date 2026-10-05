// Import: a sound file, or a video whose sound is taken out (most phone recordings are videos).
import { pickAudioFile, type AudioFile } from '../audio/importAudio';
import { h, sheet } from './dom';
import { icon, type IconName } from './icons';

export function chooseImport(signal?: AbortSignal): Promise<AudioFile | null> {
  return new Promise((resolve) => {
    if (signal?.aborted) { resolve(null); return; }
    let picked = false;
    const pick = (kind: 'audio' | 'video'): void => {
      picked = true;
      close();
      // Still inside the tap, so the system picker is allowed to open.
      void pickAudioFile(kind, signal).then(resolve, () => resolve(null));
    };
    const row = (ic: IconName, title: string, sub: string, kind: 'audio' | 'video'): HTMLButtonElement =>
      h('button', { type: 'button', class: 'card-list', onClick: () => pick(kind) },
        h('span', { class: 'ico', 'aria-hidden': 'true' }, icon(ic, 20)), h('span', null, h('b', null, title), h('small', null, sub)), icon('open', 20));
    const close = sheet(h('div', { class: 'stack' },
      row('video', 'From a video', 'Takes the sound out of a video', 'video'),
      row('audio', 'From a sound file', 'Voice memo, MP3, M4A or WAV', 'audio')),
    () => { signal?.removeEventListener('abort', close); if (!picked) resolve(null); }, 'Import');
    signal?.addEventListener('abort', close, { once: true });
  });
}
