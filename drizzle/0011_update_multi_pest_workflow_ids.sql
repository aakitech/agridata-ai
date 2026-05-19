UPDATE agridata_bot_sessions
SET workflow_id = 'multi_pest_config'
WHERE workflow_id = 'mpbc_multi_pest';
--> statement-breakpoint
UPDATE agridata_reports
SET workflow_id = 'multi_pest_config'
WHERE workflow_id = 'mpbc_multi_pest';
