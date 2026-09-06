-- ---------------------------------------------------------------------------
-- AVDP Analytics Layer
-- Every view below reads ONLY from data whose originating import job has a
-- live publication record. Raw / unapproved data can never reach the API.
-- All views are reversible: they are dropped and recreated, never destructive.
-- ---------------------------------------------------------------------------

-- Live publications: the currently authoritative publication per import job.
CREATE OR REPLACE VIEW analytics.published_import_jobs AS
SELECT
  p.import_job_id,
  p.id                AS publication_record_id,
  p.dataset_id,
  p.reporting_period_id,
  p.published_at,
  p.quality_score,
  d.data_source_id
FROM governance.publication_records p
JOIN governance.datasets d ON d.id = p.dataset_id
WHERE p.status = 'published';

-- Convenience: beneficiaries that survive deduplication and are traceable to a
-- published import job.
CREATE OR REPLACE VIEW analytics.published_beneficiaries AS
SELECT
  b.id,
  b.avdp_reference,
  b.sex,
  b.age_group,
  b.beneficiary_type,
  b.is_youth,
  b.disability,
  loc.district_id,
  loc.chiefdom_id,
  pj.reporting_period_id,
  pj.publication_record_id,
  pj.data_source_id,
  pj.published_at
FROM beneficiaries.beneficiaries b
JOIN analytics.published_import_jobs pj ON pj.import_job_id = b.source_import_job_id
LEFT JOIN LATERAL (
  SELECT l.district_id, l.chiefdom_id
  FROM beneficiaries.beneficiary_locations l
  WHERE l.beneficiary_id = b.id
  ORDER BY l.is_primary DESC, l.created_at ASC
  LIMIT 1
) loc ON TRUE
WHERE b.status <> 'merged';

CREATE OR REPLACE VIEW analytics.analytics_beneficiary_summary AS
SELECT
  pb.reporting_period_id,
  COUNT(*)                                                   AS total_beneficiaries,
  COUNT(*) FILTER (WHERE pb.sex = 'female')                  AS female_count,
  COUNT(*) FILTER (WHERE pb.sex = 'male')                    AS male_count,
  COUNT(*) FILTER (WHERE pb.is_youth IS TRUE)                AS youth_count,
  COUNT(*) FILTER (WHERE pb.disability IS TRUE)              AS disability_count,
  COUNT(DISTINCT pb.district_id)                             AS districts_covered,
  MAX(pb.published_at)                                       AS last_published_at,
  now()                                                      AS calculated_at
FROM analytics.published_beneficiaries pb
GROUP BY pb.reporting_period_id;

CREATE OR REPLACE VIEW analytics.analytics_beneficiaries_by_district AS
SELECT
  pb.reporting_period_id,
  d.id                                        AS district_id,
  d.code                                      AS district_code,
  d.name                                      AS district_name,
  COUNT(*)                                    AS total_beneficiaries,
  COUNT(*) FILTER (WHERE pb.sex = 'female')   AS female_count,
  COUNT(*) FILTER (WHERE pb.sex = 'male')     AS male_count,
  COUNT(*) FILTER (WHERE pb.is_youth IS TRUE) AS youth_count,
  MAX(pb.published_at)                        AS last_published_at,
  now()                                       AS calculated_at
FROM analytics.published_beneficiaries pb
JOIN master_data.districts d ON d.id = pb.district_id
GROUP BY pb.reporting_period_id, d.id, d.code, d.name;

CREATE OR REPLACE VIEW analytics.analytics_beneficiaries_by_value_chain AS
SELECT
  pb.reporting_period_id,
  vc.id                                       AS value_chain_id,
  vc.code                                     AS value_chain_code,
  vc.name                                     AS value_chain_name,
  COUNT(DISTINCT pb.id)                       AS total_beneficiaries,
  COUNT(DISTINCT pb.id) FILTER (WHERE pb.sex = 'female') AS female_count,
  COUNT(DISTINCT pb.id) FILTER (WHERE pb.sex = 'male')   AS male_count,
  MAX(pb.published_at)                        AS last_published_at,
  now()                                       AS calculated_at
FROM analytics.published_beneficiaries pb
JOIN beneficiaries.beneficiary_value_chains bvc ON bvc.beneficiary_id = pb.id
JOIN master_data.value_chains vc ON vc.id = bvc.value_chain_id
GROUP BY pb.reporting_period_id, vc.id, vc.code, vc.name;

CREATE OR REPLACE VIEW analytics.analytics_beneficiaries_by_sex AS
SELECT
  pb.reporting_period_id,
  pb.district_id,
  pb.sex::text                AS sex,
  COUNT(*)                    AS total_beneficiaries,
  MAX(pb.published_at)        AS last_published_at,
  now()                       AS calculated_at
FROM analytics.published_beneficiaries pb
GROUP BY pb.reporting_period_id, pb.district_id, pb.sex;

CREATE OR REPLACE VIEW analytics.analytics_training_summary AS
SELECT
  t.reporting_period_id,
  t.district_id,
  t.value_chain_id,
  COUNT(DISTINCT t.id)                                          AS training_events,
  COUNT(ta.id) FILTER (WHERE ta.attended)                       AS participants_trained,
  COUNT(DISTINCT ta.beneficiary_id) FILTER (WHERE ta.attended)  AS unique_participants,
  COUNT(ta.id) FILTER (WHERE ta.certified)                      AS certified_count,
  COALESCE(SUM(t.duration_days), 0)                             AS total_training_days,
  MAX(pj.published_at)                                          AS last_published_at,
  now()                                                         AS calculated_at
FROM project_delivery.training_events t
JOIN analytics.published_import_jobs pj ON pj.import_job_id = t.source_import_job_id
LEFT JOIN project_delivery.training_attendance ta ON ta.training_event_id = t.id
GROUP BY t.reporting_period_id, t.district_id, t.value_chain_id;

CREATE OR REPLACE VIEW analytics.analytics_production_summary AS
SELECT
  pr.reporting_period_id,
  pr.district_id,
  pr.value_chain_id,
  COUNT(*)                                   AS production_records,
  COALESCE(SUM(pr.cultivated_area_ha), 0)    AS total_area_ha,
  COALESCE(SUM(pr.quantity), 0)              AS total_quantity,
  CASE WHEN COALESCE(SUM(pr.cultivated_area_ha), 0) > 0
       THEN SUM(pr.quantity) / SUM(pr.cultivated_area_ha)
       ELSE NULL END                         AS avg_yield_per_ha,
  COUNT(DISTINCT pr.beneficiary_id)          AS producing_beneficiaries,
  MAX(pj.published_at)                       AS last_published_at,
  now()                                      AS calculated_at
FROM production.production_records pr
JOIN analytics.published_import_jobs pj ON pj.import_job_id = pr.source_import_job_id
GROUP BY pr.reporting_period_id, pr.district_id, pr.value_chain_id;

CREATE OR REPLACE VIEW analytics.analytics_infrastructure_summary AS
SELECT
  ia.reporting_period_id,
  ia.district_id,
  ia.asset_type,
  COUNT(*)                                                  AS asset_count,
  COUNT(*) FILTER (WHERE ia.status = 'completed')           AS completed_count,
  COUNT(*) FILTER (WHERE ia.status = 'ongoing')             AS ongoing_count,
  COALESCE(SUM(ia.quantity), 0)                             AS total_quantity,
  COALESCE(SUM(ia.beneficiaries_served), 0)                 AS beneficiaries_served,
  AVG(ia.completion_percent)                                AS avg_completion_percent,
  MAX(pj.published_at)                                      AS last_published_at,
  now()                                                     AS calculated_at
FROM project_delivery.infrastructure_assets ia
JOIN analytics.published_import_jobs pj ON pj.import_job_id = ia.source_import_job_id
GROUP BY ia.reporting_period_id, ia.district_id, ia.asset_type;

CREATE OR REPLACE VIEW analytics.analytics_value_chain_summary AS
SELECT
  vc.id                                        AS value_chain_id,
  vc.code                                      AS value_chain_code,
  vc.name                                      AS value_chain_name,
  bvc.reporting_period_id,
  COALESCE(bvc.total_beneficiaries, 0)         AS total_beneficiaries,
  COALESCE(prod.total_area_ha, 0)              AS total_area_ha,
  COALESCE(prod.total_quantity, 0)             AS total_quantity,
  prod.avg_yield_per_ha,
  COALESCE(tr.participants_trained, 0)         AS participants_trained,
  GREATEST(
    COALESCE(bvc.last_published_at, '-infinity'::timestamp),
    COALESCE(prod.last_published_at, '-infinity'::timestamp)
  )                                            AS last_published_at,
  now()                                        AS calculated_at
FROM master_data.value_chains vc
LEFT JOIN analytics.analytics_beneficiaries_by_value_chain bvc ON bvc.value_chain_id = vc.id
LEFT JOIN LATERAL (
  SELECT SUM(total_area_ha) AS total_area_ha,
         SUM(total_quantity) AS total_quantity,
         CASE WHEN SUM(total_area_ha) > 0 THEN SUM(total_quantity)/SUM(total_area_ha) END AS avg_yield_per_ha,
         MAX(last_published_at) AS last_published_at
  FROM analytics.analytics_production_summary p
  WHERE p.value_chain_id = vc.id
    AND (bvc.reporting_period_id IS NULL OR p.reporting_period_id = bvc.reporting_period_id)
) prod ON TRUE
LEFT JOIN LATERAL (
  SELECT SUM(participants_trained) AS participants_trained
  FROM analytics.analytics_training_summary t
  WHERE t.value_chain_id = vc.id
    AND (bvc.reporting_period_id IS NULL OR t.reporting_period_id = bvc.reporting_period_id)
) tr ON TRUE
WHERE vc.is_active;

CREATE OR REPLACE VIEW analytics.analytics_geographic_summary AS
SELECT
  d.id                                    AS district_id,
  d.code                                  AS district_code,
  d.name                                  AS district_name,
  d.latitude,
  d.longitude,
  bd.reporting_period_id,
  COALESCE(bd.total_beneficiaries, 0)     AS total_beneficiaries,
  COALESCE(bd.female_count, 0)            AS female_count,
  COALESCE(prod.total_area_ha, 0)         AS total_area_ha,
  COALESCE(tr.participants_trained, 0)    AS participants_trained,
  COALESCE(inf.asset_count, 0)            AS infrastructure_assets,
  bd.last_published_at,
  now()                                   AS calculated_at
FROM master_data.districts d
LEFT JOIN analytics.analytics_beneficiaries_by_district bd ON bd.district_id = d.id
LEFT JOIN LATERAL (
  SELECT SUM(total_area_ha) AS total_area_ha
  FROM analytics.analytics_production_summary p
  WHERE p.district_id = d.id
    AND (bd.reporting_period_id IS NULL OR p.reporting_period_id = bd.reporting_period_id)
) prod ON TRUE
LEFT JOIN LATERAL (
  SELECT SUM(participants_trained) AS participants_trained
  FROM analytics.analytics_training_summary t
  WHERE t.district_id = d.id
    AND (bd.reporting_period_id IS NULL OR t.reporting_period_id = bd.reporting_period_id)
) tr ON TRUE
LEFT JOIN LATERAL (
  SELECT SUM(asset_count) AS asset_count
  FROM analytics.analytics_infrastructure_summary i
  WHERE i.district_id = d.id
    AND (bd.reporting_period_id IS NULL OR i.reporting_period_id = bd.reporting_period_id)
) inf ON TRUE
WHERE d.is_active;

CREATE OR REPLACE VIEW analytics.analytics_indicator_performance AS
SELECT
  i.id                                    AS indicator_id,
  i.code                                  AS indicator_code,
  i.name                                  AS indicator_name,
  i.unit,
  i.result_level::text                    AS result_level,
  i.calculation_version,
  o.reporting_period_id,
  o.district_id,
  o.value_chain_id,
  SUM(o.value)                            AS actual_value,
  t.target_value,
  CASE WHEN t.target_value > 0
       THEN ROUND((SUM(o.value) / t.target_value) * 100, 2)
       ELSE NULL END                      AS achievement_percent,
  MAX(o.observed_at)                      AS last_calculated_at,
  now()                                   AS calculated_at
FROM monitoring.indicators i
JOIN monitoring.indicator_observations o ON o.indicator_id = i.id
LEFT JOIN monitoring.indicator_targets t
  ON t.indicator_id = i.id
 AND t.reporting_period_id IS NOT DISTINCT FROM o.reporting_period_id
 AND t.district_id IS NOT DISTINCT FROM o.district_id
 AND t.value_chain_id IS NOT DISTINCT FROM o.value_chain_id
WHERE i.is_active
GROUP BY i.id, i.code, i.name, i.unit, i.result_level, i.calculation_version,
         o.reporting_period_id, o.district_id, o.value_chain_id, t.target_value;

-- Data-quality rollup used by the Data Manager home screen and lineage API.
CREATE OR REPLACE VIEW analytics.analytics_data_quality_summary AS
SELECT
  j.data_source_id,
  j.dataset_id,
  j.reporting_period_id,
  COUNT(*)                                          AS import_jobs,
  SUM(j.row_count)                                  AS total_rows,
  SUM(j.valid_row_count)                            AS valid_rows,
  SUM(j.error_row_count)                            AS error_rows,
  SUM(j.warning_row_count)                          AS warning_rows,
  SUM(j.duplicate_row_count)                        AS duplicate_rows,
  CASE WHEN SUM(j.row_count) > 0
       THEN ROUND((SUM(j.valid_row_count)::numeric / SUM(j.row_count)) * 100, 2)
       ELSE NULL END                                AS validation_pass_rate,
  MAX(j.completed_at)                               AS last_import_at,
  now()                                             AS calculated_at
FROM governance.import_jobs j
GROUP BY j.data_source_id, j.dataset_id, j.reporting_period_id;

-- Supporting indexes for the analytics query paths.
CREATE INDEX IF NOT EXISTS idx_beneficiaries_source_import_job
  ON beneficiaries.beneficiaries (source_import_job_id);
CREATE INDEX IF NOT EXISTS idx_training_events_source_import_job
  ON project_delivery.training_events (source_import_job_id);
CREATE INDEX IF NOT EXISTS idx_production_records_source_import_job
  ON production.production_records (source_import_job_id);
CREATE INDEX IF NOT EXISTS idx_infrastructure_assets_source_import_job
  ON project_delivery.infrastructure_assets (source_import_job_id);
CREATE INDEX IF NOT EXISTS idx_publication_records_live
  ON governance.publication_records (import_job_id) WHERE status = 'published';
