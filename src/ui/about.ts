// About HUMM and the privacy policy, shown inside the app with a public policy link when configured.
import { h, sheet } from './dom';
import { mainBtn } from './kit';

const PRIVACY: [string, string][] = [
  ['Your audio stays on your phone.', 'HUMM uses the microphone only while you hum or record. Everything it hears is turned into music on your phone and saved inside the app with your songs. Nothing is uploaded.'],
  ['Files you import', 'Sound files and videos you pick are read on your phone only.'],
  ['No account, ads or advertising tracking', 'This release does not create accounts or offer sign-in. HUMM has no ads, advertising identifiers or audio analytics. Store purchase services use the network. An Apple identity retained from an earlier test build can be removed in Settings; it is not used to sync songs.'],
  ['Purchases', 'Apple or Google handles payments. RevenueCat processes purchase history, an anonymous app user ID and technical purchase data to verify Plus or Pro subscriptions and provide purchase reporting. RevenueCat never receives your audio or songs.'],
  ['Sharing', 'Videos and files leave the app only when you share them yourself.'],
  ['Deleting', 'Recently deleted songs are removed when HUMM next opens after 30 days, or immediately with Delete forever. Temporary share files expire during app use. Copies you shared are controlled by their destination. Uninstalling removes app-local songs; device backups may restore them. Apple identity in the iOS Keychain and store purchase records can survive reinstalling. Sign out removes the local Apple identity.'],
  ['Permissions', 'Microphone permission is needed only to record. System pickers let you choose individual files or videos without granting access to your whole library. You can make music without signing in.'],
];

function textSheet(title: string, body: HTMLElement): void {
  const close = sheet(h('div', { class: 'stack prose' }, body, mainBtn('Done', () => close(), { icon: 'done' })), undefined, title);
}

export function openPrivacy(): void {
  textSheet('Privacy', h('div', { class: 'stack' },
    PRIVACY.map(([head, text]) => h('section', null, h('h3', { class: 'label' }, head), h('p', { class: 'body' }, text))),
    import.meta.env.VITE_PRIVACY_POLICY_URL ? h('a', { class: 'link', href: import.meta.env.VITE_PRIVACY_POLICY_URL, target: '_blank', rel: 'noopener noreferrer' }, 'Online privacy policy') : null,
    import.meta.env.VITE_SUPPORT_EMAIL ? h('a', { class: 'link', href: `mailto:${import.meta.env.VITE_SUPPORT_EMAIL}` }, 'Contact support') : null,
    h('p', { class: 'small muted' }, 'Updated 5 October 2026.')));
}

export function openAbout(): void {
  textSheet('About HUMM', h('div', { class: 'stack' },
    h('p', { class: 'body' }, 'Hum a melody, beatbox a beat, or record any sound around you. HUMM finds the beat and the key and turns it into a song with a full band.'),
    h('p', { class: 'body' }, 'Everything happens on your phone. Your voice never leaves it.'),
    h('p', { class: 'small muted' }, `Version ${__APP_VERSION__}`),
    import.meta.env.VITE_SUPPORT_EMAIL ? h('a', { class: 'link', href: `mailto:${import.meta.env.VITE_SUPPORT_EMAIL}` }, 'Contact support') : null,
    h('p', { class: 'small muted' }, 'Fonts: Anton, Barlow and Barlow Condensed (SIL Open Font License). Icons: Lucide (ISC License).')));
}
