/**
 * Permission catalogue. Roles are database rows, not hard-coded strings —
 * these constants only name the capabilities that code checks against, so an
 * administrator can create new roles without a deployment.
 */
export const PERMISSIONS = {
  SOURCE_READ: "source.read",
  SOURCE_WRITE: "source.write",
  SOURCE_ARCHIVE: "source.archive",
  DATASET_READ: "dataset.read",
  DATASET_WRITE: "dataset.write",
  IMPORT_READ: "import.read",
  IMPORT_WRITE: "import.write",
  MAPPING_READ: "mapping.read",
  MAPPING_WRITE: "mapping.write",
  QUALITY_READ: "quality.read",
  QUALITY_RESOLVE: "quality.resolve",
  BENEFICIARY_READ: "beneficiary.read",
  BENEFICIARY_MERGE: "beneficiary.merge",
  INDICATOR_READ: "indicator.read",
  INDICATOR_WRITE: "indicator.write",
  APPROVAL_SUBMIT: "approval.submit",
  APPROVAL_REVIEW: "approval.review",
  APPROVAL_DECIDE: "approval.decide",
  PUBLICATION_MANAGE: "publication.manage",
  ANALYTICS_REFRESH: "analytics.refresh",
  INTEGRATION_READ: "integration.read",
  INTEGRATION_WRITE: "integration.write",
  INTEGRATION_RUN: "integration.run",
  AUDIT_READ: "audit.read",
  ADMIN_MANAGE: "admin.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Default role definitions, seeded once and editable thereafter. */
export const DEFAULT_ROLES: Array<{
  code: string;
  name: string;
  description: string;
  permissions: Permission[];
}> = [
  {
    code: "data_contributor",
    name: "Data Contributor",
    description: "Uploads and maps datasets, submits them for review.",
    permissions: [
      PERMISSIONS.SOURCE_READ,
      PERMISSIONS.DATASET_READ,
      PERMISSIONS.IMPORT_READ,
      PERMISSIONS.IMPORT_WRITE,
      PERMISSIONS.MAPPING_READ,
      PERMISSIONS.MAPPING_WRITE,
      PERMISSIONS.QUALITY_READ,
      PERMISSIONS.INDICATOR_READ,
      PERMISSIONS.APPROVAL_SUBMIT,
    ],
  },
  {
    code: "data_reviewer",
    name: "Data Reviewer",
    description: "Reviews data quality issues and returns datasets for correction.",
    permissions: [
      PERMISSIONS.SOURCE_READ,
      PERMISSIONS.DATASET_READ,
      PERMISSIONS.IMPORT_READ,
      PERMISSIONS.MAPPING_READ,
      PERMISSIONS.QUALITY_READ,
      PERMISSIONS.QUALITY_RESOLVE,
      PERMISSIONS.BENEFICIARY_READ,
      PERMISSIONS.BENEFICIARY_MERGE,
      PERMISSIONS.INDICATOR_READ,
      PERMISSIONS.APPROVAL_REVIEW,
    ],
  },
  {
    code: "me_approver",
    name: "M&E Approver",
    description: "Approves and publishes validated datasets, manages indicators.",
    permissions: [
      PERMISSIONS.SOURCE_READ,
      PERMISSIONS.SOURCE_WRITE,
      PERMISSIONS.DATASET_READ,
      PERMISSIONS.DATASET_WRITE,
      PERMISSIONS.IMPORT_READ,
      PERMISSIONS.MAPPING_READ,
      PERMISSIONS.QUALITY_READ,
      PERMISSIONS.QUALITY_RESOLVE,
      PERMISSIONS.BENEFICIARY_READ,
      PERMISSIONS.BENEFICIARY_MERGE,
      PERMISSIONS.INDICATOR_READ,
      PERMISSIONS.INDICATOR_WRITE,
      PERMISSIONS.APPROVAL_REVIEW,
      PERMISSIONS.APPROVAL_DECIDE,
      PERMISSIONS.PUBLICATION_MANAGE,
      PERMISSIONS.ANALYTICS_REFRESH,
      PERMISSIONS.AUDIT_READ,
    ],
  },
  {
    code: "administrator",
    name: "Administrator",
    description: "Full access to the AVDP Data Manager.",
    permissions: Object.values(PERMISSIONS),
  },
];
