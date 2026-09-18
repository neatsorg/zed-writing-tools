import { proofread } from '../engines/proofread.js';

// Composition root for the proofreading extension.
export const inspections = [{ id: 'textlint.preset-japanese', inspect: proofread }];
