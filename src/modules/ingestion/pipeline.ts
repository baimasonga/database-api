import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { loadLookupContext } from "@/modules/mapping/lookups";
import { mapRow, validateMapping, type FieldMapping } from "@/modules/mapping/apply";
import { CANONICAL_FIELD_MAP, suggestCanonicalField } from "@/modules/mapping/canonical-fields";
import { BASELINE_RULES, ruleConfigSchema, type ValidationRuleDefinition } from "@/modules/quality/rules";
import { qualityScore, validateRows, type RowInput } from "@/modules/quality/engine";
import { hashRow, profileTable } from "./profile";
import { parseTable } from "./parse";
import { readStoredFile, storeUpload } from "./storage";
import { recordOnboardingEvent } from "@/modules/governance/onboarding-service";

export class DuplicateImportError extends Error {
  constructor(readonly existingImportJobId: string) {
    super("This exact file has already been imported for this dataset and reporting period.");
    this.name = "DuplicateImportError";
  }
}

export interface CreateImportInput {
  dataSourceId: string;
  datasetId: string;
  reportingPeriodId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  userId: string;
}

/**
 * Upload → store → profile → land in the raw layer. The uploaded file is
 * retained verbatim and the raw rows are never modified in place.
 */
export async function createImportJob(input: CreateImportInput): Promise<string> {
  const stored = await storeUpload(input.fileName, input.mimeType, input.buffer);

  // Idempotency: the same checksum for the same dataset+period is rejected.
  const existing = await prisma.importJob.findFirst({
    where: {
      datasetId: input.datasetId,
      reportingPeriodId: input.reportingPeriodId,
      file: { checksumSha256: stored.checksum },
      status: { notIn: ["failed", "rejected"] },
    },
    select: { id: true },
  });
  if (existing) throw new DuplicateImportError(existing.id);

  const table = await parseTable(input.buffer, stored.extension);
  const profile = profileTable(table);

  const dataset = await prisma.dataset.findUniqueOrThrow({ where: { id: input.datasetId } });

  return prisma.$transaction(async (tx) => {
    const file = await tx.importFile.create({
      data: {
        fileName: stored.fileName,
        storagePath: stored.storagePath,
        mimeType: input.mimeType || "application/octet-stream",
        extension: stored.extension,
        sizeBytes: stored.sizeBytes,
        checksumSha256: stored.checksum,
        rowCount: profile.rowCount,
        columnCount: profile.columnCount,
        uploadedBy: input.userId,
      },
    });

    const job = await tx.importJob.create({
      data: {
        dataSourceId: input.dataSourceId,
        datasetId: input.datasetId,
        reportingPeriodId: input.reportingPeriodId,
        importFileId: file.id,
        status: "mapping_required",
        rowCount: profile.rowCount,
        columnCount: profile.columnCount,
        duplicateRowCount: profile.duplicateRowCount,
        profile: profile as unknown as Prisma.InputJsonValue,
        startedAt: new Date(),
        createdBy: input.userId,
      },
    });

    if (table.rows.length > 0) {
      await tx.importRow.createMany({
        data: table.rows.map((row, index) => ({
          importJobId: job.id,
          rowNumber: index + 1,
          rawData: row as Prisma.InputJsonValue,
          rowHash: hashRow(row),
          isDuplicate: profile.duplicateRowNumbers.includes(index + 1),
        })),
      });
    }

    // Seed the mapping grid, reusing an active template for this dataset when
    // one exists and falling back to name-based suggestions.
    const template = await tx.mappingTemplate.findFirst({
      where: { datasetId: dataset.id, isActive: true },
      include: { fields: true },
      orderBy: { updatedAt: "desc" },
    });
    const templateByColumn = new Map(
      (template?.fields ?? []).map((f) => [f.sourceColumn.trim().toLowerCase(), f]),
    );

    await tx.importFieldMapping.createMany({
      data: profile.columns.map((column) => {
        const fromTemplate = templateByColumn.get(column.name.trim().toLowerCase());
        const canonicalField = fromTemplate?.canonicalField ?? suggestCanonicalField(column.name);
        return {
          importJobId: job.id,
          sourceColumn: column.name,
          canonicalField,
          detectedType: column.detectedType,
          sampleValues: column.sampleValues as Prisma.InputJsonValue,
          isRequired: fromTemplate?.isRequired ?? (canonicalField ? (CANONICAL_FIELD_MAP.get(canonicalField)?.required ?? false) : false),
          transformations: (fromTemplate?.transformations ?? []) as Prisma.InputJsonValue,
          status: canonicalField ? (fromTemplate ? "mapped" : "suggested") : "unmapped",
        };
      }),
    });

    await tx.dataSource.update({
      where: { id: input.dataSourceId },
      data: { lastReceivedAt: new Date() },
    });

    // The schema is now known, so the dataset is at least "assessed".
    await recordOnboardingEvent(input.datasetId, "profiled", tx);

    return job.id;
  });
}

async function resolveRules(datasetId: string): Promise<ValidationRuleDefinition[]> {
  const stored = await prisma.validationRule.findMany({
    where: { isActive: true, OR: [{ datasetId }, { datasetId: null }] },
  });
  const custom = stored.flatMap((rule) => {
    const config = ruleConfigSchema.safeParse(rule.config);
    if (!config.success) return [];
    return [
      {
        code: rule.code,
        name: rule.name,
        description: rule.description ?? undefined,
        category: rule.category,
        severity: rule.severity,
        fieldName: rule.fieldName ?? undefined,
        config: config.data,
      } satisfies ValidationRuleDefinition,
    ];
  });
  const customCodes = new Set(custom.map((r) => r.code));
  return [...BASELINE_RULES.filter((r) => !customCodes.has(r.code)), ...custom];
}

export interface ValidationOutcome {
  status: "ready_for_review" | "validation_failed" | "mapping_required";
  errorCount: number;
  warningCount: number;
  validRows: number;
  qualityScore: number;
  mappingIssues?: string[];
}

/**
 * Maps and validates every raw row, persisting both the canonical projection
 * and every finding. Nothing is silently discarded or corrected.
 */
export async function runValidation(importJobId: string): Promise<ValidationOutcome> {
  const job = await prisma.importJob.findUniqueOrThrow({
    where: { id: importJobId },
    include: { fieldMappings: true, reportingPeriod: true, dataset: true },
  });

  const mappings: FieldMapping[] = job.fieldMappings.map((m) => ({
    sourceColumn: m.sourceColumn,
    canonicalField: m.canonicalField,
    isRequired: m.isRequired,
    transformations: m.transformations,
  }));

  const requiredFields = job.fieldMappings.filter((m) => m.isRequired && m.canonicalField).map((m) => m.canonicalField!);
  const mappingCheck = validateMapping(mappings, requiredFields);
  if (!mappingCheck.valid) {
    const issues = [
      ...mappingCheck.missingRequired.map((f) => `Required field not mapped: ${f}`),
      ...mappingCheck.duplicateTargets.map((f) => `Canonical field mapped more than once: ${f}`),
      ...mappingCheck.unknownFields.map((f) => `Unknown canonical field: ${f}`),
    ];
    await prisma.importJob.update({
      where: { id: importJobId },
      data: { status: "mapping_required", statusMessage: issues.join("; ") },
    });
    return { status: "mapping_required", errorCount: 0, warningCount: 0, validRows: 0, qualityScore: 0, mappingIssues: issues };
  }

  await prisma.importJob.update({ where: { id: importJobId }, data: { status: "validating" } });

  const { lookups, referenceSets } = await loadLookupContext();
  const rawRows = await prisma.importRow.findMany({
    where: { importJobId },
    orderBy: { rowNumber: "asc" },
  });

  const rowInputs: RowInput[] = rawRows.map((row) => ({
    rowNumber: row.rowNumber,
    raw: row.rawData as Record<string, string | null>,
    mapped: mapRow(row.rawData as Record<string, string | null>, mappings, lookups),
  }));

  const rules = await resolveRules(job.datasetId);
  const report = validateRows(rowInputs, rules, {
    referenceSets,
    reportingPeriod: {
      code: job.reportingPeriod.code,
      startDate: job.reportingPeriod.startDate.toISOString().slice(0, 10),
      endDate: job.reportingPeriod.endDate.toISOString().slice(0, 10),
    },
    duplicateRowNumbers: new Set(rawRows.filter((r) => r.isDuplicate).map((r) => r.rowNumber)),
  });

  const rowIdByNumber = new Map(rawRows.map((r) => [r.rowNumber, r.id]));
  const score = qualityScore(report);
  const status = report.rowsWithErrors > 0 ? "validation_failed" : "ready_for_review";

  await prisma.$transaction(async (tx) => {
    // Re-validation replaces the previous unresolved findings but keeps the
    // mapped projection traceable to the same raw rows.
    await tx.validationResult.deleteMany({ where: { importJobId, resolved: false } });

    for (const row of rowInputs) {
      await tx.importRow.update({
        where: { id: rowIdByNumber.get(row.rowNumber)! },
        data: {
          mappedData: row.mapped.values as Prisma.InputJsonValue,
          isValid: !report.errorRowNumbers.has(row.rowNumber),
          hasWarnings: report.warningRowNumbers.has(row.rowNumber),
        },
      });
    }

    if (report.findings.length > 0) {
      await tx.validationResult.createMany({
        data: report.findings.map((f) => ({
          importJobId,
          importRowId: rowIdByNumber.get(f.rowNumber) ?? null,
          rowNumber: f.rowNumber,
          fieldName: f.fieldName,
          ruleCode: f.ruleCode,
          category: f.category,
          severity: f.severity,
          message: f.message,
          rawValue: f.rawValue,
          suggestedValue: f.suggestedValue,
        })),
      });
    }

    await tx.importJob.update({
      where: { id: importJobId },
      data: {
        status,
        validRowCount: report.validRows,
        errorRowCount: report.rowsWithErrors,
        warningRowCount: report.rowsWithWarnings,
        duplicateRowCount: report.duplicateRows,
        qualityScore: new Prisma.Decimal(score),
        statusMessage: null,
        completedAt: new Date(),
      },
    });
  });

  // Mapping was complete enough to validate, and validation has now run.
  await recordOnboardingEvent(job.datasetId, "mapped");
  await recordOnboardingEvent(job.datasetId, "validation_run");
  if (status === "ready_for_review") {
    await recordOnboardingEvent(job.datasetId, "validation_clean");
  }

  return {
    status,
    errorCount: report.findings.filter((f) => f.severity === "error").length,
    warningCount: report.findings.filter((f) => f.severity === "warning").length,
    validRows: report.validRows,
    qualityScore: score,
  };
}

export async function readImportFile(importJobId: string): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
  const job = await prisma.importJob.findUniqueOrThrow({ where: { id: importJobId }, include: { file: true } });
  if (!job.file) throw new Error("This import job has no associated file.");
  return {
    buffer: await readStoredFile(job.file.storagePath),
    fileName: job.file.fileName,
    mimeType: job.file.mimeType,
  };
}
