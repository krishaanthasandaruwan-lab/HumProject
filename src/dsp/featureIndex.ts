// Feature layout shared by the extractor (worker) and the classifier (also used on the main thread).
export const FEATURE_NAMES = [
  'rmsDb', 'centroidKHz', 'flatness', 'zcr', 'low', 'high',
  'mfcc1', 'mfcc2', 'mfcc3', 'mfcc4', 'mfcc5', 'mfcc6', 'mfcc7', 'mfcc8',
] as const;
export const FEATURE_DIM = FEATURE_NAMES.length;
export const F = { rmsDb: 0, centroid: 1, flatness: 2, zcr: 3, low: 4, high: 5 } as const;
