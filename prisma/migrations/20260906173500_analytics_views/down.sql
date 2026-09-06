-- Rollback for 20260906173500_analytics_views.
-- Views carry no data, so dropping them is non-destructive.
DROP VIEW IF EXISTS analytics.analytics_data_quality_summary;
DROP VIEW IF EXISTS analytics.analytics_indicator_performance;
DROP VIEW IF EXISTS analytics.analytics_geographic_summary;
DROP VIEW IF EXISTS analytics.analytics_value_chain_summary;
DROP VIEW IF EXISTS analytics.analytics_infrastructure_summary;
DROP VIEW IF EXISTS analytics.analytics_production_summary;
DROP VIEW IF EXISTS analytics.analytics_training_summary;
DROP VIEW IF EXISTS analytics.analytics_beneficiaries_by_sex;
DROP VIEW IF EXISTS analytics.analytics_beneficiaries_by_value_chain;
DROP VIEW IF EXISTS analytics.analytics_beneficiaries_by_district;
DROP VIEW IF EXISTS analytics.analytics_beneficiary_summary;
DROP VIEW IF EXISTS analytics.published_beneficiaries;
DROP VIEW IF EXISTS analytics.published_import_jobs;
DROP INDEX IF EXISTS governance.idx_publication_records_live;
DROP INDEX IF EXISTS project_delivery.idx_infrastructure_assets_source_import_job;
DROP INDEX IF EXISTS production.idx_production_records_source_import_job;
DROP INDEX IF EXISTS project_delivery.idx_training_events_source_import_job;
DROP INDEX IF EXISTS beneficiaries.idx_beneficiaries_source_import_job;
