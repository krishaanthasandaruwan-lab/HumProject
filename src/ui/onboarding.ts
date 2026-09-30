// First-run onboarding: three swipeable cards.
import { navigate } from '../router';
import { updateSettings } from '../settings';
import { h } from './dom';

const CARDS = [
  { art: '🎤 → 🥁', title: 'Beatbox → Drums', text: 'Say “B”, “K” and “ts”. MouthBand turns them into a real drum kit, right on the beat.' },
  { art: '🎵 → 🎹', title: 'Hum → Melody', text: 'Hum a bassline or whistle a tune. It comes back in key as synth bass, lead — and chords with one tap.' },
  { art: '📱 ✨', title: 'Share your song', text: 'Export a “what I recorded → what came out” video for TikTok, Reels and WhatsApp.' },
];

export function mountOnboarding(root: HTMLElement): () => void {
  let index = 0;
  const track = h('div', { class: 'ob-track' },
    CARDS.map((c) => h('section', { class: 'ob-card' },
      h('div', { class: 'ob-art' }, c.art),
      h('h1', null, c.title),
      h('p', { class: 'muted' }, c.text))));
  const dots = CARDS.map(() => h('i'));
  const next = h('button', { class: 'primary big wide', onClick: () => go(index + 1) });
  const finish = (): void => {
    updateSettings({ onboarded: true });
    navigate('studio');
  };
  const go = (i: number): void => {
    if (i >= CARDS.length) return finish();
    track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' });
    setIndex(i);
  };
  const setIndex = (i: number): void => {
    index = i;
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
    next.textContent = i === CARDS.length - 1 ? "Let's make a song" : 'Next';
  };
  track.addEventListener('scroll', () => {
    const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    if (i !== index) setIndex(i);
  });
  root.append(
    h('div', { class: 'onboarding' },
      h('div', { class: 'row between' }, h('span', { class: 'brand ob-brand' }, 'MouthBand'), h('button', { class: 'link', onClick: finish }, 'Skip')),
      track,
      h('div', { class: 'ob-dots' }, dots),
      next),
  );
  setIndex(0);
  return () => undefined;
}
