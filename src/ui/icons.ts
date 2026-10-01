// Inline SVG icons (Lucide, MIT): 24 grid, 2px stroke, colour = currentColor. Only these end up in the app.
import {
  createElement, Mic, MicOff, ArrowLeft, ArrowRight, FolderOpen, Scissors, ListMusic, Settings,
  SlidersHorizontal, CircleDot, Play, Square, Plus, Minus, Share, WandSparkles, Volume2, VolumeX, Undo2, Lock,
  Headphones, RotateCcw, Target, Clapperboard, FileAudio, KeyboardMusic, Download, Pencil, Copy, Trash2,
  Ellipsis, ChevronRight, ChevronDown, ChevronUp, Check, X, Repeat, Crown, Drum, Guitar, Piano, Music, Music2, MicVocal,
  Cloud, Sparkle, Sparkles, Hand, Wind, Coffee, Sun, Gem, Disc3, Film, ShieldCheck, AudioLines,
  Rows3, Heart, Zap, TreePalm, Flame, Wine, Feather, Speaker, Moon, Radio, Sunset, Mountain, CloudMoon, Globe,
} from 'lucide';

const ICONS = {
  mic: Mic, 'mic-off': MicOff, back: ArrowLeft, next: ArrowRight, import: FolderOpen, split: Scissors,
  songs: ListMusic, settings: Settings, mix: SlidersHorizontal, record: CircleDot, play: Play, stop: Square,
  add: Plus, minus: Minus, share: Share, fix: WandSparkles, unmute: Volume2, mute: VolumeX, undo: Undo2, lock: Lock,
  headphones: Headphones, again: RotateCcw, teach: Target, video: Clapperboard, audio: FileAudio,
  midi: KeyboardMusic, save: Download, rename: Pencil, duplicate: Copy, delete: Trash2, more: Ellipsis,
  open: ChevronRight, down: ChevronDown, up: ChevronUp, done: Check, close: X, repeat: Repeat, pro: Crown,
  drums: Drum, bass: Guitar, chords: Piano, melody: Music, harmony: Music2, voice: MicVocal,
  pad: Cloud, sparkle: Sparkle, sparkles: Sparkles, shaker: Hand, whoosh: Wind,
  lofi: Coffee, pop: Sun, trap: Gem, dance: Disc3, band: Guitar, cinema: Film,
  rnb: Heart, rock: Zap, reggae: TreePalm, afro: Globe, reggaeton: Flame, funk: Sparkles, jazz: Wine, ballad: Feather,
  edm: Speaker, drill: Moon, garage: Radio, synthwave: Sunset, folk: Mountain, ambient: CloudMoon,
  privacy: ShieldCheck, wave: AudioLines, tracks: Rows3, heart: Heart,
} as const;
export type IconName = keyof typeof ICONS;

export function icon(name: IconName, size = 24): SVGElement {
  const svg = createElement(ICONS[name]);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  return svg;
}
