export interface Variation {
  level: number;
  era: string; // Used for "Era" or "Type Name"
  text: string;
  subtitle?: string; // Secondary text (used on Cover for original phrase)
  explanation: string;
  imageBase64?: string;
}

export interface TransformationResponse {
  variations: Variation[];
  captionSuggestion?: string;
}

export enum LoadingState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export type GenerationMode = 'chronological' | 'sales_types' | 'avatar' | 'social_media' | 'single_image';