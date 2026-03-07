import { fetchEmbeddings } from '../api/openaiEmbeddingClient';
import { sendAiChat } from '../api/openaiCompatibleClient';
import type { GlobalMemoryItem } from '../../../shared/store/globalMemory';

const MEMORY_EMBEDDING_CACHE_PREFIX = 'ledgerflow-global-memory-embedding-index-v1';
const MAX_MEMORY_RECALL = 8;
const MIN_MEMORY_SCORE = 0.52;

interface MemoryEmbeddingDoc {
  id: string;
  hash: string;
  text: string;
  vector: number[];
}

interface MemoryEmbeddingCachePayload {
  version: number;
  model: string;
  updatedAt: number;
  docs: MemoryEmbeddingDoc[];
}

export interface GlobalMemoryRecallHit {
  id: string;
  title: string;
  content: string;
  type: GlobalMemoryItem['type'];
  score: number;
  rerankScore?: number;
  source: GlobalMemoryItem['source'];
  origin: GlobalMemoryItem['origin'];
}

function normalizeVector(vector: number[]): number[] {
  if (!Array.isArray(vector) || vector.length === 0) return [];
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(norm) || norm <= 0) return vector;
  return vector.map((value) => value / norm);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return -1;
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) dot += a[i] * b[i];
  return dot;
}

function hashText(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 33) ^ text.charCodeAt(i);
  return (hash >>> 0).toString(16);
}

function cacheKey(baseUrl: string, model: string) {
  return `${MEMORY_EMBEDDING_CACHE_PREFIX}:${encodeURIComponent(baseUrl)}:${encodeURIComponent(model)}`;
}

function readCache(baseUrl: string, model: string): MemoryEmbeddingCachePayload | null {
  try {
    const raw = window.localStorage.getItem(cacheKey(baseUrl, model));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MemoryEmbeddingCachePayload;
    if (!parsed || parsed.model !== model || !Array.isArray(parsed.docs)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(baseUrl: string, model: string, docs: MemoryEmbeddingDoc[]) {
  try {
    const payload: MemoryEmbeddingCachePayload = {
      version: 1,
      model,
      updatedAt: Date.now(),
      docs
    };
    window.localStorage.setItem(cacheKey(baseUrl, model), JSON.stringify(payload));
  } catch {
    // ignore
  }
}

function chunk<T>(list: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < list.length; i += size) result.push(list.slice(i, i + size));
  return result;
}

function buildMemoryDocs(memories: GlobalMemoryItem[]) {
  return memories
    .filter((item) => item.status === 'active' && !item.disabled)
    .map((item) => {
      const text = item.embeddingText?.trim()
        ? item.embeddingText.trim()
        : [item.title, item.content, item.type, item.source].join(' | ');
      return {
        id: item.id,
        hash: hashText(text),
        text
      };
    });
}

async function ensureIndex(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  docs: Array<{ id: string; hash: string; text: string }>;
  signal?: AbortSignal;
}): Promise<MemoryEmbeddingDoc[]> {
  const { baseUrl, apiKey, model, docs, signal } = params;
  const cache = readCache(baseUrl, model);
  const cachedById = new Map((cache?.docs || []).map((item) => [item.id, item]));

  const kept: MemoryEmbeddingDoc[] = [];
  const pending: Array<{ id: string; hash: string; text: string }> = [];

  for (const doc of docs) {
    const existing = cachedById.get(doc.id);
    if (existing && existing.hash === doc.hash && existing.vector.length > 0) {
      kept.push(existing);
    } else {
      pending.push(doc);
    }
  }

  const embedded: MemoryEmbeddingDoc[] = [];
  for (const batch of chunk(pending, 16)) {
    const vectors = await fetchEmbeddings({
      baseUrl,
      apiKey,
      model,
      inputs: batch.map((item) => item.text),
      signal
    });
    for (let i = 0; i < batch.length; i += 1) {
      const vector = normalizeVector(vectors[i] || []);
      if (vector.length === 0) continue;
      embedded.push({ ...batch[i], vector });
    }
  }

  const nextDocs = docs
    .map((item) => kept.find((k) => k.id === item.id) || embedded.find((e) => e.id === item.id))
    .filter((item): item is MemoryEmbeddingDoc => Boolean(item));

  writeCache(baseUrl, model, nextDocs);
  return nextDocs;
}

async function rerankMemoryHits(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  question: string;
  candidates: GlobalMemoryRecallHit[];
  signal?: AbortSignal;
}): Promise<GlobalMemoryRecallHit[]> {
  const { baseUrl, apiKey, model, question, candidates, signal } = params;
  if (!candidates.length) return [];

  const candidateLines = candidates
    .map(
      (item, index) =>
        `${index + 1}. id=${item.id}\ntitle=${item.title}\ntype=${item.type}\ncontent=${item.content}`
    )
    .join('\n\n');

  const reply = await sendAiChat({
    baseUrl,
    apiKey,
    model,
    signal,
    systemPrompt:
      '你是记忆重排序器。请根据用户当前问题，从候选长期记忆中选出最相关的最多 4 条。仅返回 JSON 数组，格式：[{"id":"...","score":0.00}]。score 取 0 到 1，越高越相关。不要输出任何额外说明。',
    messages: [
      {
        role: 'user',
        text: `当前问题：${question}\n\n候选记忆：\n${candidateLines}`
      }
    ]
  });

  const normalized = reply.content.trim().replace(/^```json\s*/i, '').replace(/```$/i, '');
  const parsed = JSON.parse(normalized) as Array<{ id?: unknown; score?: unknown }>;
  if (!Array.isArray(parsed)) return candidates.slice(0, 4);

  const scoreMap = new Map<string, number>();
  for (const row of parsed) {
    const id = String(row?.id || '').trim();
    const score = Number(row?.score || 0);
    if (!id) continue;
    scoreMap.set(id, Number.isFinite(score) ? Math.max(0, Math.min(1, score)) : 0);
  }

  return [...candidates]
    .map((item) => ({ ...item, rerankScore: scoreMap.get(item.id) ?? 0 }))
    .filter((item) => (item.rerankScore ?? 0) > 0)
    .sort((a, b) => (b.rerankScore ?? 0) - (a.rerankScore ?? 0) || b.score - a.score)
    .slice(0, 4);
}

export async function buildGlobalMemoryRecallContext(params: {
  baseUrl: string;
  apiKey: string;
  embeddingModel: string;
  rerankModel?: string;
  enableRerankModel?: boolean;
  question: string;
  memories: GlobalMemoryItem[];
  signal?: AbortSignal;
}): Promise<{ context: string; hits: GlobalMemoryRecallHit[] } | null> {
  const {
    baseUrl,
    apiKey,
    embeddingModel,
    rerankModel,
    enableRerankModel,
    question,
    memories,
    signal
  } = params;
  const cleanQuestion = question.trim();
  if (!cleanQuestion) return null;

  const sourceDocs = buildMemoryDocs(memories);
  if (!sourceDocs.length) return null;

  const indexedDocs = await ensureIndex({
    baseUrl,
    apiKey,
    model: embeddingModel,
    docs: sourceDocs,
    signal
  });
  if (!indexedDocs.length) return null;

  const [queryVectorRaw] = await fetchEmbeddings({
    baseUrl,
    apiKey,
    model: embeddingModel,
    inputs: [cleanQuestion],
    signal
  });
  const queryVector = normalizeVector(queryVectorRaw || []);
  if (!queryVector.length) return null;

  const memoryById = new Map(memories.map((item) => [item.id, item]));
  let hits = indexedDocs
    .map((doc) => {
      const score = cosineSimilarity(doc.vector, queryVector);
      const memory = memoryById.get(doc.id);
      if (!memory) return null;
      return {
        id: memory.id,
        title: memory.title,
        content: memory.content,
        type: memory.type,
        source: memory.source,
        origin: memory.origin,
        score
      } as GlobalMemoryRecallHit;
    })
    .filter(
      (item): item is GlobalMemoryRecallHit => item !== null && item.score >= MIN_MEMORY_SCORE
    )
    .sort((a, b) => (b.score - a.score) || Number(b.title.length > a.title.length))
    .slice(0, MAX_MEMORY_RECALL);

  if (!hits.length) return null;

  if (enableRerankModel && rerankModel?.trim()) {
    try {
      const reranked = await rerankMemoryHits({
        baseUrl,
        apiKey,
        model: rerankModel.trim(),
        question: cleanQuestion,
        candidates: hits,
        signal
      });
      if (reranked.length) {
        hits = reranked;
      }
    } catch {
      // keep embedding ranking
    }
  }

  const context = hits
    .map(
      (item, index) =>
        `${index + 1}. [${item.type}] ${item.title}：${item.content}${item.rerankScore !== undefined ? `（重排序 ${item.rerankScore.toFixed(2)}）` : `（相似度 ${item.score.toFixed(2)}）`}`
    )
    .join('\n');

  return { context, hits };
}
