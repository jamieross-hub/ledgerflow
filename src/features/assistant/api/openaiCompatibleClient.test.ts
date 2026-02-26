import { describe, expect, it, vi } from 'vitest';
import { sendAiChat } from './openaiCompatibleClient';

describe('openaiCompatibleClient baseUrl validation', () => {
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
});
