// About HUMM and the privacy policy, shown inside the app (no website needed).
import { h, sheet } from './dom';
import { mainBtn } from './kit';

const PRIVACY: [string, string][] = [
  ['Your audio stays on your phone.', 'HUMM uses the microphone only while you hum or record. Everything it hears is turned into music on your phone and saved inside the app with your songs. Nothing is uploaded.'],
  ['Files you import', 'Sound files and videos you pick are read on your phone only.'],
  ['No account, no ads, no tracking', 'HUMM has no sign-in, shows no ads and collects no analytics. It makes no network requests except for purchases.'],
  ['Purchases', 'If you unlock Pro, Apple or Google handles the payment. HUMM uses RevenueCat to check it: RevenueCat receives the receipt and a random app user ID, never your audio or songs.'],
  ['Sharing', 'Videos and files leave the app only when you share them yourself.'],
  ['Deleting', 'Deleted songs wait 30 days in Recently deleted, then they are gone. Removing the app removes everything.'],
  ['Children', 'HUMM is for everyone and does not knowingly collect data from anyone.'],
];

function textSheet(title: string, body: HTMLElement): void {
  const close = sheet(h('div', { class: 'stack prose' }, body, mainBtn('Done', () => close(), { icon: 'done' })), undefined, title);
}

export function openPrivacy(): void {
  textSheet('Privacy', h('div', { class: 'stack' },
    PRIVACY.map(([head, text]) => h('section', null, h('h3', { class: 'label' }, head), h('p', { class: 'body' }, text))),
    h('p', { class: 'small muted' }, 'Effective 1 October 2026.')));
}

export function openAbout(): void {
  textSheet('About HUMM', h('div', { class: 'stack' },
    h('p', { class: 'body' }, 'Hum a melody, beatbox a beat, or record any sound around you. HUMM finds the beat and the key and turns it into a song with a full band.'),
    h('p', { class: 'body' }, 'Everything happens on your phone. Your voice never leaves it.'),
    h('p', { class: 'small muted' }, `Version ${__APP_VERSION__}`),
    h('p', { class: 'small muted' }, 'Fonts: Anton, Barlow and Barlow Condensed (SIL Open Font License). Icons: Lucide (ISC License).')));
}
