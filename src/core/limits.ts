export interface TierLimits {
  maxFiles: number;
  maxFileSizeKB: number;
  maxTotalSizeMB: number;
  maxTotalSizeBytes: number;
}

export const FREE_LIMITS: TierLimits = {
  maxFiles: 50,
  maxFileSizeKB: 500,
  maxTotalSizeMB: 4,
  maxTotalSizeBytes: 4 * 1024 * 1024,
};

export const PRO_LIMITS: TierLimits = {
  maxFiles: 200,
  maxFileSizeKB: 10 * 1024,
  maxTotalSizeMB: 20,
  maxTotalSizeBytes: 20 * 1024 * 1024,
};

export function getLimits(isPro: boolean): TierLimits {
  return isPro ? PRO_LIMITS : FREE_LIMITS;
}
