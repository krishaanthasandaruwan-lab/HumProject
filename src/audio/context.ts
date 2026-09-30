// Shared AudioContext + master bus. The context is created/resumed inside a tap (iOS rule).
type SessionType = 'auto' | 'playback' | 'play-and-record' | 'ambient';

let ctx: AudioContext | undefined;
let master: GainNode | undefined;
let limiter: DynamicsCompressorNode | undefined;
let streamDest: MediaStreamAudioDestinationNode | undefined;

export function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export function getCtx(): AudioContext {
  if (!ctx) {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const opts: AudioContextOptions = { latencyHint: 'interactive' };
    if (isIOS()) opts.sampleRate = 48000; // iOS mic runs at 48 kHz; mismatches cause silence
    try {
      ctx = new Ctor(opts);
    } catch {
      ctx = new Ctor();
    }
    master = ctx.createGain();
    master.gain.value = 0.85;
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 4;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    master.connect(limiter).connect(ctx.destination);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && ctx && ctx.state !== 'running') {
        ctx.resume().catch(() => undefined);
      }
    });
  }
  return ctx;
}

/** Everything audible goes through here (then a limiter, then the speakers). */
export function getMaster(): GainNode {
  getCtx();
  return master as GainNode;
}

/** Master output as a MediaStream — used to record video with sound. */
export function getStreamDest(): MediaStreamAudioDestinationNode {
  const c = getCtx();
  if (!streamDest) {
    streamDest = c.createMediaStreamDestination();
    (limiter as DynamicsCompressorNode).connect(streamDest);
  }
  return streamDest;
}

/** Output-side latency the browser reports (seconds). */
export function outputLatency(): number {
  const c = getCtx();
  return (c.outputLatency || 0) + (c.baseLatency || 0);
}

/** Safari 16.4+ Audio Session API: switch between recording and loud playback routing. */
export function setAudioSession(type: SessionType): void {
  const nav = navigator as Navigator & { audioSession?: { type: string } };
  if (nav.audioSession) {
    try {
      nav.audioSession.type = type;
    } catch {
      /* unsupported value */
    }
  }
}

export async function unlockAudio(): Promise<AudioContext> {
  const c = getCtx();
  const resumed = c.state === 'running' ? Promise.resolve() : c.resume();
  // A silent buffer finishes the unlock on older iOS versions.
  const b = c.createBuffer(1, 1, c.sampleRate);
  const s = c.createBufferSource();
  s.buffer = b;
  s.connect(c.destination);
  s.start(0);
  try {
    await resumed;
  } catch {
    /* will retry on next tap */
  }
  return c;
}

/** Resume audio on the first user gesture anywhere in the app. */
export function installUnlock(): void {
  const events = ['pointerdown', 'touchend', 'keydown'] as const;
  const handler = (): void => {
    unlockAudio().then((c) => {
      if (c.state === 'running') events.forEach((e) => document.removeEventListener(e, handler, true));
    });
  };
  events.forEach((e) => document.addEventListener(e, handler, true));
}
