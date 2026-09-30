// The DSP entry points callable through the worker (or inline as a fallback).
import { analyzeBeatbox, analyzeCalibration, analyzeMelody } from './analyze';

export const DSP = {
  beatbox: analyzeBeatbox,
  calibration: analyzeCalibration,
  melody: analyzeMelody,
};

export type DspApi = typeof DSP;
