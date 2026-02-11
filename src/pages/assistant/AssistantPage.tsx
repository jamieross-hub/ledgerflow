import { useMemo } from 'react';
import { useAiSettings } from '../../shared/store/useAiSettings';
import { useFinanceStore } from '../../shared/store/useFinanceStore';
import { Toast } from '../../shared/ui/Toast';
import { WorkbenchAdvancedPanel } from '../../features/assistant/workbench/WorkbenchAdvancedPanel';
import { WorkbenchInputPanel } from '../../features/assistant/workbench/WorkbenchInputPanel';
import { WorkbenchPreviewPanel } from '../../features/assistant/workbench/WorkbenchPreviewPanel';
import { WorkbenchSavePanel } from '../../features/assistant/workbench/WorkbenchSavePanel';
import { WorkbenchSettingsDrawer } from '../../features/assistant/workbench/WorkbenchSettingsDrawer';
import { WorkbenchTopbar } from '../../features/assistant/workbench/WorkbenchTopbar';
import { useAssistantWorkbench } from '../../features/assistant/workbench/useAssistantWorkbench';

function statusText(status: ReturnType<typeof useAssistantWorkbench>['status']): string {
  switch (status) {
    case 'idle':
      return '等待输入内容';
    case 'ready':
      return '可开始识别';
    case 'recognizing':
      return '模型识别中';
    case 'preview':
      return '请确认并编辑识别结果';
    case 'saving':
      return '保存到账本中';
    case 'saved':
      return '保存成功';
    case 'error':
      return '存在错误，请检查';
    default:
      return '';
  }
}

export function AssistantPage() {
  const baseUrl = useAiSettings((s) => s.baseUrl);
  const apiKey = useAiSettings((s) => s.apiKey);
  const model = useAiSettings((s) => s.model);
  const memoryDays = useAiSettings((s) => s.memoryDays);
  const memoryBackend = useAiSettings((s) => s.memoryBackend);
  const setBaseUrl = useAiSettings((s) => s.setBaseUrl);
  const setApiKey = useAiSettings((s) => s.setApiKey);
  const setModel = useAiSettings((s) => s.setModel);
  const setMemoryDays = useAiSettings((s) => s.setMemoryDays);
  const setMemoryBackend = useAiSettings((s) => s.setMemoryBackend);

  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const transactions = useFinanceStore((s) => s.transactions);
  const addCategory = useFinanceStore((s) => s.addCategory);
  const addTransaction = useFinanceStore((s) => s.addTransaction);

  const wb = useAssistantWorkbench({
    baseUrl,
    apiKey,
    model,
    categories,
    accounts,
    transactions,
    addCategory,
    addTransaction
  });

  const selected = useMemo(() => wb.entries.filter((item) => item.selected).length, [wb.entries]);
  const valid = useMemo(
    () => wb.entries.filter((item) => item.selected && item.issues.length === 0).length,
    [wb.entries]
  );

  return (
    <div className="assistant-wb-page">
      <WorkbenchTopbar
        status={wb.status}
        providerText={baseUrl}
        onOpenSettings={() => wb.setDrawerOpen(true)}
      />

      <WorkbenchInputPanel
        hasApiKey={wb.hasApiKey}
        submitting={wb.status === 'recognizing'}
        canRecognize={wb.canRecognize}
        textInput={wb.textInput}
        imageDataUrls={wb.imageDataUrls}
        onTextChange={wb.setTextInput}
        onApplyCommand={wb.applyCommand}
        onSubmit={(e) => void wb.handleRecognize(e)}
        onPaste={(e) => void wb.handlePasteImage(e)}
        onDrop={(e) => void wb.handleDropImage(e)}
        onSelectFiles={(files) => {
          files.forEach((file) => {
            void wb.handleSetImage(file);
          });
        }}
        onRemoveImage={(index) =>
          wb.setImageDataUrls((prev) => prev.filter((_, idx) => idx !== index))
        }
        onClearImages={() => wb.setImageDataUrls([])}
      />

      {wb.error ? <section className="panel assistant-wb-error">{wb.error}</section> : null}

      <WorkbenchPreviewPanel
        entries={wb.entries}
        onUpdate={wb.updateEntry}
        onRemove={wb.removeEntry}
      />

      <WorkbenchSavePanel
        total={wb.entries.length}
        selected={selected}
        valid={valid}
        saving={wb.status === 'saving'}
        statusText={statusText(wb.status)}
        onSave={wb.saveSelected}
      />

      <WorkbenchAdvancedPanel
        rawContent={wb.rawContent}
        rawReasoning={wb.rawReasoning}
        entries={wb.entries}
      />

      <WorkbenchSettingsDrawer
        open={wb.drawerOpen}
        baseUrl={baseUrl}
        apiKey={apiKey}
        model={model}
        memoryDays={memoryDays}
        memoryBackend={memoryBackend}
        models={wb.models}
        loadingModels={wb.loadingModels}
        onClose={() => wb.setDrawerOpen(false)}
        onLoadModels={() => void wb.handleLoadModels()}
        onChangeBaseUrl={setBaseUrl}
        onChangeApiKey={setApiKey}
        onChangeModel={setModel}
        onChangeMemoryDays={setMemoryDays}
        onChangeMemoryBackend={setMemoryBackend}
        onResetWorkbench={wb.resetWorkbench}
      />

      <Toast
        message={wb.toast.message}
        variant={wb.toast.variant}
        visible={wb.toast.visible}
        onClose={() => wb.setToastVisible(false)}
      />
    </div>
  );
}
