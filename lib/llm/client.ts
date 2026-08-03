import { getLlmLimits, estimateTokens } from './limits'

export interface LlmConfig {
  provider: 'groq' | 'cerebras'
  model?: string
  apiKey: string
  maxOutputTokens?: number
}

const requestHistory: Array<{ timestamp: number; tokens: number }> = []

async function enforceRateLimits(provider: string, estTokens: number) {
  const limits = getLlmLimits(provider)
  const rpm = limits.requestsPerMinute
  const tpm = limits.tokensPerMinute

  while (true) {
    const now = Date.now()
    // Clean history older than 60s
    while (requestHistory.length > 0 && requestHistory[0].timestamp < now - 60000) {
      requestHistory.shift()
    }

    // Check RPM
    if (requestHistory.length >= rpm) {
      const waitTime = requestHistory[0].timestamp + 60000 - now
      console.log(`[RATE LIMIT] RPM limit reached (${requestHistory.length}/${rpm}). Waiting ${waitTime}ms...`)
      await new Promise((r) => setTimeout(r, waitTime))
      continue
    }

    // Check TPM
    const currentTokens = requestHistory.reduce((sum, item) => sum + item.tokens, 0)
    if (currentTokens + estTokens >= tpm) {
      const waitTime = requestHistory[0].timestamp + 60000 - now
      console.log(`[RATE LIMIT] TPM limit reached (${currentTokens + estTokens}/${tpm}). Waiting ${waitTime}ms...`)
      await new Promise((r) => setTimeout(r, waitTime))
      continue
    }

    // Passed both checks
    requestHistory.push({ timestamp: now, tokens: estTokens })
    break
  }
}

/**
 * Resolve the API key from config or environment.
 * Supports both LLM_API_KEY and GROQ_API_KEY env vars.
 */
function resolveApiKey(config: LlmConfig): string {
  if (config.apiKey) return config.apiKey
  // Fallback to env aliases
  const envKey =
    process.env.LLM_API_KEY ||
    process.env.GROQ_API_KEY ||
    ''
  return envKey
}

export async function callLlm(
  systemPrompt: string,
  userPrompt: string,
  config: LlmConfig,
): Promise<string> {
  const provider = config.provider || 'groq'
  const estTokens = estimateTokens(systemPrompt + userPrompt)
  await enforceRateLimits(provider, estTokens)

  const apiKey = resolveApiKey(config)

  if (!apiKey) {
    throw new Error(
      `API key is missing for provider: ${provider}. ` +
        'Set LLM_API_KEY or GROQ_API_KEY in your environment.',
    )
  }

  let endpoint = ''
  let defaultModel = ''

  // Groq Llama is the mandatory provider
  if (provider === 'groq') {
    endpoint = 'https://api.groq.com/openai/v1/chat/completions'
    defaultModel = 'llama-3.3-70b-versatile'
  } else if (provider === 'cerebras') {
    // Legacy fallback — not recommended for production use
    endpoint = 'https://api.cerebras.ai/v1/chat/completions'
    defaultModel = 'llama3.1-8b'
  } else {
    throw new Error(`Unsupported LLM provider: ${provider}. Use 'groq' (recommended) or 'cerebras'.`)
  }

  const model = config.model || defaultModel
  // For Groq, clamp max_tokens to 2048 max to prevent prompt + max_tokens from exceeding 12,000 TPM limit
  const maxTokens = provider === 'groq' 
    ? Math.min(config.maxOutputTokens || 1024, 2048) 
    : (config.maxOutputTokens || 4096)

  const payload = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0,
    max_tokens: maxTokens,
  }

  let res: Response
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    })
  } catch (err: unknown) {
    throw new Error(`Network error calling LLM provider ${provider}: ${err instanceof Error ? err.message : String(err)}`)
  }

  if (!res.ok) {
    let errorText = ''
    try {
      errorText = await res.text()
    } catch {
      errorText = 'Could not read error body'
    }
    // Embed the status code in the error message so retry logic can recover
    class LlmStatusError extends Error {
      status: number
      constructor(msg: string, status: number) {
        super(msg)
        this.status = status
        this.name = 'LlmStatusError'
      }
    }
    throw new LlmStatusError(`LLM provider returned status ${res.status}: ${errorText}`, res.status)
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }

  const content = data.choices?.[0]?.message?.content
  if (content === undefined || content === null) {
    throw new Error('LLM response returned empty content choices')
  }

  return content
}

export async function generateChatResponse(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY || process.env.LLM_API_KEY || ''
  const isMock = !apiKey || process.env.MOCK_LLM === 'true'

  if (isMock) {
    // Generate grounded mock response referencing review IDs in context
    const citationMatches = prompt.match(/Review ID: [a-zA-Z0-9_-]+/g) || []
    const refIds = citationMatches.slice(0, 3).map((match) => match.replace('Review ID: ', ''))
    const citationsList = refIds.length > 0 ? refIds.map((id) => `[Review ID: ${id}]`).join(', ') : '[Review ID: rev_1]'

    return `Based on the grounded analysis of this run's reviews, users frequently experience category discovery barriers. Specifically, customers feel that category entry points are buried. For example, as noted in ${citationsList}, navigation overload prevents casual buyers from discovering new options beyond their initial reorder habits.`
  }

  // Call live LLM (non-json mode)
  const endpoint = 'https://api.groq.com/openai/v1/chat/completions'
  const payload = {
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: 'You are a PM assistant answering questions strictly grounded in review evidence.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0,
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    throw new Error(`LLM provider returned status ${res.status} for chat.`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content || 'No answer generated.'
}


