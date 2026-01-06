export type WorkflowStepType = 'text' | 'number' | 'location' | 'photo' | 'photo_multi';

export interface WorkflowValidation {
  min?: number;
  max?: number;
  max_field_ref?: string; // e.g., "stalks_sampled"
  required?: boolean;
}

export interface WorkflowStep {
  id: string; // The key in the dataCollected JSON
  question: string;
  type: WorkflowStepType;
  optional?: boolean;
  defaultValue?: any;
  validation?: WorkflowValidation;
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
