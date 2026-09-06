-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "admin";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "analytics";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "beneficiaries";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "governance";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "master_data";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "monitoring";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "production";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "project_delivery";

-- CreateEnum
CREATE TYPE "admin"."UserStatus" AS ENUM ('active', 'suspended', 'disabled');

-- CreateEnum
CREATE TYPE "master_data"."PeriodType" AS ENUM ('month', 'quarter', 'semester', 'year', 'custom');

-- CreateEnum
CREATE TYPE "master_data"."PeriodStatus" AS ENUM ('planned', 'open', 'closed', 'locked');

-- CreateEnum
CREATE TYPE "governance"."SourceType" AS ENUM ('excel', 'csv', 'database', 'api', 'odk', 'kobo', 'manual', 'gis', 'other');

-- CreateEnum
CREATE TYPE "governance"."ConnectionType" AS ENUM ('upload', 'api', 'database', 'scheduled', 'manual');

-- CreateEnum
CREATE TYPE "governance"."SourceStatus" AS ENUM ('active', 'inactive', 'attention_required');

-- CreateEnum
CREATE TYPE "governance"."DataClassification" AS ENUM ('public', 'internal', 'confidential', 'restricted');

-- CreateEnum
CREATE TYPE "governance"."UpdateFrequency" AS ENUM ('ad_hoc', 'daily', 'weekly', 'monthly', 'quarterly', 'semi_annual', 'annual');

-- CreateEnum
CREATE TYPE "governance"."OnboardingStatus" AS ENUM ('discovered', 'assessed', 'mapped', 'tested', 'validated', 'approved', 'live');

-- CreateEnum
CREATE TYPE "governance"."DatasetDomain" AS ENUM ('beneficiaries', 'training', 'production', 'infrastructure', 'inputs', 'geography', 'indicators', 'other');

-- CreateEnum
CREATE TYPE "governance"."ImportStatus" AS ENUM ('uploaded', 'profiling', 'mapping_required', 'validating', 'validation_failed', 'ready_for_review', 'submitted', 'approved', 'published', 'rejected', 'failed');

-- CreateEnum
CREATE TYPE "governance"."ValidationCategory" AS ENUM ('required_field', 'type', 'range', 'reference', 'duplicate', 'geography', 'date', 'business_rule', 'consistency');

-- CreateEnum
CREATE TYPE "governance"."ValidationSeverity" AS ENUM ('error', 'warning', 'info');

-- CreateEnum
CREATE TYPE "governance"."ApprovalStatus" AS ENUM ('pending', 'in_review', 'returned', 'approved', 'rejected', 'withdrawn');

-- CreateEnum
CREATE TYPE "governance"."ApprovalActionType" AS ENUM ('submit', 'start_review', 'return_for_correction', 'approve', 'reject', 'publish', 'unpublish', 'withdraw');

-- CreateEnum
CREATE TYPE "governance"."PublicationStatus" AS ENUM ('published', 'superseded', 'withdrawn');

-- CreateEnum
CREATE TYPE "governance"."ConnectorType" AS ENUM ('rest_api', 'database', 'odk', 'webhook', 'scheduled_file');

-- CreateEnum
CREATE TYPE "governance"."IntegrationStatus" AS ENUM ('draft', 'active', 'paused', 'failing');

-- CreateEnum
CREATE TYPE "beneficiaries"."Sex" AS ENUM ('male', 'female', 'other', 'unknown');

-- CreateEnum
CREATE TYPE "beneficiaries"."BeneficiaryStatus" AS ENUM ('provisional', 'confirmed', 'merged', 'inactive');

-- CreateEnum
CREATE TYPE "beneficiaries"."IdentifierType" AS ENUM ('avdp', 'national_id', 'phone', 'project_id', 'group_membership_id', 'external_source_id');

-- CreateEnum
CREATE TYPE "beneficiaries"."DuplicateMatchType" AS ENUM ('deterministic', 'probable');

-- CreateEnum
CREATE TYPE "beneficiaries"."DuplicateReviewStatus" AS ENUM ('pending', 'confirmed', 'rejected', 'merged');

-- CreateEnum
CREATE TYPE "monitoring"."ResultLevel" AS ENUM ('impact', 'outcome', 'output', 'activity', 'input');

-- CreateEnum
CREATE TYPE "monitoring"."DisaggregationDimension" AS ENUM ('sex', 'age_group', 'district', 'chiefdom', 'value_chain', 'reporting_period', 'beneficiary_type');

-- CreateTable
CREATE TABLE "admin"."users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "unit" TEXT,
    "status" "admin"."UserStatus" NOT NULL DEFAULT 'active',
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin"."roles" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin"."permissions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin"."role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "admin"."user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" UUID,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "admin"."sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data"."districts" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "province" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data"."chiefdoms" (
    "id" UUID NOT NULL,
    "district_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chiefdoms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data"."wards" (
    "id" UUID NOT NULL,
    "chiefdom_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data"."communities" (
    "id" UUID NOT NULL,
    "district_id" UUID,
    "chiefdom_id" UUID,
    "ward_id" UUID,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data"."value_chains" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "value_chains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data"."units_of_measure" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dimension" TEXT,
    "base_unit_code" TEXT,
    "factor_to_base" DECIMAL(18,6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_of_measure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data"."organizations" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "org_type" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data"."implementing_partners" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "partner_type" TEXT,
    "contact_person" TEXT,
    "contact_email" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "implementing_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data"."reporting_periods" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "period_type" "master_data"."PeriodType" NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "master_data"."PeriodStatus" NOT NULL DEFAULT 'planned',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reporting_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance"."data_sources" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "owner_unit" TEXT,
    "source_type" "governance"."SourceType" NOT NULL,
    "connection_type" "governance"."ConnectionType" NOT NULL,
    "frequency" "governance"."UpdateFrequency" NOT NULL DEFAULT 'ad_hoc',
    "status" "governance"."SourceStatus" NOT NULL DEFAULT 'active',
    "data_classification" "governance"."DataClassification" NOT NULL DEFAULT 'internal',
    "contact_person" TEXT,
    "contact_email" TEXT,
    "contains_personal_data" BOOLEAN NOT NULL DEFAULT false,
    "onboarding_status" "governance"."OnboardingStatus" NOT NULL DEFAULT 'discovered',
    "repository_location" TEXT,
    "notes" TEXT,
    "archived_at" TIMESTAMP(3),
    "last_received_at" TIMESTAMP(3),
    "last_successful_sync_at" TIMESTAMP(3),
    "last_successful_import_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "data_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance"."datasets" (
    "id" UUID NOT NULL,
    "data_source_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "domain" "governance"."DatasetDomain" NOT NULL DEFAULT 'other',
    "owner_unit" TEXT,
    "primary_identifier" TEXT,
    "frequency" "governance"."UpdateFrequency" NOT NULL DEFAULT 'ad_hoc',
    "onboarding_status" "governance"."OnboardingStatus" NOT NULL DEFAULT 'discovered',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "datasets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance"."dataset_versions" (
    "id" UUID NOT NULL,
    "dataset_id" UUID NOT NULL,
    "reporting_period_id" UUID,
    "version_number" INTEGER NOT NULL,
    "schema_snapshot" JSONB,
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "dataset_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance"."import_jobs" (
    "id" UUID NOT NULL,
    "data_source_id" UUID NOT NULL,
    "dataset_id" UUID NOT NULL,
    "reporting_period_id" UUID NOT NULL,
    "import_file_id" UUID,
    "integration_run_id" UUID,
    "status" "governance"."ImportStatus" NOT NULL DEFAULT 'uploaded',
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "column_count" INTEGER NOT NULL DEFAULT 0,
    "valid_row_count" INTEGER NOT NULL DEFAULT 0,
    "error_row_count" INTEGER NOT NULL DEFAULT 0,
    "warning_row_count" INTEGER NOT NULL DEFAULT 0,
    "duplicate_row_count" INTEGER NOT NULL DEFAULT 0,
    "quality_score" DECIMAL(5,2),
    "profile" JSONB,
    "status_message" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance"."import_files" (
    "id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "checksum_sha256" TEXT NOT NULL,
    "row_count" INTEGER,
    "column_count" INTEGER,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance"."import_rows" (
    "id" UUID NOT NULL,
    "import_job_id" UUID NOT NULL,
    "row_number" INTEGER NOT NULL,
    "raw_data" JSONB NOT NULL,
    "mapped_data" JSONB,
    "row_hash" TEXT NOT NULL,
    "is_valid" BOOLEAN NOT NULL DEFAULT false,
    "has_warnings" BOOLEAN NOT NULL DEFAULT false,
    "is_duplicate" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance"."validation_rules" (
    "id" UUID NOT NULL,
    "dataset_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "governance"."ValidationCategory" NOT NULL,
    "severity" "governance"."ValidationSeverity" NOT NULL DEFAULT 'error',
    "field_name" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "validation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance"."validation_results" (
    "id" UUID NOT NULL,
    "import_job_id" UUID NOT NULL,
    "import_row_id" UUID,
    "validation_rule_id" UUID,
    "row_number" INTEGER,
    "field_name" TEXT,
    "rule_code" TEXT NOT NULL,
    "category" "governance"."ValidationCategory" NOT NULL,
    "severity" "governance"."ValidationSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "raw_value" TEXT,
    "suggested_value" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolution" TEXT,
    "resolved_by" UUID,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "validation_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance"."approval_requests" (
    "id" UUID NOT NULL,
    "import_job_id" UUID NOT NULL,
    "status" "governance"."ApprovalStatus" NOT NULL DEFAULT 'pending',
    "submitted_by" UUID,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),
    "quality_score" DECIMAL(5,2),
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "warning_count" INTEGER NOT NULL DEFAULT 0,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance"."approval_actions" (
    "id" UUID NOT NULL,
    "approval_request_id" UUID NOT NULL,
    "action" "governance"."ApprovalActionType" NOT NULL,
    "actor_id" UUID,
    "previous_status" TEXT,
    "new_status" TEXT,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance"."publication_records" (
    "id" UUID NOT NULL,
    "dataset_id" UUID NOT NULL,
    "dataset_version_id" UUID,
    "import_job_id" UUID NOT NULL,
    "reporting_period_id" UUID NOT NULL,
    "status" "governance"."PublicationStatus" NOT NULL DEFAULT 'published',
    "published_row_count" INTEGER NOT NULL DEFAULT 0,
    "quality_score" DECIMAL(5,2),
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_by" UUID,
    "superseded_at" TIMESTAMP(3),
    "superseded_by_id" UUID,
    "withdrawn_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publication_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance"."audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "actor_email" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "summary" TEXT,
    "changes" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance"."mapping_templates" (
    "id" UUID NOT NULL,
    "dataset_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "target_entity" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "mapping_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance"."mapping_template_fields" (
    "id" UUID NOT NULL,
    "mapping_template_id" UUID NOT NULL,
    "source_column" TEXT NOT NULL,
    "canonical_field" TEXT NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "transformations" JSONB NOT NULL DEFAULT '[]',
    "default_value" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mapping_template_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance"."import_field_mappings" (
    "id" UUID NOT NULL,
    "import_job_id" UUID NOT NULL,
    "source_column" TEXT NOT NULL,
    "canonical_field" TEXT,
    "detected_type" TEXT,
    "sample_values" JSONB,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "transformations" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'unmapped',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_field_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance"."lookup_sets" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lookup_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance"."lookup_values" (
    "id" UUID NOT NULL,
    "lookup_set_id" UUID NOT NULL,
    "external_value" TEXT NOT NULL,
    "canonical_value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lookup_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance"."integrations" (
    "id" UUID NOT NULL,
    "data_source_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "connector_type" "governance"."ConnectorType" NOT NULL,
    "status" "governance"."IntegrationStatus" NOT NULL DEFAULT 'draft',
    "auth_type" TEXT,
    "base_url" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "secret_ciphertext" TEXT,
    "schedule_cron" TEXT,
    "last_attempt_at" TIMESTAMP(3),
    "last_success_at" TIMESTAMP(3),
    "last_failure_at" TIMESTAMP(3),
    "failure_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance"."integration_runs" (
    "id" UUID NOT NULL,
    "integration_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "records_received" INTEGER NOT NULL DEFAULT 0,
    "records_processed" INTEGER NOT NULL DEFAULT 0,
    "records_rejected" INTEGER NOT NULL DEFAULT 0,
    "error_summary" TEXT,
    "triggered_by" UUID,

    CONSTRAINT "integration_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beneficiaries"."beneficiaries" (
    "id" UUID NOT NULL,
    "avdp_reference" TEXT,
    "full_name" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "sex" "beneficiaries"."Sex" NOT NULL DEFAULT 'unknown',
    "date_of_birth" DATE,
    "age_group" TEXT,
    "phone" TEXT,
    "beneficiary_type" TEXT,
    "is_youth" BOOLEAN,
    "disability" BOOLEAN,
    "status" "beneficiaries"."BeneficiaryStatus" NOT NULL DEFAULT 'provisional',
    "merged_into_id" UUID,
    "source_import_job_id" UUID,
    "first_seen_period_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "beneficiaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beneficiaries"."beneficiary_identifiers" (
    "id" UUID NOT NULL,
    "beneficiary_id" UUID NOT NULL,
    "identifier_type" "beneficiaries"."IdentifierType" NOT NULL,
    "value" TEXT NOT NULL,
    "issuing_source" TEXT,
    "is_trusted" BOOLEAN NOT NULL DEFAULT false,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "retired_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beneficiary_identifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beneficiaries"."beneficiary_locations" (
    "id" UUID NOT NULL,
    "beneficiary_id" UUID NOT NULL,
    "district_id" UUID,
    "chiefdom_id" UUID,
    "ward_id" UUID,
    "community_id" UUID,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" DATE,
    "valid_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beneficiary_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beneficiaries"."beneficiary_value_chains" (
    "id" UUID NOT NULL,
    "beneficiary_id" UUID NOT NULL,
    "value_chain_id" UUID NOT NULL,
    "role" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "enrolled_on" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beneficiary_value_chains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beneficiaries"."farmer_groups" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization_id" UUID,
    "group_type" TEXT,
    "district_id" UUID,
    "chiefdom_id" UUID,
    "registered_on" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farmer_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beneficiaries"."farmer_group_members" (
    "id" UUID NOT NULL,
    "farmer_group_id" UUID NOT NULL,
    "beneficiary_id" UUID NOT NULL,
    "membership_id" TEXT,
    "role" TEXT,
    "joined_on" DATE,
    "left_on" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farmer_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beneficiaries"."duplicate_candidates" (
    "id" UUID NOT NULL,
    "primary_id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "match_type" "beneficiaries"."DuplicateMatchType" NOT NULL,
    "rule_code" TEXT NOT NULL,
    "score" DECIMAL(5,4) NOT NULL,
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "status" "beneficiaries"."DuplicateReviewStatus" NOT NULL DEFAULT 'pending',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "review_comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "duplicate_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beneficiaries"."beneficiary_merges" (
    "id" UUID NOT NULL,
    "survivor_id" UUID NOT NULL,
    "merged_id" UUID NOT NULL,
    "match_type" "beneficiaries"."DuplicateMatchType" NOT NULL,
    "rule_code" TEXT,
    "decision" TEXT NOT NULL,
    "reviewer_id" UUID,
    "merged_snapshot" JSONB NOT NULL,
    "retired_identifiers" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beneficiary_merges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_delivery"."activities" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "activity_type" TEXT,
    "reporting_period_id" UUID,
    "district_id" UUID,
    "chiefdom_id" UUID,
    "value_chain_id" UUID,
    "implementing_partner_id" UUID,
    "start_date" DATE,
    "end_date" DATE,
    "status" TEXT,
    "source_import_job_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_delivery"."activity_participants" (
    "id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "beneficiary_id" UUID NOT NULL,
    "role" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_delivery"."training_events" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "training_type" TEXT,
    "topic" TEXT,
    "reporting_period_id" UUID,
    "district_id" UUID,
    "chiefdom_id" UUID,
    "value_chain_id" UUID,
    "implementing_partner_id" UUID,
    "start_date" DATE,
    "end_date" DATE,
    "duration_days" DECIMAL(6,2),
    "planned_participants" INTEGER,
    "source_import_job_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_delivery"."training_attendance" (
    "id" UUID NOT NULL,
    "training_event_id" UUID NOT NULL,
    "beneficiary_id" UUID NOT NULL,
    "attended" BOOLEAN NOT NULL DEFAULT true,
    "certified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_delivery"."input_distributions" (
    "id" UUID NOT NULL,
    "beneficiary_id" UUID,
    "reporting_period_id" UUID,
    "input_type" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit_of_measure_id" UUID,
    "distributed_on" DATE,
    "district_id" UUID,
    "source_import_job_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "input_distributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_delivery"."equipment_distributions" (
    "id" UUID NOT NULL,
    "beneficiary_id" UUID,
    "farmer_group_id" UUID,
    "reporting_period_id" UUID,
    "equipment_type" TEXT NOT NULL,
    "serial_number" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "distributed_on" DATE,
    "district_id" UUID,
    "source_import_job_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_distributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_delivery"."infrastructure_assets" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "asset_type" TEXT NOT NULL,
    "status" TEXT,
    "district_id" UUID,
    "chiefdom_id" UUID,
    "community_id" UUID,
    "value_chain_id" UUID,
    "implementing_partner_id" UUID,
    "reporting_period_id" UUID,
    "quantity" DECIMAL(18,4),
    "unit_label" TEXT,
    "completion_percent" DECIMAL(5,2),
    "commissioned_on" DATE,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "beneficiaries_served" INTEGER,
    "source_import_job_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "infrastructure_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production"."farms" (
    "id" UUID NOT NULL,
    "code" TEXT,
    "beneficiary_id" UUID,
    "district_id" UUID,
    "chiefdom_id" UUID,
    "community_id" UUID,
    "total_area_ha" DECIMAL(12,4),
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "source_import_job_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production"."farm_plots" (
    "id" UUID NOT NULL,
    "farm_id" UUID NOT NULL,
    "value_chain_id" UUID,
    "plot_label" TEXT,
    "area_ha" DECIMAL(12,4),
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farm_plots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production"."production_records" (
    "id" UUID NOT NULL,
    "beneficiary_id" UUID,
    "farm_plot_id" UUID,
    "value_chain_id" UUID NOT NULL,
    "reporting_period_id" UUID NOT NULL,
    "season" TEXT,
    "cultivated_area_ha" DECIMAL(12,4),
    "quantity" DECIMAL(18,4),
    "unit_of_measure_id" UUID,
    "yield_per_ha" DECIMAL(18,4),
    "district_id" UUID,
    "source_import_job_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production"."harvest_records" (
    "id" UUID NOT NULL,
    "beneficiary_id" UUID,
    "farm_plot_id" UUID,
    "value_chain_id" UUID NOT NULL,
    "reporting_period_id" UUID NOT NULL,
    "harvest_date" DATE,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit_of_measure_id" UUID,
    "post_harvest_loss" DECIMAL(18,4),
    "district_id" UUID,
    "source_import_job_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "harvest_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production"."sales_records" (
    "id" UUID NOT NULL,
    "beneficiary_id" UUID,
    "value_chain_id" UUID NOT NULL,
    "reporting_period_id" UUID NOT NULL,
    "sale_date" DATE,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit_of_measure_id" UUID,
    "unit_price" DECIMAL(18,4),
    "total_value" DECIMAL(18,2),
    "currency" TEXT NOT NULL DEFAULT 'SLE',
    "buyer_type" TEXT,
    "district_id" UUID,
    "source_import_job_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitoring"."indicators" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short_name" TEXT,
    "definition" TEXT,
    "description" TEXT,
    "unit" TEXT,
    "result_level" "monitoring"."ResultLevel" NOT NULL DEFAULT 'output',
    "calculation_method" TEXT,
    "calculation_ref" TEXT,
    "calculation_version" INTEGER NOT NULL DEFAULT 1,
    "frequency" "governance"."UpdateFrequency" NOT NULL DEFAULT 'quarterly',
    "responsible_unit" TEXT,
    "primary_data_source_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitoring"."indicator_disaggregations" (
    "id" UUID NOT NULL,
    "indicator_id" UUID NOT NULL,
    "dimension" "monitoring"."DisaggregationDimension" NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indicator_disaggregations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitoring"."indicator_targets" (
    "id" UUID NOT NULL,
    "indicator_id" UUID NOT NULL,
    "reporting_period_id" UUID,
    "fiscal_year" INTEGER,
    "district_id" UUID,
    "value_chain_id" UUID,
    "target_value" DECIMAL(18,4) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "indicator_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitoring"."indicator_observations" (
    "id" UUID NOT NULL,
    "indicator_id" UUID NOT NULL,
    "reporting_period_id" UUID NOT NULL,
    "district_id" UUID,
    "value_chain_id" UUID,
    "sex" TEXT,
    "age_group" TEXT,
    "value" DECIMAL(18,4) NOT NULL,
    "calculation_version" INTEGER NOT NULL DEFAULT 1,
    "publication_record_id" UUID,
    "source_import_job_id" UUID,
    "observed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "indicator_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics"."analytics_refresh_log" (
    "id" UUID NOT NULL,
    "view_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "row_count" INTEGER,
    "duration_ms" INTEGER,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "triggered_by" UUID,

    CONSTRAINT "analytics_refresh_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "admin"."users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "admin"."users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "admin"."roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "admin"."permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "admin"."sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "admin"."sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "admin"."sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "districts_code_key" ON "master_data"."districts"("code");

-- CreateIndex
CREATE INDEX "districts_name_idx" ON "master_data"."districts"("name");

-- CreateIndex
CREATE UNIQUE INDEX "chiefdoms_code_key" ON "master_data"."chiefdoms"("code");

-- CreateIndex
CREATE INDEX "chiefdoms_district_id_idx" ON "master_data"."chiefdoms"("district_id");

-- CreateIndex
CREATE UNIQUE INDEX "chiefdoms_district_id_name_key" ON "master_data"."chiefdoms"("district_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "wards_code_key" ON "master_data"."wards"("code");

-- CreateIndex
CREATE INDEX "wards_chiefdom_id_idx" ON "master_data"."wards"("chiefdom_id");

-- CreateIndex
CREATE UNIQUE INDEX "wards_chiefdom_id_name_key" ON "master_data"."wards"("chiefdom_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "communities_code_key" ON "master_data"."communities"("code");

-- CreateIndex
CREATE INDEX "communities_district_id_idx" ON "master_data"."communities"("district_id");

-- CreateIndex
CREATE INDEX "communities_chiefdom_id_idx" ON "master_data"."communities"("chiefdom_id");

-- CreateIndex
CREATE INDEX "communities_name_idx" ON "master_data"."communities"("name");

-- CreateIndex
CREATE UNIQUE INDEX "value_chains_code_key" ON "master_data"."value_chains"("code");

-- CreateIndex
CREATE INDEX "value_chains_name_idx" ON "master_data"."value_chains"("name");

-- CreateIndex
CREATE UNIQUE INDEX "units_of_measure_code_key" ON "master_data"."units_of_measure"("code");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_code_key" ON "master_data"."organizations"("code");

-- CreateIndex
CREATE UNIQUE INDEX "implementing_partners_code_key" ON "master_data"."implementing_partners"("code");

-- CreateIndex
CREATE UNIQUE INDEX "reporting_periods_code_key" ON "master_data"."reporting_periods"("code");

-- CreateIndex
CREATE INDEX "reporting_periods_fiscal_year_idx" ON "master_data"."reporting_periods"("fiscal_year");

-- CreateIndex
CREATE INDEX "reporting_periods_status_idx" ON "master_data"."reporting_periods"("status");

-- CreateIndex
CREATE INDEX "reporting_periods_start_date_end_date_idx" ON "master_data"."reporting_periods"("start_date", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "data_sources_code_key" ON "governance"."data_sources"("code");

-- CreateIndex
CREATE INDEX "data_sources_status_idx" ON "governance"."data_sources"("status");

-- CreateIndex
CREATE INDEX "data_sources_source_type_idx" ON "governance"."data_sources"("source_type");

-- CreateIndex
CREATE INDEX "data_sources_onboarding_status_idx" ON "governance"."data_sources"("onboarding_status");

-- CreateIndex
CREATE UNIQUE INDEX "datasets_code_key" ON "governance"."datasets"("code");

-- CreateIndex
CREATE INDEX "datasets_data_source_id_idx" ON "governance"."datasets"("data_source_id");

-- CreateIndex
CREATE INDEX "datasets_domain_idx" ON "governance"."datasets"("domain");

-- CreateIndex
CREATE INDEX "dataset_versions_reporting_period_id_idx" ON "governance"."dataset_versions"("reporting_period_id");

-- CreateIndex
CREATE UNIQUE INDEX "dataset_versions_dataset_id_version_number_key" ON "governance"."dataset_versions"("dataset_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "import_jobs_import_file_id_key" ON "governance"."import_jobs"("import_file_id");

-- CreateIndex
CREATE INDEX "import_jobs_data_source_id_idx" ON "governance"."import_jobs"("data_source_id");

-- CreateIndex
CREATE INDEX "import_jobs_dataset_id_idx" ON "governance"."import_jobs"("dataset_id");

-- CreateIndex
CREATE INDEX "import_jobs_reporting_period_id_idx" ON "governance"."import_jobs"("reporting_period_id");

-- CreateIndex
CREATE INDEX "import_jobs_status_idx" ON "governance"."import_jobs"("status");

-- CreateIndex
CREATE INDEX "import_jobs_created_at_idx" ON "governance"."import_jobs"("created_at");

-- CreateIndex
CREATE INDEX "import_files_checksum_sha256_idx" ON "governance"."import_files"("checksum_sha256");

-- CreateIndex
CREATE INDEX "import_rows_import_job_id_is_valid_idx" ON "governance"."import_rows"("import_job_id", "is_valid");

-- CreateIndex
CREATE INDEX "import_rows_row_hash_idx" ON "governance"."import_rows"("row_hash");

-- CreateIndex
CREATE UNIQUE INDEX "import_rows_import_job_id_row_number_key" ON "governance"."import_rows"("import_job_id", "row_number");

-- CreateIndex
CREATE UNIQUE INDEX "validation_rules_code_key" ON "governance"."validation_rules"("code");

-- CreateIndex
CREATE INDEX "validation_rules_dataset_id_idx" ON "governance"."validation_rules"("dataset_id");

-- CreateIndex
CREATE INDEX "validation_rules_category_idx" ON "governance"."validation_rules"("category");

-- CreateIndex
CREATE INDEX "validation_results_import_job_id_severity_idx" ON "governance"."validation_results"("import_job_id", "severity");

-- CreateIndex
CREATE INDEX "validation_results_import_job_id_resolved_idx" ON "governance"."validation_results"("import_job_id", "resolved");

-- CreateIndex
CREATE INDEX "validation_results_rule_code_idx" ON "governance"."validation_results"("rule_code");

-- CreateIndex
CREATE INDEX "approval_requests_status_idx" ON "governance"."approval_requests"("status");

-- CreateIndex
CREATE INDEX "approval_requests_import_job_id_idx" ON "governance"."approval_requests"("import_job_id");

-- CreateIndex
CREATE INDEX "approval_actions_approval_request_id_idx" ON "governance"."approval_actions"("approval_request_id");

-- CreateIndex
CREATE INDEX "publication_records_dataset_id_status_idx" ON "governance"."publication_records"("dataset_id", "status");

-- CreateIndex
CREATE INDEX "publication_records_reporting_period_id_idx" ON "governance"."publication_records"("reporting_period_id");

-- CreateIndex
CREATE INDEX "publication_records_published_at_idx" ON "governance"."publication_records"("published_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "governance"."audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "governance"."audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "governance"."audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "mapping_templates_code_key" ON "governance"."mapping_templates"("code");

-- CreateIndex
CREATE INDEX "mapping_templates_dataset_id_idx" ON "governance"."mapping_templates"("dataset_id");

-- CreateIndex
CREATE UNIQUE INDEX "mapping_template_fields_mapping_template_id_source_column_key" ON "governance"."mapping_template_fields"("mapping_template_id", "source_column");

-- CreateIndex
CREATE UNIQUE INDEX "import_field_mappings_import_job_id_source_column_key" ON "governance"."import_field_mappings"("import_job_id", "source_column");

-- CreateIndex
CREATE UNIQUE INDEX "lookup_sets_code_key" ON "governance"."lookup_sets"("code");

-- CreateIndex
CREATE UNIQUE INDEX "lookup_values_lookup_set_id_external_value_key" ON "governance"."lookup_values"("lookup_set_id", "external_value");

-- CreateIndex
CREATE UNIQUE INDEX "integrations_code_key" ON "governance"."integrations"("code");

-- CreateIndex
CREATE INDEX "integrations_data_source_id_idx" ON "governance"."integrations"("data_source_id");

-- CreateIndex
CREATE INDEX "integrations_status_idx" ON "governance"."integrations"("status");

-- CreateIndex
CREATE INDEX "integration_runs_integration_id_started_at_idx" ON "governance"."integration_runs"("integration_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "beneficiaries_avdp_reference_key" ON "beneficiaries"."beneficiaries"("avdp_reference");

-- CreateIndex
CREATE INDEX "beneficiaries_status_idx" ON "beneficiaries"."beneficiaries"("status");

-- CreateIndex
CREATE INDEX "beneficiaries_phone_idx" ON "beneficiaries"."beneficiaries"("phone");

-- CreateIndex
CREATE INDEX "beneficiaries_full_name_idx" ON "beneficiaries"."beneficiaries"("full_name");

-- CreateIndex
CREATE INDEX "beneficiary_identifiers_beneficiary_id_idx" ON "beneficiaries"."beneficiary_identifiers"("beneficiary_id");

-- CreateIndex
CREATE INDEX "beneficiary_identifiers_value_idx" ON "beneficiaries"."beneficiary_identifiers"("value");

-- CreateIndex
CREATE UNIQUE INDEX "beneficiary_identifiers_identifier_type_value_issuing_sourc_key" ON "beneficiaries"."beneficiary_identifiers"("identifier_type", "value", "issuing_source");

-- CreateIndex
CREATE INDEX "beneficiary_locations_beneficiary_id_idx" ON "beneficiaries"."beneficiary_locations"("beneficiary_id");

-- CreateIndex
CREATE INDEX "beneficiary_locations_district_id_idx" ON "beneficiaries"."beneficiary_locations"("district_id");

-- CreateIndex
CREATE INDEX "beneficiary_locations_chiefdom_id_idx" ON "beneficiaries"."beneficiary_locations"("chiefdom_id");

-- CreateIndex
CREATE INDEX "beneficiary_value_chains_value_chain_id_idx" ON "beneficiaries"."beneficiary_value_chains"("value_chain_id");

-- CreateIndex
CREATE UNIQUE INDEX "beneficiary_value_chains_beneficiary_id_value_chain_id_key" ON "beneficiaries"."beneficiary_value_chains"("beneficiary_id", "value_chain_id");

-- CreateIndex
CREATE UNIQUE INDEX "farmer_groups_code_key" ON "beneficiaries"."farmer_groups"("code");

-- CreateIndex
CREATE INDEX "farmer_groups_district_id_idx" ON "beneficiaries"."farmer_groups"("district_id");

-- CreateIndex
CREATE INDEX "farmer_group_members_beneficiary_id_idx" ON "beneficiaries"."farmer_group_members"("beneficiary_id");

-- CreateIndex
CREATE UNIQUE INDEX "farmer_group_members_farmer_group_id_beneficiary_id_key" ON "beneficiaries"."farmer_group_members"("farmer_group_id", "beneficiary_id");

-- CreateIndex
CREATE INDEX "duplicate_candidates_status_idx" ON "beneficiaries"."duplicate_candidates"("status");

-- CreateIndex
CREATE INDEX "duplicate_candidates_match_type_idx" ON "beneficiaries"."duplicate_candidates"("match_type");

-- CreateIndex
CREATE UNIQUE INDEX "duplicate_candidates_primary_id_candidate_id_rule_code_key" ON "beneficiaries"."duplicate_candidates"("primary_id", "candidate_id", "rule_code");

-- CreateIndex
CREATE INDEX "beneficiary_merges_survivor_id_idx" ON "beneficiaries"."beneficiary_merges"("survivor_id");

-- CreateIndex
CREATE INDEX "beneficiary_merges_merged_id_idx" ON "beneficiaries"."beneficiary_merges"("merged_id");

-- CreateIndex
CREATE UNIQUE INDEX "activities_code_key" ON "project_delivery"."activities"("code");

-- CreateIndex
CREATE INDEX "activities_reporting_period_id_idx" ON "project_delivery"."activities"("reporting_period_id");

-- CreateIndex
CREATE INDEX "activities_district_id_idx" ON "project_delivery"."activities"("district_id");

-- CreateIndex
CREATE INDEX "activities_value_chain_id_idx" ON "project_delivery"."activities"("value_chain_id");

-- CreateIndex
CREATE INDEX "activity_participants_beneficiary_id_idx" ON "project_delivery"."activity_participants"("beneficiary_id");

-- CreateIndex
CREATE UNIQUE INDEX "activity_participants_activity_id_beneficiary_id_key" ON "project_delivery"."activity_participants"("activity_id", "beneficiary_id");

-- CreateIndex
CREATE UNIQUE INDEX "training_events_code_key" ON "project_delivery"."training_events"("code");

-- CreateIndex
CREATE INDEX "training_events_reporting_period_id_idx" ON "project_delivery"."training_events"("reporting_period_id");

-- CreateIndex
CREATE INDEX "training_events_district_id_idx" ON "project_delivery"."training_events"("district_id");

-- CreateIndex
CREATE INDEX "training_events_value_chain_id_idx" ON "project_delivery"."training_events"("value_chain_id");

-- CreateIndex
CREATE INDEX "training_attendance_beneficiary_id_idx" ON "project_delivery"."training_attendance"("beneficiary_id");

-- CreateIndex
CREATE UNIQUE INDEX "training_attendance_training_event_id_beneficiary_id_key" ON "project_delivery"."training_attendance"("training_event_id", "beneficiary_id");

-- CreateIndex
CREATE INDEX "input_distributions_beneficiary_id_idx" ON "project_delivery"."input_distributions"("beneficiary_id");

-- CreateIndex
CREATE INDEX "input_distributions_reporting_period_id_idx" ON "project_delivery"."input_distributions"("reporting_period_id");

-- CreateIndex
CREATE INDEX "equipment_distributions_reporting_period_id_idx" ON "project_delivery"."equipment_distributions"("reporting_period_id");

-- CreateIndex
CREATE UNIQUE INDEX "infrastructure_assets_code_key" ON "project_delivery"."infrastructure_assets"("code");

-- CreateIndex
CREATE INDEX "infrastructure_assets_district_id_idx" ON "project_delivery"."infrastructure_assets"("district_id");

-- CreateIndex
CREATE INDEX "infrastructure_assets_asset_type_idx" ON "project_delivery"."infrastructure_assets"("asset_type");

-- CreateIndex
CREATE INDEX "infrastructure_assets_reporting_period_id_idx" ON "project_delivery"."infrastructure_assets"("reporting_period_id");

-- CreateIndex
CREATE UNIQUE INDEX "farms_code_key" ON "production"."farms"("code");

-- CreateIndex
CREATE INDEX "farms_beneficiary_id_idx" ON "production"."farms"("beneficiary_id");

-- CreateIndex
CREATE INDEX "farms_district_id_idx" ON "production"."farms"("district_id");

-- CreateIndex
CREATE INDEX "farm_plots_farm_id_idx" ON "production"."farm_plots"("farm_id");

-- CreateIndex
CREATE INDEX "farm_plots_value_chain_id_idx" ON "production"."farm_plots"("value_chain_id");

-- CreateIndex
CREATE INDEX "production_records_reporting_period_id_value_chain_id_idx" ON "production"."production_records"("reporting_period_id", "value_chain_id");

-- CreateIndex
CREATE INDEX "production_records_district_id_idx" ON "production"."production_records"("district_id");

-- CreateIndex
CREATE INDEX "production_records_beneficiary_id_idx" ON "production"."production_records"("beneficiary_id");

-- CreateIndex
CREATE INDEX "harvest_records_reporting_period_id_value_chain_id_idx" ON "production"."harvest_records"("reporting_period_id", "value_chain_id");

-- CreateIndex
CREATE INDEX "sales_records_reporting_period_id_value_chain_id_idx" ON "production"."sales_records"("reporting_period_id", "value_chain_id");

-- CreateIndex
CREATE UNIQUE INDEX "indicators_code_key" ON "monitoring"."indicators"("code");

-- CreateIndex
CREATE INDEX "indicators_result_level_idx" ON "monitoring"."indicators"("result_level");

-- CreateIndex
CREATE INDEX "indicators_is_active_idx" ON "monitoring"."indicators"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "indicator_disaggregations_indicator_id_dimension_key" ON "monitoring"."indicator_disaggregations"("indicator_id", "dimension");

-- CreateIndex
CREATE INDEX "indicator_targets_indicator_id_idx" ON "monitoring"."indicator_targets"("indicator_id");

-- CreateIndex
CREATE UNIQUE INDEX "indicator_targets_indicator_id_reporting_period_id_district_key" ON "monitoring"."indicator_targets"("indicator_id", "reporting_period_id", "district_id", "value_chain_id");

-- CreateIndex
CREATE INDEX "indicator_observations_indicator_id_reporting_period_id_idx" ON "monitoring"."indicator_observations"("indicator_id", "reporting_period_id");

-- CreateIndex
CREATE INDEX "indicator_observations_district_id_idx" ON "monitoring"."indicator_observations"("district_id");

-- CreateIndex
CREATE INDEX "analytics_refresh_log_view_name_started_at_idx" ON "analytics"."analytics_refresh_log"("view_name", "started_at");

-- AddForeignKey
ALTER TABLE "admin"."role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "admin"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin"."role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "admin"."permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin"."user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin"."user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "admin"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin"."sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."chiefdoms" ADD CONSTRAINT "chiefdoms_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "master_data"."districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."wards" ADD CONSTRAINT "wards_chiefdom_id_fkey" FOREIGN KEY ("chiefdom_id") REFERENCES "master_data"."chiefdoms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."communities" ADD CONSTRAINT "communities_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "master_data"."districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."communities" ADD CONSTRAINT "communities_chiefdom_id_fkey" FOREIGN KEY ("chiefdom_id") REFERENCES "master_data"."chiefdoms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."communities" ADD CONSTRAINT "communities_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "master_data"."wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."datasets" ADD CONSTRAINT "datasets_data_source_id_fkey" FOREIGN KEY ("data_source_id") REFERENCES "governance"."data_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."dataset_versions" ADD CONSTRAINT "dataset_versions_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "governance"."datasets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."dataset_versions" ADD CONSTRAINT "dataset_versions_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "master_data"."reporting_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."import_jobs" ADD CONSTRAINT "import_jobs_data_source_id_fkey" FOREIGN KEY ("data_source_id") REFERENCES "governance"."data_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."import_jobs" ADD CONSTRAINT "import_jobs_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "governance"."datasets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."import_jobs" ADD CONSTRAINT "import_jobs_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "master_data"."reporting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."import_jobs" ADD CONSTRAINT "import_jobs_import_file_id_fkey" FOREIGN KEY ("import_file_id") REFERENCES "governance"."import_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."import_jobs" ADD CONSTRAINT "import_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "admin"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."import_jobs" ADD CONSTRAINT "import_jobs_integration_run_id_fkey" FOREIGN KEY ("integration_run_id") REFERENCES "governance"."integration_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."import_files" ADD CONSTRAINT "import_files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "admin"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."import_rows" ADD CONSTRAINT "import_rows_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "governance"."import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."validation_rules" ADD CONSTRAINT "validation_rules_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "governance"."datasets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."validation_results" ADD CONSTRAINT "validation_results_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "governance"."import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."validation_results" ADD CONSTRAINT "validation_results_import_row_id_fkey" FOREIGN KEY ("import_row_id") REFERENCES "governance"."import_rows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."validation_results" ADD CONSTRAINT "validation_results_validation_rule_id_fkey" FOREIGN KEY ("validation_rule_id") REFERENCES "governance"."validation_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."validation_results" ADD CONSTRAINT "validation_results_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "admin"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."approval_requests" ADD CONSTRAINT "approval_requests_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "governance"."import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."approval_requests" ADD CONSTRAINT "approval_requests_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "admin"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."approval_actions" ADD CONSTRAINT "approval_actions_approval_request_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "governance"."approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."approval_actions" ADD CONSTRAINT "approval_actions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "admin"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."publication_records" ADD CONSTRAINT "publication_records_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "governance"."datasets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."publication_records" ADD CONSTRAINT "publication_records_dataset_version_id_fkey" FOREIGN KEY ("dataset_version_id") REFERENCES "governance"."dataset_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."publication_records" ADD CONSTRAINT "publication_records_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "governance"."import_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."publication_records" ADD CONSTRAINT "publication_records_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "master_data"."reporting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."publication_records" ADD CONSTRAINT "publication_records_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "admin"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "admin"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."mapping_templates" ADD CONSTRAINT "mapping_templates_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "governance"."datasets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."mapping_template_fields" ADD CONSTRAINT "mapping_template_fields_mapping_template_id_fkey" FOREIGN KEY ("mapping_template_id") REFERENCES "governance"."mapping_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."import_field_mappings" ADD CONSTRAINT "import_field_mappings_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "governance"."import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."lookup_values" ADD CONSTRAINT "lookup_values_lookup_set_id_fkey" FOREIGN KEY ("lookup_set_id") REFERENCES "governance"."lookup_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."integrations" ADD CONSTRAINT "integrations_data_source_id_fkey" FOREIGN KEY ("data_source_id") REFERENCES "governance"."data_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance"."integration_runs" ADD CONSTRAINT "integration_runs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "governance"."integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiaries"."beneficiaries" ADD CONSTRAINT "beneficiaries_merged_into_id_fkey" FOREIGN KEY ("merged_into_id") REFERENCES "beneficiaries"."beneficiaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiaries"."beneficiary_identifiers" ADD CONSTRAINT "beneficiary_identifiers_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"."beneficiaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiaries"."beneficiary_locations" ADD CONSTRAINT "beneficiary_locations_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"."beneficiaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiaries"."beneficiary_locations" ADD CONSTRAINT "beneficiary_locations_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "master_data"."districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiaries"."beneficiary_locations" ADD CONSTRAINT "beneficiary_locations_chiefdom_id_fkey" FOREIGN KEY ("chiefdom_id") REFERENCES "master_data"."chiefdoms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiaries"."beneficiary_locations" ADD CONSTRAINT "beneficiary_locations_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "master_data"."wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiaries"."beneficiary_locations" ADD CONSTRAINT "beneficiary_locations_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "master_data"."communities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiaries"."beneficiary_value_chains" ADD CONSTRAINT "beneficiary_value_chains_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"."beneficiaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiaries"."beneficiary_value_chains" ADD CONSTRAINT "beneficiary_value_chains_value_chain_id_fkey" FOREIGN KEY ("value_chain_id") REFERENCES "master_data"."value_chains"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiaries"."farmer_groups" ADD CONSTRAINT "farmer_groups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "master_data"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiaries"."farmer_group_members" ADD CONSTRAINT "farmer_group_members_farmer_group_id_fkey" FOREIGN KEY ("farmer_group_id") REFERENCES "beneficiaries"."farmer_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiaries"."farmer_group_members" ADD CONSTRAINT "farmer_group_members_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"."beneficiaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiaries"."duplicate_candidates" ADD CONSTRAINT "duplicate_candidates_primary_id_fkey" FOREIGN KEY ("primary_id") REFERENCES "beneficiaries"."beneficiaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiaries"."duplicate_candidates" ADD CONSTRAINT "duplicate_candidates_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "beneficiaries"."beneficiaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiaries"."duplicate_candidates" ADD CONSTRAINT "duplicate_candidates_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "admin"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiaries"."beneficiary_merges" ADD CONSTRAINT "beneficiary_merges_survivor_id_fkey" FOREIGN KEY ("survivor_id") REFERENCES "beneficiaries"."beneficiaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiaries"."beneficiary_merges" ADD CONSTRAINT "beneficiary_merges_merged_id_fkey" FOREIGN KEY ("merged_id") REFERENCES "beneficiaries"."beneficiaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiaries"."beneficiary_merges" ADD CONSTRAINT "beneficiary_merges_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "admin"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_delivery"."activities" ADD CONSTRAINT "activities_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "master_data"."reporting_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_delivery"."activities" ADD CONSTRAINT "activities_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "master_data"."districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_delivery"."activities" ADD CONSTRAINT "activities_chiefdom_id_fkey" FOREIGN KEY ("chiefdom_id") REFERENCES "master_data"."chiefdoms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_delivery"."activities" ADD CONSTRAINT "activities_value_chain_id_fkey" FOREIGN KEY ("value_chain_id") REFERENCES "master_data"."value_chains"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_delivery"."activities" ADD CONSTRAINT "activities_implementing_partner_id_fkey" FOREIGN KEY ("implementing_partner_id") REFERENCES "master_data"."implementing_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_delivery"."activity_participants" ADD CONSTRAINT "activity_participants_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "project_delivery"."activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_delivery"."activity_participants" ADD CONSTRAINT "activity_participants_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"."beneficiaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_delivery"."training_events" ADD CONSTRAINT "training_events_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "master_data"."reporting_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_delivery"."training_events" ADD CONSTRAINT "training_events_value_chain_id_fkey" FOREIGN KEY ("value_chain_id") REFERENCES "master_data"."value_chains"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_delivery"."training_events" ADD CONSTRAINT "training_events_implementing_partner_id_fkey" FOREIGN KEY ("implementing_partner_id") REFERENCES "master_data"."implementing_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_delivery"."training_attendance" ADD CONSTRAINT "training_attendance_training_event_id_fkey" FOREIGN KEY ("training_event_id") REFERENCES "project_delivery"."training_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_delivery"."training_attendance" ADD CONSTRAINT "training_attendance_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"."beneficiaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_delivery"."input_distributions" ADD CONSTRAINT "input_distributions_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"."beneficiaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_delivery"."input_distributions" ADD CONSTRAINT "input_distributions_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "master_data"."reporting_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_delivery"."input_distributions" ADD CONSTRAINT "input_distributions_unit_of_measure_id_fkey" FOREIGN KEY ("unit_of_measure_id") REFERENCES "master_data"."units_of_measure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_delivery"."equipment_distributions" ADD CONSTRAINT "equipment_distributions_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"."beneficiaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_delivery"."equipment_distributions" ADD CONSTRAINT "equipment_distributions_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "master_data"."reporting_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_delivery"."infrastructure_assets" ADD CONSTRAINT "infrastructure_assets_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "master_data"."districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_delivery"."infrastructure_assets" ADD CONSTRAINT "infrastructure_assets_chiefdom_id_fkey" FOREIGN KEY ("chiefdom_id") REFERENCES "master_data"."chiefdoms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_delivery"."infrastructure_assets" ADD CONSTRAINT "infrastructure_assets_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "master_data"."communities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_delivery"."infrastructure_assets" ADD CONSTRAINT "infrastructure_assets_value_chain_id_fkey" FOREIGN KEY ("value_chain_id") REFERENCES "master_data"."value_chains"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_delivery"."infrastructure_assets" ADD CONSTRAINT "infrastructure_assets_implementing_partner_id_fkey" FOREIGN KEY ("implementing_partner_id") REFERENCES "master_data"."implementing_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_delivery"."infrastructure_assets" ADD CONSTRAINT "infrastructure_assets_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "master_data"."reporting_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production"."farms" ADD CONSTRAINT "farms_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"."beneficiaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production"."farms" ADD CONSTRAINT "farms_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "master_data"."districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production"."farms" ADD CONSTRAINT "farms_chiefdom_id_fkey" FOREIGN KEY ("chiefdom_id") REFERENCES "master_data"."chiefdoms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production"."farms" ADD CONSTRAINT "farms_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "master_data"."communities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production"."farm_plots" ADD CONSTRAINT "farm_plots_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "production"."farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production"."farm_plots" ADD CONSTRAINT "farm_plots_value_chain_id_fkey" FOREIGN KEY ("value_chain_id") REFERENCES "master_data"."value_chains"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production"."production_records" ADD CONSTRAINT "production_records_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"."beneficiaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production"."production_records" ADD CONSTRAINT "production_records_farm_plot_id_fkey" FOREIGN KEY ("farm_plot_id") REFERENCES "production"."farm_plots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production"."production_records" ADD CONSTRAINT "production_records_value_chain_id_fkey" FOREIGN KEY ("value_chain_id") REFERENCES "master_data"."value_chains"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production"."production_records" ADD CONSTRAINT "production_records_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "master_data"."reporting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production"."production_records" ADD CONSTRAINT "production_records_unit_of_measure_id_fkey" FOREIGN KEY ("unit_of_measure_id") REFERENCES "master_data"."units_of_measure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production"."harvest_records" ADD CONSTRAINT "harvest_records_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"."beneficiaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production"."harvest_records" ADD CONSTRAINT "harvest_records_farm_plot_id_fkey" FOREIGN KEY ("farm_plot_id") REFERENCES "production"."farm_plots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production"."harvest_records" ADD CONSTRAINT "harvest_records_value_chain_id_fkey" FOREIGN KEY ("value_chain_id") REFERENCES "master_data"."value_chains"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production"."harvest_records" ADD CONSTRAINT "harvest_records_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "master_data"."reporting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production"."harvest_records" ADD CONSTRAINT "harvest_records_unit_of_measure_id_fkey" FOREIGN KEY ("unit_of_measure_id") REFERENCES "master_data"."units_of_measure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production"."sales_records" ADD CONSTRAINT "sales_records_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"."beneficiaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production"."sales_records" ADD CONSTRAINT "sales_records_value_chain_id_fkey" FOREIGN KEY ("value_chain_id") REFERENCES "master_data"."value_chains"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production"."sales_records" ADD CONSTRAINT "sales_records_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "master_data"."reporting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production"."sales_records" ADD CONSTRAINT "sales_records_unit_of_measure_id_fkey" FOREIGN KEY ("unit_of_measure_id") REFERENCES "master_data"."units_of_measure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitoring"."indicators" ADD CONSTRAINT "indicators_primary_data_source_id_fkey" FOREIGN KEY ("primary_data_source_id") REFERENCES "governance"."data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitoring"."indicator_disaggregations" ADD CONSTRAINT "indicator_disaggregations_indicator_id_fkey" FOREIGN KEY ("indicator_id") REFERENCES "monitoring"."indicators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitoring"."indicator_targets" ADD CONSTRAINT "indicator_targets_indicator_id_fkey" FOREIGN KEY ("indicator_id") REFERENCES "monitoring"."indicators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitoring"."indicator_targets" ADD CONSTRAINT "indicator_targets_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "master_data"."reporting_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitoring"."indicator_targets" ADD CONSTRAINT "indicator_targets_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "master_data"."districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitoring"."indicator_targets" ADD CONSTRAINT "indicator_targets_value_chain_id_fkey" FOREIGN KEY ("value_chain_id") REFERENCES "master_data"."value_chains"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitoring"."indicator_observations" ADD CONSTRAINT "indicator_observations_indicator_id_fkey" FOREIGN KEY ("indicator_id") REFERENCES "monitoring"."indicators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitoring"."indicator_observations" ADD CONSTRAINT "indicator_observations_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "master_data"."reporting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitoring"."indicator_observations" ADD CONSTRAINT "indicator_observations_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "master_data"."districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitoring"."indicator_observations" ADD CONSTRAINT "indicator_observations_value_chain_id_fkey" FOREIGN KEY ("value_chain_id") REFERENCES "master_data"."value_chains"("id") ON DELETE SET NULL ON UPDATE CASCADE;
