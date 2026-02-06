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
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type: 'text'; text: string }>;
    };
  }>;
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

export async function sendAiChat(input: ChatRequestInput): Promise<string> {
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
        if (message.role === 'user' && message.imageDataUrl) {
          return {
            role: message.role,
            content: [
              { type: 'text', text: message.text || '请基于图片进行记账建议分析。' },
              { type: 'image_url', image_url: { url: message.imageDataUrl } }
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
  const content = normalizeMessageContent(payload.choices?.[0]?.message?.content);
  return content || '模型未返回可解析内容';
}
