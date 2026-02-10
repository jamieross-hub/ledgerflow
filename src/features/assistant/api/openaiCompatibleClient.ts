import { ENV } from '../../../shared/config/env';

/**
 * OpenAI 兼容客户端：
 * - 支持 GET /models
 * - 支持 POST /chat/completions（含可选图片）
 * - 默认读取前端 ENV，也可被页面输入覆盖
 */

interface OpenAiModel {
  id: string;
}

interface ModelsResponse {
  data?: OpenAiModel[];
}

interface ChatMessageInput {
  role: 'system' | 'user' | 'assistant';
  text: string;
  imageDataUrl?: string;
  imageDataUrls?: string[];
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type: 'text'; text: string }>;
      reasoning_content?: string;
      reasoning?: string;
    };
  }>;
}

interface ChatCompletionStreamChunk {
  choices?: Array<{
    delta?: {
      content?: string;
    };
    message?: {
      content?: string | Array<{ type: 'text'; text: string }>;
    };
  }>;
}

export interface SendAiChatResult {
  content: string;
  reasoning?: string;
}

export async function sendAiChatStream(
  input: ChatRequestInput,
  handlers: {
    onDelta: (delta: string) => void;
    onDone?: (content: string) => void;
    onError?: (error: Error) => void;
  }
): Promise<void> {
  const outboundMessages: ChatMessageInput[] = [
    ...(input.systemPrompt ? [{ role: 'system' as const, text: input.systemPrompt }] : []),
    ...input.messages
  ];

  const response = await fetch(`${normalizeBaseUrl(input.baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(input.apiKey),
    body: JSON.stringify({
      model: input.model,
      stream: true,
      messages: outboundMessages.map((message) => {
        const imageUrls = Array.isArray(message.imageDataUrls) && message.imageDataUrls.length > 0
          ? message.imageDataUrls
          : message.imageDataUrl
            ? [message.imageDataUrl]
            : [];

        if (message.role === 'user' && imageUrls.length > 0) {
          return {
            role: message.role,
            content: [
              { type: 'text', text: message.text || '请基于图片进行记账建议分析。' },
              ...imageUrls.map((url) => ({ type: 'image_url' as const, image_url: { url } }))
            ]
          };
        }

        return {
          role: message.role,
          content: message.text
        };
      })
    })
  });

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => '');
    const error = new Error(`流式对话请求失败：HTTP ${response.status} ${detail}`.trim());
    handlers.onError?.(error);
    throw error;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullText = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.replace(/^data:\s*/, '');
        if (payload === '[DONE]') {
          handlers.onDone?.(fullText);
          return;
        }

        try {
          const chunk = JSON.parse(payload) as ChatCompletionStreamChunk;
          const delta = chunk.choices?.[0]?.delta?.content || '';
          if (delta) {
            fullText += delta;
            handlers.onDelta(delta);
          }
        } catch {
          // ignore malformed chunk
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  handlers.onDone?.(fullText);
}

interface ChatRequestInput {
  baseUrl?: string;
  apiKey?: string;
  model: string;
  messages: ChatMessageInput[];
  systemPrompt?: string;
}

function normalizeBaseUrl(baseUrl?: string) {
  // 统一去除尾部 /，避免出现 //models
  return (baseUrl || ENV.aiBaseUrl).replace(/\/$/, '');
}

function buildHeaders(apiKey?: string) {
  const token = apiKey || ENV.aiApiKey;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

export async function fetchAiModels(baseUrl?: string, apiKey?: string): Promise<string[]> {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/models`, {
    method: 'GET',
    headers: buildHeaders(apiKey)
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`模型列表获取失败：HTTP ${response.status} ${detail}`.trim());
  }

  const payload = (await response.json()) as ModelsResponse;
  return (payload.data || []).map((item) => item.id).filter(Boolean);
}

function normalizeMessageContent(content: string | Array<{ type: 'text'; text: string }> | undefined) {
  if (!content) {
    return '';
  }

  if (typeof content === 'string') {
    return content;
  }

  return content
    .filter((item) => item.type === 'text')
    .map((item) => item.text)
    .join('\n');
}

export async function sendAiChat(input: ChatRequestInput): Promise<SendAiChatResult> {
  const outboundMessages: ChatMessageInput[] = [
    ...(input.systemPrompt ? [{ role: 'system' as const, text: input.systemPrompt }] : []),
    ...input.messages
  ];

  const response = await fetch(`${normalizeBaseUrl(input.baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(input.apiKey),
    body: JSON.stringify({
      model: input.model,
      messages: outboundMessages.map((message) => {
        const imageUrls = Array.isArray(message.imageDataUrls) && message.imageDataUrls.length > 0
          ? message.imageDataUrls
          : message.imageDataUrl
            ? [message.imageDataUrl]
            : [];

        if (message.role === 'user' && imageUrls.length > 0) {
          return {
            role: message.role,
            content: [
              { type: 'text', text: message.text || '请基于图片进行记账建议分析。' },
              ...imageUrls.map((url) => ({ type: 'image_url' as const, image_url: { url } }))
            ]
          };
        }

        return {
          role: message.role,
          content: message.text
        };
      })
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`对话请求失败：HTTP ${response.status} ${detail}`.trim());
  }

  const payload = (await response.json()) as ChatCompletionResponse;
  const first = payload.choices?.[0]?.message;
  const content = normalizeMessageContent(first?.content);
  const reasoning = String(first?.reasoning_content || first?.reasoning || '').trim();

  return {
    content: content || '模型未返回可解析内容',
    reasoning: reasoning || undefined
  };
}
