// The DSP entry points callable through the worker (or inline as a fallback).
import { analyzeBeatbox, analyzeCalibration } from './analyze';

export const DSP = {
  beatbox: analyzeBeatbox,
  calibration: analyzeCalibration,
};

export type DspApi = typeof DSP;
