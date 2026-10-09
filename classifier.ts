import type { TaskClassification, TaskType } from './types';

interface ClassifierConfig {
  codingKeywords: string[];
  researchKeywords: string[];
  creativeKeywords: string[];
  visionKeywords: string[];
  imageGenKeywords: string[];
  summarizationKeywords: string[];
  agenticKeywords: string[];
  complexIndicators: string[];
  simpleIndicators: string[];
}

const DEFAULT_CONFIG: ClassifierConfig = {
  codingKeywords: [
    'code', 'bug', 'fix', 'implement', 'function', 'component', 'api', 'endpoint',
    'refactor', 'debug', 'test', 'unit test', 'integration test', 'script',
    'library', 'package', 'module', 'class', 'method', 'algorithm', 'database',
    'sql', 'query', 'schema', 'migration', 'deploy', 'docker', 'kubernetes',
    'frontend', 'backend', 'fullstack', 'web app', 'react', 'vue', 'angular',
    'node', 'python', 'typescript', 'javascript', 'rust', 'go', 'java',
    'feature', 'pr', 'pull request', 'commit', 'branch', 'merge', 'conflict',
    'css', 'html', 'dom', 'state', 'hook', 'context', 'redux', 'store',
    'async', 'await', 'promise', 'error handling', 'validation', 'form',
    'authentication', 'authorization', 'login', 'signup', 'token', 'jwt',
    'cache', 'performance', 'optimize', 'speed', 'memory', 'leak',
    'cli', 'command line', 'terminal', 'shell', 'bash', 'scripting',
    'config', 'environment', 'variable', 'secret', 'key', 'cert',
    'devops', 'ci', 'cd', 'pipeline', 'build', 'compile', 'bundle'
  ],
  agenticKeywords: [
    'agent', 'autonomous', 'tool', 'function calling', 'multi-step',
    'orchestrate', 'workflow', 'loop', 'iteration', 'reasoning',
    'plan', 'execute', 'observe', 'react', 'adaptive', 'self-improve',
    'tool_use', 'function_call', 'parallel', 'sequential', 'chain'
  ],
  researchKeywords: [
    'research', 'survey', 'review', 'analyze', 'compare', 'contrast',
    'literature', 'paper', 'study', 'findings', 'investigate', 'explore',
    'background', 'context', 'explain', 'understand', 'learn', 'discover',
    'evidence', 'data', 'statistics', 'trend', 'pattern', 'insight',
    'argument', 'perspective', 'viewpoint', 'debate', 'discussion',
    'pros', 'cons', 'advantages', 'disadvantages', 'tradeoffs',
    'comprehensive', 'thorough', 'deep dive', 'overview', 'summary',
    'quantum', 'developments', 'latest', 'recent', 'state of the art',
    'technology', 'science', 'scientific', 'academic', 'article',
    'news', 'current', 'update', 'progress', 'advancement', 'breakthrough'
  ],
  creativeKeywords: [
    'design', 'mockup', 'wireframe', 'prototype', 'visual', 'layout',
    'color', 'typography', 'branding', 'identity', 'logo', 'icon',
    'creative', 'write', 'content', 'copy', 'blog', 'article', 'story',
    'narrative', 'poem', 'creative writing', 'brainstorm', 'idea',
    'concept', 'vision', 'inspiration', ' Aesthetic', 'style', 'theme',
    'ux', 'ui', 'user experience', 'user interface', 'interaction',
    'animation', 'motion', 'transition', 'micro-interaction'
  ],
  visionKeywords: [
    'image', 'photo', 'picture', 'screenshot', 'diagram', 'chart',
    'graph', 'visual', 'analyze', 'describe', 'identify', 'recognize',
    'detect', 'extract', 'read', 'ocr', 'text from image', 'scene',
    'object', 'face', 'person', 'document', 'pdf', 'slide', 'presentation',
    'visual question', 'vqa', 'what is in', 'what does', 'where is',
    'count', 'find', 'locate', 'search in image', 'caption', 'alt text',
    'accessibility', 'vision', 'see', 'look', 'observe', 'examine'
  ],
  imageGenKeywords: [
    'generate image', 'create image', 'make image', 'draw', 'render',
    'illustration', 'art', 'graphic', 'picture', 'photo', 'logo',
    'banner', 'thumbnail', 'hero', 'wallpaper', 'icon', 'emoji',
    'visual', 'design', 'graphic design', 'digital art', 'painting',
    '3d', 'model', 'scene', 'character', 'portrait', 'landscape',
    'image generation', 'image create', 'generate picture'
  ],
  summarizationKeywords: [
    'summarize', 'summary', 'tl;dr', 'brief', 'short', 'concise',
    'key points', 'main points', 'highlight', 'overview', 'digest',
    'condense', 'simplify', 'explain like', 'eloquent', 'elaborate'
  ],
  complexIndicators: [
    'complex', 'difficult', 'challenging', 'hard', 'complicated',
    'multi-step', 'multi-turn', 'reasoning', 'critical thinking',
    'analysis', 'synthesis', 'evaluate', 'judge', 'assess',
    'nuanced', 'subtle', 'sophisticated', 'advanced', 'expert',
    'production', 'enterprise', 'large scale', 'distributed',
    'security', 'safety', 'reliable', 'robust', 'failure',
    'edge case', 'corner case', 'exception', 'error prone',
    'architecture', 'design pattern', 'best practice', 'pattern'
  ],
  simpleIndicators: [
    'simple', 'easy', 'quick', 'fast', 'basic', 'straightforward',
    'trivial', 'hello world', 'example', 'demo', 'sample',
    'snippet', 'one-liner', 'short', 'small', 'minimal',
    'beginner', 'intro', 'tutorial', 'how to', 'getting started'
  ]
};

export function classifyTask(
  task: string,
  config: Partial<ClassifierConfig> = {},
  context?: import('./types').TaskContext
): TaskClassification {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const normalizedTask = task.toLowerCase().trim();
  const words = normalizedTask.split(/\s+/);
  const sentences = normalizedTask.split(/[.!?]+/).filter(s => s.trim());

  // Helper: check if a term is already mentioned in the task (avoid redundancy)
  const isRedundantInTask = (term: string): boolean => {
    if (!term) return false;
    // Check for word boundary match in task
    const regex = new RegExp(`\\b${term.toLowerCase()}\\b`, 'i');
    return regex.test(normalizedTask);
  };

  // Helper: check if any file in the list matches a pattern
  const fileMatchesPattern = (pattern: string): boolean => {
    if (!context?.files) return false;
    const lowerPattern = pattern.toLowerCase();
    return context.files.some(f => 
      f.toLowerCase().includes(lowerPattern) ||
      f.toLowerCase().split('/').pop()?.includes(lowerPattern)
    );
  };

  // --- Extract context signals (only if not redundant) ---
  
  // Language from context (if not already in task)
  let contextLanguage: string | null = null;
  if (context?.language && !isRedundantInTask(context.language)) {
    contextLanguage = context.language;
  }

  // Framework from context (if not already in task)
  let contextFramework: string | null = null;
  if (context?.framework && !isRedundantInTask(context.framework)) {
    contextFramework = context.framework;
  }

  // Project type from context
  let contextProjectType: string | null = null;
  if (context?.projectType && !isRedundantInTask(context.projectType)) {
    contextProjectType = context.projectType;
  }

  // --- Count keyword matches per category
  const keywordScore = (keywords: string[]): number => {
    let score = 0;
    for (const kw of keywords) {
      // Use word boundary matching to avoid substring false positives
      // e.g., "test" matching inside "latest"
      const regex = new RegExp(`\\b${kw.toLowerCase()}\\b`, 'i');
      if (regex.test(normalizedTask)) {
        score += 1;
      }
    }
    return score;
  };

  const codingScore = keywordScore(cfg.codingKeywords);
  const researchScore = keywordScore(cfg.researchKeywords);
  const creativeScore = keywordScore(cfg.creativeKeywords);
  const visionScore = keywordScore(cfg.visionKeywords);
  const imageGenScore = keywordScore(cfg.imageGenKeywords);
  const summarizationScore = keywordScore(cfg.summarizationKeywords);
  const agenticScore = keywordScore(cfg.agenticKeywords);

  // Determine task type
  let taskType: TaskType = 'general';
  let confidence = 0;
  const matchedKeywords: string[] = [];

  // Agentic + coding → coding-agentic
  if (agenticScore > 0 && codingScore > 0) {
    taskType = 'coding-agentic';
    confidence = Math.min(0.95, (agenticScore + codingScore) / 10);
    matchedKeywords.push(...extractMatched(cfg.agenticKeywords));
    matchedKeywords.push(...extractMatched(cfg.codingKeywords));
  }
  // Image generation
  else if (imageGenScore > 0 && visionScore === 0) {
    taskType = 'image-generation';
    confidence = Math.min(0.9, imageGenScore / 5);
    matchedKeywords.push(...extractMatched(cfg.imageGenKeywords));
  }
  // Image editing (image input + image output)
  else if (imageGenScore > 0 && visionScore > 0) {
    taskType = 'image-editing';
    confidence = Math.min(0.85, (imageGenScore + visionScore) / 8);
    matchedKeywords.push(...extractMatched(cfg.imageGenKeywords));
    matchedKeywords.push(...extractMatched(cfg.visionKeywords));
  }
  // Vision analysis
  else if (visionScore > 0 && imageGenScore === 0) {
    taskType = 'vision-analysis';
    confidence = Math.min(0.9, visionScore / 5);
    matchedKeywords.push(...extractMatched(cfg.visionKeywords));
  }
  // Coding
  else if (codingScore > 0) {
    taskType = 'coding';
    confidence = Math.min(0.9, codingScore / 8);
    matchedKeywords.push(...extractMatched(cfg.codingKeywords));
  }
  // Research
  else if (researchScore > 0) {
    taskType = 'research';
    confidence = Math.min(0.85, researchScore / 6);
    matchedKeywords.push(...extractMatched(cfg.researchKeywords));
  }
  // Creative / design
  else if (creativeScore > 0) {
    taskType = 'creative';
    confidence = Math.min(0.85, creativeScore / 6);
    matchedKeywords.push(...extractMatched(cfg.creativeKeywords));
  }
  // Summarization
  else if (summarizationScore > 0) {
    taskType = 'summarization';
    confidence = Math.min(0.8, summarizationScore / 4);
    matchedKeywords.push(...extractMatched(cfg.summarizationKeywords));
  }
  // Default to general
  else {
    taskType = 'general';
    confidence = 0.5;
  }

  // Calculate complexity
  const hasComplexIndicators = cfg.complexIndicators.some(
    kw => normalizedTask.includes(kw.toLowerCase())
  );
  const hasSimpleIndicators = cfg.simpleIndicators.some(
    kw => normalizedTask.includes(kw.toLowerCase())
  );

  let complexity: 'simple' | 'moderate' | 'complex' = 'moderate';
  if (hasSimpleIndicators && !hasComplexIndicators) {
    complexity = 'simple';
  } else if (hasComplexIndicators) {
    complexity = 'complex';
  }

  // Determine required capabilities
  const requiresImageOutput = taskType === 'image-generation' || taskType === 'image-editing';
  const requiresImageInput = taskType === 'vision-analysis' || taskType === 'image-editing';
  const requiresFileInput = normalizedTask.includes('file') || 
                            normalizedTask.includes('document') ||
                            normalizedTask.includes('pdf') ||
                            normalizedTask.includes('read this');
  const requiresTools = taskType === 'coding-agentic' || 
                       agenticScore > 0 ||
                       normalizedTask.includes('tool') ||
                       normalizedTask.includes('function calling');

  // --- Context-based refinement ---
  // Use context signals to boost confidence or refine classification
  // Only if they provide NEW signal (not redundant with task)
  
  if (context) {
    // Framework context can boost confidence for coding tasks
    if (contextFramework && 
        (taskType === 'coding' || taskType === 'coding-agentic' || taskType === 'general')) {
      // Check if framework indicates a specific domain
      const frontendFrameworks = ['react', 'vue', 'angular', 'svelte', 'next', 'nuxt'];
      const backendFrameworks = ['express', 'fastapi', 'django', 'flask', 'rails', 'spring'];
      
      if (frontendFrameworks.some(f => f === contextFramework.toLowerCase())) {
        // Frontend framework detected - boost confidence if it's a coding task
        if (taskType === 'coding' || taskType === 'coding-agentic') {
          confidence = Math.min(0.95, confidence + 0.1);
        }
        // Add framework as keyword signal
        matchedKeywords.push(contextFramework);
      } else if (backendFrameworks.some(f => f === contextFramework.toLowerCase())) {
        if (taskType === 'coding' || taskType === 'coding-agentic') {
          confidence = Math.min(0.95, confidence + 0.1);
        }
        matchedKeywords.push(contextFramework);
      }
    }

    // Language context - if task is ambiguous but language is specified
    if (contextLanguage && taskType === 'general' && confidence < 0.6) {
      const codingLanguages = ['typescript', 'javascript', 'python', 'rust', 'go', 'java', 'c++', 'csharp'];
      if (codingLanguages.some(l => l === contextLanguage.toLowerCase())) {
        taskType = 'coding';
        confidence = Math.min(0.7, confidence + 0.2);
        matchedKeywords.push(contextLanguage);
      }
    }

    // Project type context
    if (contextProjectType) {
      const webProjectTypes = ['web app', 'website', 'frontend', 'web'];
      const apiProjectTypes = ['api', 'backend', 'service', 'microservice'];
      
      if (webProjectTypes.some(p => p === contextProjectType.toLowerCase())) {
        if (taskType === 'general' || taskType === 'coding') {
          matchedKeywords.push('web', 'frontend');
        }
      } else if (apiProjectTypes.some(p => p === contextProjectType.toLowerCase())) {
        if (taskType === 'general' || taskType === 'coding') {
          matchedKeywords.push('backend', 'api');
        }
      }
    }
  }

  return {
    type: taskType,
    confidence,
    keywords: matchedKeywords.slice(0, 10),
    requiresImageOutput,
    requiresImageInput,
    requiresFileInput,
    requiresTools,
    complexity,
  };
}

function extractMatched(keywords: string[]): string[] {
  // This is a simplified version - in production you'd track which matched
  return [];
}

export function getTaskTypeDescription(type: TaskType): string {
  const descriptions: Record<TaskType, string> = {
    coding: 'Writing, fixing, or modifying code',
    'coding-agentic': 'Multi-step coding tasks requiring tool use or autonomous behavior',
    research: 'Information gathering, analysis, and synthesis',
    creative: 'Design, writing, or creative content generation',
    'vision-analysis': 'Analyzing or extracting information from images',
    'image-generation': 'Creating new images from text prompts',
    'image-editing': 'Modifying or manipulating existing images',
    summarization: 'Summarizing or condensing information',
    general: 'General purpose tasks not fitting other categories',
    unknown: 'Unable to classify',
  };
  return descriptions[type] || descriptions.general;
}
