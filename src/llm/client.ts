/**
 * InkOS Cloudflare — LLM Client
 * OpenAI-compatible API client for calling various LLM providers
 */

export interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  thinkingBudget?: number;
  extraHeaders?: Record<string, string>;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  thinking?: string;
}

export interface StreamChunk {
  type: 'text' | 'thinking';
  content: string;
}

/**
 * Call an OpenAI-compatible LLM API
 */
export async function callLLM(
  config: LLMConfig,
  messages: LLMMessage[],
  options?: { signal?: AbortSignal },
): Promise<LLMResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`,
    ...config.extraHeaders,
  };

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: config.temperature ?? 0.7,
    max_tokens: config.maxTokens ?? 8192,
    stream: false,
  };

  if (config.thinkingBudget && config.thinkingBudget > 0) {
    body.thinking = { budget_tokens: config.thinkingBudget };
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: options?.signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`LLM API error (${response.status}): ${errorText}`);
  }

  const data = await response.json() as {
    choices: Array<{
      message: {
        content: string | null;
        thinking?: string;
      };
    }>;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  };

  const choice = data.choices[0]!;
  return {
    content: choice.message.content ?? '',
    promptTokens: data.usage?.prompt_tokens ?? 0,
    completionTokens: data.usage?.completion_tokens ?? 0,
    totalTokens: data.usage?.total_tokens ?? 0,
    thinking: choice.message.thinking,
  };
}

/**
 * Stream from an OpenAI-compatible LLM API
 */
export async function* streamLLM(
  config: LLMConfig,
  messages: LLMMessage[],
  options?: { signal?: AbortSignal },
): AsyncGenerator<StreamChunk> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`,
    ...config.extraHeaders,
  };

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: config.temperature ?? 0.7,
    max_tokens: config.maxTokens ?? 8192,
    stream: true,
  };

  if (config.thinkingBudget && config.thinkingBudget > 0) {
    body.thinking = { budget_tokens: config.thinkingBudget };
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: options?.signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`LLM API error (${response.status}): ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') return;

        try {
          const parsed = JSON.parse(data) as {
            choices: Array<{
              delta: { content?: string; reasoning_content?: string };
              finish_reason?: string;
            }>;
          };
          for (const choice of parsed.choices) {
            if (choice.delta.reasoning_content) {
              yield { type: 'thinking', content: choice.delta.reasoning_content };
            }
            if (choice.delta.content) {
              yield { type: 'text', content: choice.delta.content };
            }
          }
        } catch {
          // skip malformed lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}