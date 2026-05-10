-- Update M2 (monthly_qualified_leads) target from current value to 2
UPDATE sla_targets
SET target_value = 2, updated_at = now()
WHERE metric_key = 'monthly_qualified_leads' AND client_id IS NULL;
