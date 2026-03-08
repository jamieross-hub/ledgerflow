import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AssistantPage } from './AssistantPage';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
});

Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
  writable: true,
  value: vi.fn()
});

const navigateMock = vi.fn();
const useAssistantWorkbenchMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'assistant.ui.assistantMode': 'AI 助手',
        'assistant.ui.bookkeepingAssistant': 'AI 记账助手',
        'assistant.ui.qaAssistant': 'AI 助手',
        'assistant.ui.quickAdd': '快速记一笔',
        'assistant.ui.clearContext': '清空上下文',
        'assistant.ui.selectModel': '选择模型',
        'assistant.ui.needApiKeyTitle': '请先配置 API Key',
        'assistant.ui.needApiKeyDesc': '需要先配置模型能力',
        'assistant.ui.goSettings': '前往设置',
        'assistant.placeholders.assistantHint': '问点财务问题',
        'assistant.placeholders.bookkeepingHint': '记一笔',
        'assistant.placeholders.readyAssistant': '助手就绪',
        'assistant.placeholders.readyBookkeeping': '记账就绪',
        'assistant.placeholders.idleBookkeeping': '空闲记账',
        'assistant.placeholders.recognizing': '识别中',
        'assistant.placeholders.preview': '预览中',
        'assistant.placeholders.saving': '保存中',
        'assistant.placeholders.saved': '已保存',
        'assistant.placeholders.error': '出错了',
        'assistant.placeholders.needApiKey': '缺少 Key'
      };
      return map[key] || key;
    }
  })
}));

vi.mock('../../shared/store/useAiSettings', () => ({
  useAiSettings: (selector: (state: any) => unknown) =>
    selector({
      baseUrl: 'https://example.com/v1',
      apiKey: 'test-key',
      model: 'gpt-test',
      setModel: vi.fn(),
      showEmbeddingSummary: false,
      showEmbeddingDebug: false
    })
}));


const addDebtMock = vi.fn();

vi.mock('../../shared/store/useAppPreferences', () => ({
  useAppPreferences: (selector: (state: any) => unknown) =>
    selector({
      addDebt: addDebtMock
    })
}));

vi.mock('../../shared/store/useFinanceStore', () => ({
  useFinanceStore: (selector: (state: any) => unknown) =>
    selector({
      categories: [],
      accounts: [],
      transactions: [],
      addCategory: vi.fn(),
      addAccount: vi.fn(),
      addTransaction: vi.fn(),
      updateTransaction: vi.fn()
    })
}));

vi.mock('../../features/assistant/api/openaiCompatibleClient', () => ({
  sendAiChat: vi.fn(async () => ({
    content: JSON.stringify([
      {
        label: '测试快捷问题一',
        prompt: '请给我一条测试用的信贷分析问题。'
      },
      {
        label: '测试快捷问题二',
        prompt: '请给我另一条测试用的信贷分析问题。'
      }
    ])
  }))
}));

vi.mock('../../features/assistant/workbench/useAssistantWorkbench', () => ({
  useAssistantWorkbench: (...args: unknown[]) => useAssistantWorkbenchMock(...args)
}));

function createWorkbenchMock() {
  return {
    hasApiKey: true,
    loadingModels: false,
    handleLoadModels: vi.fn(),
    models: ['gpt-test'],
    status: 'idle',
    resetWorkbench: vi.fn(),
    imageDataUrls: [],
    pdfDataUrls: [],
    handleDropImage: vi.fn(),
    handleRecognizeWithPrompt: vi.fn(),
    setTextInput: vi.fn(),
    textInput: '',
    canRecognize: true,
    error: '',
    rawContent: '',
    rawReasoning: '',
    lastUsage: null,
    embeddingDebug: {
      enabled: false,
      used: false,
      downgraded: false,
      reason: '',
      latencyMs: 0,
      indexedDocs: 0,
      hitCount: 0,
      topScore: 0,
      averageScore: 0,
      hits: [],
      model: ''
    },
    semanticRecallCacheMeta: {
      exists: false,
      indexedDocs: 0,
      updatedAt: 0,
      model: ''
    },
    refreshSemanticRecallCacheMeta: vi.fn(),
    clearSemanticRecallIndex: vi.fn(() => true),
    setToastState: vi.fn(),
    entries: [],
    saveSelected: vi.fn(() => true),
    setImageDataUrls: vi.fn(),
    setPdfDataUrls: vi.fn(),
    removeImageAt: vi.fn(),
    removePdfAt: vi.fn(),
    triggerImagePicker: vi.fn(),
    triggerPdfPicker: vi.fn(),
    handleImageInputChange: vi.fn(),
    handlePdfInputChange: vi.fn(),
    fileInputRef: { current: null },
    pdfInputRef: { current: null },
    textareaRef: { current: null },
    drawerOpen: false,
    setDrawerOpen: vi.fn(),
    toast: { visible: false, message: '', variant: 'success' }
  };
}

describe('AssistantPage', () => {
  it('应支持切换到 AI 信贷管家并展示信贷首屏内容', () => {
    useAssistantWorkbenchMock.mockReturnValue(createWorkbenchMock());

    render(
      <MemoryRouter>
        <AssistantPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'AI 信贷管家' }));

    expect(screen.getAllByRole('button', { name: 'AI 信贷管家' }).length).toBeGreaterThan(0);
    expect(screen.getByText('信贷场景提问')).toBeInTheDocument();
    expect(screen.getByText('梳理本月应还')).toBeInTheDocument();
  });

  it('信贷识别结果应支持直接保存到还款管理', () => {
    useAssistantWorkbenchMock.mockReturnValue({
      ...createWorkbenchMock(),
      rawContent: '已识别完成',
      status: 'ready'
    });

    const sessionStorageGetItemSpy = vi
      .spyOn(window.sessionStorage.__proto__, 'getItem')
      .mockImplementation((key) => {
        if (String(key).includes('chatHistory.credit')) {
          return JSON.stringify([
            {
              id: 'credit-assistant-0',
              role: 'assistant',
              text: '这是识别后的结果',
              creditItems: [
                {
                  id: 'credit-0',
                  title: '招联消费贷',
                  productType: '消费贷',
                  dueAmount: '998',
                  totalDebt: '4200',
                  repaymentDate: '每月12日',
                  remainingPeriods: '5',
                  monthlyAmount: '998',
                  interest: '15.2',
                  pendingFields: [],
                  confidence: 'high'
                }
              ]
            }
          ]);
        }
        return '[]';
      });

    render(
      <MemoryRouter>
        <AssistantPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'AI 信贷管家' }));
    fireEvent.click(screen.getByRole('button', { name: '保存到还款管理' }));

    expect(addDebtMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '招联消费贷',
        type: 'consumer-loan',
        balance: 4200
      })
    );

    sessionStorageGetItemSpy.mockRestore();
  });


  it('字段较完整的信贷结果应先进入保存前确认态', () => {
    useAssistantWorkbenchMock.mockReturnValue({
      ...createWorkbenchMock(),
      rawContent: '已识别完成',
      status: 'ready'
    });

    const sessionStorageGetItemSpy = vi
      .spyOn(window.sessionStorage.__proto__, 'getItem')
      .mockImplementation((key) => {
        if (String(key).includes('chatHistory.credit')) {
          return JSON.stringify([
            {
              id: 'credit-assistant-confirm',
              role: 'assistant',
              text: '这是识别后的结果',
              creditItems: [
                {
                  id: 'credit-confirm-0',
                  title: '京东白条分期',
                  productType: '消费贷',
                  dueAmount: '666',
                  totalDebt: '3999',
                  repaymentDate: '每月10日',
                  remainingPeriods: '6',
                  monthlyAmount: '666',
                  interest: '18.6%',
                  rateType: 'APR',
                  pendingFields: ['扣款账户'],
                  confidence: 'high',
                  confirmationState: 'ready',
                  confirmationSummary: ['产品：京东白条分期']
                }
              ]
            }
          ]);
        }
        return '[]';
      });

    render(
      <MemoryRouter>
        <AssistantPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'AI 信贷管家' }));
    fireEvent.click(screen.getByRole('button', { name: '进入保存前确认' }));

    expect(screen.getByText('保存前确认')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '确认保存到还款管理' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '确认保存到还款管理' }));

    expect(addDebtMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '京东白条分期',
        balance: 3999
      })
    );

    sessionStorageGetItemSpy.mockRestore();
  });

  it('信贷识别结果应支持带去还款管理', () => {
    useAssistantWorkbenchMock.mockReturnValue({
      ...createWorkbenchMock(),
      rawContent: '已识别完成',
      status: 'ready'
    });

    const sessionStorageGetItemSpy = vi
      .spyOn(window.sessionStorage.__proto__, 'getItem')
      .mockImplementation((key) => {
        if (String(key).includes('chatHistory.credit')) {
          return JSON.stringify([
            {
              id: 'credit-assistant-1',
              role: 'assistant',
              text: '这是识别后的结果',
              creditItems: [
                {
                  id: 'credit-1',
                  title: '花呗分期',
                  productType: '消费贷',
                  dueAmount: '1288',
                  totalDebt: '5600',
                  repaymentDate: '每月8日',
                  remainingPeriods: '5',
                  monthlyAmount: '1288',
                  interest: '23',
                  pendingFields: ['扣款账户'],
                  confidence: 'high'
                }
              ]
            }
          ]);
        }
        return '[]';
      });

    render(
      <MemoryRouter>
        <AssistantPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'AI 信贷管家' }));
    fireEvent.click(screen.getByRole('button', { name: '去补充后保存' }));

    expect(navigateMock).toHaveBeenCalledWith('/repayment-management', {
      state: {
        prefillDebt: expect.objectContaining({
          name: '花呗分期',
          type: 'consumer-loan'
        })
      }
    });

    sessionStorageGetItemSpy.mockRestore();
  });
});
