import { ClipboardEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { fetchAiModels, sendAiChat } from '../api/openaiCompatibleClient';
import type { Account } from '../../../entities/account/types';
import type { Category } from '../../../entities/category/types';
import type { TransactionItem } from '../../../entities/transaction/types';
import { useDebugLogStore } from '../../../shared/store/useDebugLogStore';
import {
  buildTimeContext,
  buildTransactionPromptContext,
  extractJsonString,
  JSON_AGENT_PROMPT,
  normalizeAiBill,
  readImageAsDataUrl,
  toDraftEntries,
  validateDraft
} from './workbenchUtils';
import {
  ensureCategoryId,
  inferCategoryFromText,
  inferTags,
  mapAssistantErrorMessage,
  resolveAccountId
} from './workbenchMapping';
import type { AssistantToastState, DraftBillEntry, WorkbenchStatus } from './workbenchTypes';

interface UseAssistantWorkbenchInput {
  baseUrl: string;
  apiKey: string;
  model: string;
  categories: Category[];
  accounts: Account[];
  transactions: TransactionItem[];
  addCategory: (name: string) => string;
  addTransaction: (payload: Omit<TransactionItem, 'id'>) => string;
}

export function useAssistantWorkbench(input: UseAssistantWorkbenchInput) {
  const { addLog } = useDebugLogStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [status, setStatus] = useState<WorkbenchStatus>('idle');
  const [textInput, setTextInput] = useState('');
  const [imageDataUrls, setImageDataUrls] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [entries, setEntries] = useState<DraftBillEntry[]>([]);
  const [error, setError] = useState('');
  const [rawContent, setRawContent] = useState('');
  const [rawReasoning, setRawReasoning] = useState('');
  const [toast, setToast] = useState<AssistantToastState>({
    message: '',
    variant: 'success',
    visible: false
  });

  const hasApiKey = Boolean(input.apiKey.trim());
  const hasInput = Boolean(textInput.trim()) || imageDataUrls.length > 0;
  const canRecognize = hasApiKey && Boolean(input.model.trim()) && hasInput;
  const transactionContext = useMemo(
    () => buildTransactionPromptContext(input.transactions, input.categories, input.accounts),
    [input.transactions, input.categories, input.accounts]
  );

  useEffect(() => {
    if (status === 'recognizing' || status === 'saving' || status === 'preview') return;
    if (entries.length > 0) return setStatus('preview');
    setStatus(hasInput ? 'ready' : 'idle');
  }, [status, hasInput, entries.length]);

  const handleSetImage = async (file?: File) => {
    if (!file) return;
    const dataUrl = await readImageAsDataUrl(file);
    setImageDataUrls((prev) => [...prev, dataUrl]);
  };

  const handlePasteImage = async (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i += 1) {
      if (!items[i].type.startsWith('image/')) continue;
      const file = items[i].getAsFile();
      if (!file) continue;
      event.preventDefault();
      await handleSetImage(file);
    }
  };

  const handleDropImage = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files || []).filter((file) =>
      file.type.startsWith('image/')
    );
    for (const file of files) await handleSetImage(file);
  };

  const handleLoadModels = async () => {
    if (!hasApiKey) return setError('请先填写 API Key');
    setLoadingModels(true);
    setError('');
    try {
      setModels(await fetchAiModels(input.baseUrl, input.apiKey));
      setToast({ visible: true, variant: 'success', message: '模型列表刷新成功' });
    } catch (err) {
      setError(err instanceof Error ? err.message : '模型拉取失败');
    } finally {
      setLoadingModels(false);
    }
  };

  const handleRecognize = async (event: FormEvent) => {
    event.preventDefault();
    if (!canRecognize) return;
    setStatus('recognizing');
    setError('');
    addLog({ action: 'assistant.recognize', status: 'pending', message: '开始识别请求' });
    try {
      const prompt = `${JSON_AGENT_PROMPT}\n\n${await buildTimeContext()}\n\n账本交易数据快照：\n${transactionContext}`;
      const reply = await sendAiChat({
        baseUrl: input.baseUrl,
        apiKey: input.apiKey,
        model: input.model,
        systemPrompt: prompt,
        messages: [{ role: 'user', text: textInput.trim(), imageDataUrls }]
      });
      setRawContent(reply.content);
      setRawReasoning(reply.reasoning || '');
      const parsed = normalizeAiBill(JSON.parse(extractJsonString(reply.content)) as unknown);
      if (!parsed) throw new Error('未识别出可保存的 JSON 账单');
      setEntries(toDraftEntries(parsed));
      setTextInput('');
      setImageDataUrls([]);
      setStatus('preview');
      addLog({
        action: 'assistant.recognize',
        status: 'success',
        message: `识别成功，条目 ${parsed.transactions.length}`
      });
    } catch (err) {
      const message = err instanceof Error ? mapAssistantErrorMessage(err.message) : '识别失败';
      setError(message);
      setStatus('error');
      addLog({ action: 'assistant.recognize', status: 'error', message });
    }
  };

  const updateEntry = (id: string, patch: Partial<DraftBillEntry>) => {
    setEntries((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...patch };
        return { ...next, issues: validateDraft(next) };
      })
    );
  };

  const removeEntry = (id: string) => setEntries((prev) => prev.filter((item) => item.id !== id));

  const saveSelected = () => {
    const rows = entries.filter((item) => item.selected && item.issues.length === 0);
    if (rows.length === 0)
      return setToast({ visible: true, variant: 'warning', message: '没有可保存的有效账单' });
    setStatus('saving');
    addLog({ action: 'assistant.save', status: 'pending', message: `准备保存 ${rows.length} 条` });
    rows.forEach((item) => {
      const type = item.type === 'unknown' ? 'expense' : item.type;
      const category = item.category.trim() || inferCategoryFromText(type, item.note || '');
      input.addTransaction({
        type,
        amount: item.amount,
        date: item.date || new Date().toISOString(),
        note: item.note || 'AI 导入账单',
        tags: inferTags(type, item.note, category, item.tags || ['AI识别']),
        categoryId: ensureCategoryId(category, input.categories, input.addCategory),
        accountId: resolveAccountId(item.account, input.accounts),
        orderNo: item.orderNo?.trim() || undefined,
        merchantOrderNo: item.merchantOrderNo?.trim() || undefined,
        source: 'ai'
      });
    });
    setEntries([]);
    setStatus('saved');
    setToast({ visible: true, variant: 'success', message: `已保存 ${rows.length} 条账单` });
    addLog({ action: 'assistant.save', status: 'success', message: `保存完成 ${rows.length} 条` });
  };

  const resetWorkbench = () => {
    setTextInput('');
    setImageDataUrls([]);
    setEntries([]);
    setRawContent('');
    setRawReasoning('');
    setError('');
    setStatus('idle');
  };

  return {
    fileInputRef,
    textareaRef,
    status,
    textInput,
    setTextInput,
    imageDataUrls,
    setImageDataUrls,
    models,
    loadingModels,
    drawerOpen,
    setDrawerOpen,
    entries,
    setEntries,
    error,
    rawContent,
    rawReasoning,
    toast,
    hasApiKey,
    canRecognize,
    handleSetImage,
    handlePasteImage,
    handleDropImage,
    handleLoadModels,
    handleRecognize,
    updateEntry,
    removeEntry,
    saveSelected,
    resetWorkbench,
    applyCommand: (prompt: string) => {
      setTextInput(prompt);
      window.requestAnimationFrame(() => textareaRef.current?.focus());
    },
    setToastVisible: (visible: boolean) => setToast((prev) => ({ ...prev, visible })),
    setToastState: (message: string, variant: AssistantToastState['variant']) =>
      setToast({ visible: true, message, variant })
  };
}
