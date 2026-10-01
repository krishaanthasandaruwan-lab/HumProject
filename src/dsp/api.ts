// The DSP entry points callable through the worker (or inline as a fallback).
import { mtof } from '../synth/fx';
import { RENDERED } from '../synth/rendered';
import { analyzeBeatbox, analyzeCalibration, analyzeMelody } from './analyze';
import { processVoice } from './voice';

/** Pre-render notes of the sample-by-sample instruments (piano, guitar, bells…). */
function renderNotes(i: { items: { id: string; midi: number }[]; sampleRate: number }): Float32Array[] {
  return i.items.map((it) => RENDERED[it.id].render(i.sampleRate, mtof(it.midi)));
}

export const DSP = {
  beatbox: analyzeBeatbox,
  calibration: analyzeCalibration,
  melody: analyzeMelody,
  render: renderNotes,
  voice: processVoice,
};

export type DspApi = typeof DSP;
