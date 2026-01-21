export type WorkflowStepType = 'text' | 'number' | 'location' | 'photo' | 'photo_multi' | 'list';

export interface WorkflowValidation {
  min?: number;
  max?: number;
  max_field_ref?: string; // e.g., "stalks_sampled"
  required?: boolean;
}

export interface ListOption {
  id: string;
  title: string;
  description?: string;
}

export interface QuickReply {
  id: string;
  title: string;
}

export interface WorkflowStep {
  id: string; // The key in the dataCollected JSON
  question: string;
  type: WorkflowStepType;
  optional?: boolean;
  defaultValue?: any;
  validation?: WorkflowValidation;
  listOptions?: ListOption[]; // For list message type
  quickReplies?: QuickReply[]; // For quick reply buttons
  // Metadata for bot state transitions if needed
}

export interface WorkflowComputation {
  outputField: string;
  formula: 'infestation_percentage' | string; // Use enum/string for known formulas
}

export interface WorkflowConfig {
  id: string;
  name: string;
  steps: WorkflowStep[];
  computations?: WorkflowComputation[];
}

export interface SessionData {
  [key: string]: any;
}
