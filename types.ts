export interface AdScenario {
  title: string;
  concept: string;
  targetAudience: string;
  marketingHook: string;
  imagePrompts: string[];
}

export interface GeneratedImage {
  id: string;
  prompt: string;
  url: string | null; // null if pending/loading
  status: 'pending' | 'generating' | 'completed' | 'failed';
}

export enum AppState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  GENERATING_IMAGES = 'GENERATING_IMAGES',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}
