import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendAiChat } from './openaiCompatibleClient';

describe('openaiCompatibleClient baseUrl validation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  it('rejects non-https protocols to avoid unsafe endpoint usage', async () => {
    await expect(
      sendAiChat({
        baseUrl: 'javascript:alert(1)',
        model: 'test-model',
        messages: [{ role: 'user', text: 'hello' }]
      })
    ).rejects.toThrow('仅支持 HTTPS 协议');

    await expect(
      sendAiChat({
        baseUrl: 'http://api.example.com/v1',
        model: 'test-model',
        messages: [{ role: 'user', text: 'hello' }]
      })
    ).rejects.toThrow('仅支持 HTTPS 协议');
  });

  it('normalizes trailing slash before requesting', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 })
      );

    await sendAiChat({
      baseUrl: 'https://api.example.com/v1/',
      model: 'test-model',
      messages: [{ role: 'user', text: 'hello' }]
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/v1/chat/completions',
      expect.objectContaining({ method: 'POST' })
    );

    fetchMock.mockRestore();
  });
  it('hides backend plaintext error details and returns stable error code', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('upstream failed token=abc123 https://internal.example.com', { status: 502 })
    );
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(
      sendAiChat({
        baseUrl: 'https://api.example.com/v1',
        model: 'test-model',
        messages: [{ role: 'user', text: 'hello' }]
      })
    ).rejects.toThrow('AI 服务请求失败（错误码：AI_CHAT_HTTP_502）');

    expect(warnSpy).toHaveBeenCalledWith(
      '[AI_HTTP_ERROR]',
      expect.objectContaining({ code: 'AI_CHAT_HTTP_502', status: 502 })
    );
    const warnPayload = warnSpy.mock.calls[0]?.[1] as { detail?: string } | undefined;
    expect(warnPayload?.detail || '').not.toContain('abc123');
    expect(warnPayload?.detail || '').not.toContain('internal.example.com');
  });
});
