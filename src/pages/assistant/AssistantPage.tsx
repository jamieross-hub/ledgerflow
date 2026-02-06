import { FormEvent, useMemo, useState } from 'react';
import { fetchAiModels, sendAiChat } from '../../features/assistant/api/openaiCompatibleClient';
import { useAiSettings } from '../../shared/store/useAiSettings';

/**
 * 记账助手页面：
 * - AI 参数统一来自“设置”页，当前页面只负责对话与上传
 */
interface ChatItem {
  role: 'user' | 'assistant';
  text: string;
  imageDataUrl?: string;
}

export function AssistantPage() {
  const baseUrl = useAiSettings((s) => s.baseUrl);
  const apiKey = useAiSettings((s) => s.apiKey);
  const model = useAiSettings((s) => s.model);
  const [models, setModels] = useState<string[]>([]);
  const [textInput, setTextInput] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState<string>('');
  const [loadingModels, setLoadingModels] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [messages, setMessages] = useState<ChatItem[]>([
    {
      role: 'assistant',
      text: '你好，我是记账助手。你可以发送文本或图片，我会给出分录建议、分类建议和风险提示。'
    }
  ]);

  const canSubmit = useMemo(
    () => Boolean(model.trim()) && (Boolean(textInput.trim()) || Boolean(imageDataUrl)),
    [model, textInput, imageDataUrl]
  );

  // 把上传图片转成 Data URL，用于直接发给兼容视觉模型
  const handleFileChange = async (file?: File) => {
    if (!file) {
      setImageDataUrl('');
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('图片读取失败'));
      reader.readAsDataURL(file);
    });

    setImageDataUrl(dataUrl);
  };

  // 通过 OpenAI 兼容接口拉取可用模型列表
  const handleLoadModels = async () => {
    setError('');
    setLoadingModels(true);
    try {
      const list = await fetchAiModels(baseUrl, apiKey);
      setModels(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : '模型列表加载失败');
    } finally {
      setLoadingModels(false);
    }
  };

  // 提交对话：将历史消息与当前输入一起发送给模型
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setSubmitting(true);
    setError('');

    const userMessage: ChatItem = {
      role: 'user',
      text: textInput.trim(),
      imageDataUrl: imageDataUrl || undefined
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);

    try {
      const reply = await sendAiChat({
        baseUrl,
        apiKey,
        model,
        messages: nextMessages.map((item) => ({
          role: item.role,
          text: item.text,
          imageDataUrl: item.imageDataUrl
        }))
      });

      setMessages((prev: ChatItem[]) => [...prev, { role: 'assistant', text: reply }]);
      setTextInput('');
      setImageDataUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '对话请求失败');
      setMessages((prev: ChatItem[]) => prev.slice(0, -1));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="assistant-layout">
      <section className="panel assistant-config">
        <h2>记账助手</h2>
        <p>OpenAI 兼容接口参数已统一迁移至“设置”页维护。</p>

        <div className="row">
          <small className="mono">当前供应商：{baseUrl || '未设置'}</small>
          <small className="mono">当前模型：{model || '未设置'}</small>
          <button type="button" onClick={() => void handleLoadModels()} disabled={loadingModels}>
            {loadingModels ? '加载中...' : '拉取模型列表'}
          </button>
        </div>

        {models.length > 0 ? (
          <div className="field">
            <label>可用模型（只读展示）</label>
            <textarea readOnly rows={4} value={models.join('\n')} />
          </div>
        ) : null}
      </section>

      <section className="panel assistant-chat-panel">
        <div className="assistant-chat-window">
          {messages.map((item, index) => (
            <article key={`${item.role}-${index}`} className={item.role === 'user' ? 'chat-bubble user' : 'chat-bubble assistant'}>
              <header>{item.role === 'user' ? '你' : '助手'}</header>
              <p>{item.text || '（仅图片）'}</p>
              {item.imageDataUrl ? <img src={item.imageDataUrl} alt="user upload" className="chat-image" /> : null}
            </article>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="assistant-form">
          <div className="field">
            <label>输入文本</label>
            <textarea
              rows={4}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="例如：帮我识别这张小票并生成记账建议，包含分类和金额。"
            />
          </div>

          <div className="row">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                void handleFileChange(e.target.files?.[0]);
              }}
            />
            {imageDataUrl ? <small>已加载图片</small> : <small>可选：上传图片辅助识别</small>}
          </div>

          <div className="row">
            <button type="submit" className="primary" disabled={!canSubmit || submitting}>
              {submitting ? '发送中...' : '发送给记账助手'}
            </button>
          </div>

          {error ? <p className="error">{error}</p> : null}
        </form>
      </section>
    </div>
  );
}
