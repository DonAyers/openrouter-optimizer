import { Model, ModelCache } from './types';

const CACHE_FILE = './model-cache.json';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

const isRouterModel = (id: string) =>
  id.startsWith('openrouter/') ||
  id.startsWith('typesafe/jev');

function safePrice(p: string | undefined): number {
  if (!p) return Infinity;
  const n = parseFloat(p);
  if (isNaN(n) || n < 0) return Infinity;
  return n;
}

function hasImageOutput(m: Model): boolean {
  return m.architecture.output_modalities.includes('image');
}

function hasImageInput(m: Model): boolean {
  return m.architecture.input_modalities.includes('image');
}

function hasFileInput(m: Model): boolean {
  return m.architecture.input_modalities.includes('file');
}

async function readCache(): Promise<ModelCache | null> {
  try {
    const file = Bun.file(CACHE_FILE);
    const exists = await file.exists();
    if (!exists) return null;
    
    const content = await file.json() as ModelCache;
    if (Date.now() - content.fetchedAt > CACHE_TTL_MS) {
      return null;
    }
    return content;
  } catch {
    return null;
  }
}

async function writeCache(cache: ModelCache): Promise<void> {
  try {
    const file = Bun.file(CACHE_FILE);
    await file.write(JSON.stringify(cache, null, 2));
  } catch (e) {
    console.error('Failed to save model cache:', e);
  }
}

async function fetchModelsFromAPI(): Promise<Model[]> {
  const models: Model[] = [];
  let offset = 0;
  let hasNext = true;
  const baseUrl = 'https://openrouter.ai/api/v1/models';

  while (hasNext) {
    const url = new URL(baseUrl);
    url.searchParams.set('offset', offset.toString());
    url.searchParams.set('limit', '500');

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Failed to fetch models: ${res.status}`);
    
    const json = await res.json() as { data: Model[]; links: { next: string | null }; total_count: number };
    models.push(...json.data.filter(m => !isRouterModel(m.id)));
    hasNext = json.links.next !== null;
    offset += 500;
  }

  return models;
}

export async function getModels(forceRefresh = false): Promise<ModelCache> {
  // Check cache first
  if (!forceRefresh) {
    const cached = await readCache();
    if (cached) {
      return cached;
    }
  }

  console.log('Fetching models from OpenRouter...');
  const models = await fetchModelsFromAPI();
  
  const cache: ModelCache = {
    models,
    fetchedAt: Date.now(),
    totalCount: models.length,
  };

  await writeCache(cache);
  console.log(`Cached ${models.length} models locally.`);

  return cache;
}

export function findBy_id(models: Model[], id: string): Model | undefined {
  return models.find(m => m.id === id || m.canonical_slug === id);
}

export function filterFree(models: Model[]): Model[] {
  return models.filter(m => {
    const prompt = safePrice(m.pricing.prompt);
    const completion = safePrice(m.pricing.completion);
    return prompt === 0 && completion === 0;
  });
}

export function filterImageModels(models: Model[]): Model[] {
  return models.filter(hasImageOutput);
}

export function filterVisionModels(models: Model[]): Model[] {
  return models.filter(m => 
    hasImageInput(m) && 
    m.architecture.output_modalities.includes('text') && 
    !hasImageOutput(m)
  );
}

export function calculatePricePerMillion(model: Model): number {
  const prompt = safePrice(model.pricing.prompt);
  const completion = safePrice(model.pricing.completion);
  return prompt + completion;
}

export function isFreeModel(model: Model): boolean {
  return calculatePricePerMillion(model) === 0;
}

export function supportsTools(model: Model): boolean {
  return model.supported_parameters.includes('tools') || 
         model.supported_parameters.includes('tool_choice');
}
