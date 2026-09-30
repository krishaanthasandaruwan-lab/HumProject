// Minimal screen router: each screen mounts into #app and returns a cleanup function.
export type Params = Record<string, string>;
export type Screen = (root: HTMLElement, params: Params) => (() => void) | void;

const screens = new Map<string, Screen>();
let cleanup: (() => void) | void;
let current = '';

export function registerScreen(name: string, screen: Screen): void {
  screens.set(name, screen);
}

export function navigate(name: string, params: Params = {}): void {
  const screen = screens.get(name);
  const root = document.getElementById('app');
  if (!screen || !root) return;
  try {
    cleanup?.();
  } catch (err) {
    console.error(err);
  }
  root.replaceChildren();
  current = name;
  window.scrollTo(0, 0);
  cleanup = screen(root, params);
}

export function currentScreen(): string {
  return current;
}
