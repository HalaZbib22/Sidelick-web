/**
 * Identity-verification provider seam.
 *
 * Pilot uses `manualProvider`: store the ID + selfie privately and leave the
 * walker `pending` for a human admin to face-match. To go automated later,
 * implement a provider (Uqudo / Sumsub / Veriff …) whose `submit()` calls the
 * vendor API and returns a real `verified`/`rejected` decision, then swap
 * `activeProvider`. Nothing else in the app changes.
 */
export interface VerificationSubmission {
  docRef: string; // private storage reference for the ID document
  selfieRef: string; // private storage reference for the live selfie
  docType: "national_id" | "drivers_license" | "passport";
}

export interface VerificationOutcome {
  provider: string;
  status: "pending" | "verified" | "rejected";
  result: unknown | null; // raw provider payload when automated
}

export interface VerificationProvider {
  submit(submission: VerificationSubmission): Promise<VerificationOutcome>;
}

export const manualProvider: VerificationProvider = {
  async submit() {
    // No external call — a human reviews in the admin portal.
    return { provider: "manual", status: "pending", result: null };
  },
};

// Swap this (via config/env) when an automated IDV provider is integrated.
export const activeProvider: VerificationProvider = manualProvider;
