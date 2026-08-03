export interface ProviderLimits {
  requestsPerMinute: number
  requestsPerDay: number
  tokensPerMinute: number
  defaultBatchSize: number
  defaultBatchDelayMs: number
  defaultCooldownMs: number
}

export function estimateTokens(text: string): number {
  if (!text) return 0
  // Rule of thumb: ~4 characters per token for English text
  return Math.ceil(text.length / 4.1)
}

/**
 * Returns rate-limit and throughput defaults for the given provider.
 * Groq Llama is the mandatory provider; Cerebras is a legacy fallback.
 */
export function getLlmLimits(provider: string): ProviderLimits {
  // Groq Llama — mandatory provider
  if (provider === 'groq' || !provider) {
    return {
      requestsPerMinute: 30,
      requestsPerDay: 14400,
      tokensPerMinute: 30000,
      defaultBatchSize: 3,
      defaultBatchDelayMs: 2000,
      defaultCooldownMs: 500,
    }
  }

  // Cerebras — legacy fallback, not recommended
  if (provider === 'cerebras') {
    return {
      requestsPerMinute: 30,
      requestsPerDay: 14400,
      tokensPerMinute: 60000,
      defaultBatchSize: 3,
      defaultBatchDelayMs: 2000,
      defaultCooldownMs: 500,
    }
  }

  // Unknown provider — fall back to Groq defaults (conservative)
  return {
    requestsPerMinute: 30,
    requestsPerDay: 14400,
    tokensPerMinute: 30000,
    defaultBatchSize: 3,
    defaultBatchDelayMs: 2000,
    defaultCooldownMs: 500,
  }
}

export function calculateBatchSize(
  provider: string,
  maxOutputTokens = 16384,
  overrideBatchSize?: number,
): number {
  if (overrideBatchSize !== undefined && overrideBatchSize !== null && overrideBatchSize > 0) {
    return Math.min(10, Math.max(1, overrideBatchSize))
  }

  // Sizing formula: floor((maxOutputTokens - 1000) / 1050)
  const calculated = Math.floor((maxOutputTokens - 1000) / 1050)
  const limits = getLlmLimits(provider)
  const defaultSize = limits.defaultBatchSize

  return Math.min(10, Math.max(1, Math.min(calculated, defaultSize)))
}

