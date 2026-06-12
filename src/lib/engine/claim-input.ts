import { z } from 'zod';
import { CLAIM_TYPES } from '../config/schema';

// Validates the SHAPE of a claim at the API boundary so the pure engine can trust its
// typed contract. Business rules (positive amount, claim type enabled, required custom
// fields) stay in processClaim — this only guards against malformed input (garbage
// submittedAt, non-numeric amount, missing customFieldValues) that would otherwise throw
// a 500 inside the engine. Its inferred type matches the engine's ClaimInput.
export const claimInputSchema = z.object({
  claimType: z.enum(CLAIM_TYPES),
  amount: z.number(),
  submittedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'submittedAt must be an ISO date (YYYY-MM-DD)'),
  customFieldValues: z.record(z.string(), z.unknown()).default({}),
});

export type ParsedClaimInput = z.infer<typeof claimInputSchema>;
