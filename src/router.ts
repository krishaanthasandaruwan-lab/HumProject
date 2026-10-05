// Minimal screen router: each screen mounts into #app and returns a cleanup function.
export type Params = Record<string, string>;
export type Screen = (root: HTMLElement, params: Params) => (() => void) | void;

const screens = new Map<string, Screen>();
let cleanup: (() => void) | void;
let current = '';
let currentParams: Params = {};
let generation = 0;
export const screenGeneration = (): number => generation;

export function registerScreen(name: string, screen: Screen): void {
  screens.set(name, screen);
}

export function navigate(name: string, params: Params = {}): void {
  const screen = screens.get(name);
  const root = document.getElementById('app');
  if (!screen || !root) return;
  generation++;
  window.dispatchEvent(new Event('humm:navigate'));
  try {
    cleanup?.();
  } catch (err) {
    console.error(err);
  }
  root.replaceChildren();
  current = name;
  currentParams = params;
  window.scrollTo(0, 0);
  cleanup = screen(root, params);
}

export function currentScreen(): string {
  return current;
}

/** Draw the current screen again (e.g. after Pro unlocks), with the same params. */
export function reload(): void {
  navigate(current, currentParams);
}
