-- Migration: MPBC multi-pest configuration foundation
-- Description: Adds observation-method-aware pest configuration tables
--              and extends reports with pest/method/config linkage.

DO $$
BEGIN
  CREATE TYPE observation_method AS ENUM (
    'PHEROMONE_TRAP',
    'FIELD_OBSERVATION',
    'EVENT_OBSERVATION',
    'SIGN_BASED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE alert_trigger AS ENUM (
    'WARNING_AND_HIGH',
    'HIGH_ONLY',
    'NONE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE pest_field_type AS ENUM (
    'number',
    'select',
    'boolean',
    'text'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE pest_field_capture_mode AS ENUM (
    'RAW',
    'CONTEXT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE pest_rule_condition_kind AS ENUM (
    'NUMERIC',
    'DERIVED',
    'CATEGORICAL',
    'DEFAULT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS agridata_pest_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES agridata_organizations(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  default_observation_method observation_method NOT NULL,
  alert_trigger alert_trigger NOT NULL DEFAULT 'WARNING_AND_HIGH',
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS pest_configurations_org_active_display_idx
  ON agridata_pest_configurations(org_id, active, display_order);

CREATE INDEX IF NOT EXISTS pest_configurations_org_key_idx
  ON agridata_pest_configurations(org_id, key);

CREATE UNIQUE INDEX IF NOT EXISTS pest_configurations_org_key_unique_idx
  ON agridata_pest_configurations(org_id, key);

CREATE TABLE IF NOT EXISTS agridata_pest_observation_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pest_configuration_id uuid NOT NULL REFERENCES agridata_pest_configurations(id) ON DELETE CASCADE,
  method observation_method NOT NULL,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  count_field_key text,
  summary_field_keys jsonb,
  guidance_text text,
  derived_definitions jsonb,
  confirmation_normal_template text,
  confirmation_warning_template text,
  confirmation_high_template text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS pest_observation_configs_pest_display_idx
  ON agridata_pest_observation_configs(pest_configuration_id, display_order);

CREATE UNIQUE INDEX IF NOT EXISTS pest_observation_configs_pest_method_unique_idx
  ON agridata_pest_observation_configs(pest_configuration_id, method);

CREATE TABLE IF NOT EXISTS agridata_pest_observation_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_config_id uuid NOT NULL REFERENCES agridata_pest_observation_configs(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  prompt text NOT NULL,
  help_text text,
  field_type pest_field_type NOT NULL,
  required boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  default_value jsonb,
  options jsonb,
  validation_rules jsonb,
  capture_mode pest_field_capture_mode NOT NULL DEFAULT 'RAW',
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS pest_observation_fields_config_display_idx
  ON agridata_pest_observation_fields(observation_config_id, display_order);

CREATE UNIQUE INDEX IF NOT EXISTS pest_observation_fields_config_key_unique_idx
  ON agridata_pest_observation_fields(observation_config_id, key);

CREATE TABLE IF NOT EXISTS agridata_pest_severity_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_config_id uuid NOT NULL REFERENCES agridata_pest_observation_configs(id) ON DELETE CASCADE,
  rule_order integer NOT NULL DEFAULT 0,
  severity severity NOT NULL,
  condition_kind pest_rule_condition_kind NOT NULL,
  condition_expression jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS pest_severity_rules_config_order_idx
  ON agridata_pest_severity_rules(observation_config_id, rule_order);

ALTER TABLE agridata_reports
  ADD COLUMN IF NOT EXISTS pest_configuration_id uuid REFERENCES agridata_pest_configurations(id) ON DELETE SET NULL;

ALTER TABLE agridata_reports
  ADD COLUMN IF NOT EXISTS pest_key text;

ALTER TABLE agridata_reports
  ADD COLUMN IF NOT EXISTS observation_method observation_method;

ALTER TABLE agridata_reports
  ADD COLUMN IF NOT EXISTS alert_triggered boolean;

ALTER TABLE agridata_reports
  ADD COLUMN IF NOT EXISTS alert_trigger_reason text;

CREATE INDEX IF NOT EXISTS reports_pest_key_idx
  ON agridata_reports(pest_key);

CREATE INDEX IF NOT EXISTS reports_observation_method_idx
  ON agridata_reports(observation_method);

CREATE INDEX IF NOT EXISTS reports_pest_configuration_id_idx
  ON agridata_reports(pest_configuration_id);
