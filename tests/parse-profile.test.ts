import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { parseCsvBuffer, parseTable, parseXlsxBuffer } from "@/modules/ingestion/parse";
import { hashRow, profileTable } from "@/modules/ingestion/profile";

const CSV = `farmer_name,sex,district_name,cultivated_area,phone
Aminata Kamara,F,BO DISTRICT,1.5,+232 76 111222
Mohamed Sesay,M,Kenema,2,076111333
Aminata Kamara,F,BO DISTRICT,1.5,+232 76 111222
Fatmata Bangura,female,Port Loko,,076111444
`;

describe("CSV ingestion", () => {
  it("parses headers and rows, treating blanks as null", () => {
    const table = parseCsvBuffer(Buffer.from(CSV));
    expect(table.columns).toEqual(["farmer_name", "sex", "district_name", "cultivated_area", "phone"]);
    expect(table.rows).toHaveLength(4);
    expect(table.rows[3].cultivated_area).toBeNull();
  });

  it("makes duplicate headers unique so no column is lost", () => {
    const table = parseCsvBuffer(Buffer.from("name,name,name\na,b,c\n"));
    expect(table.columns).toEqual(["name", "name_2", "name_3"]);
    expect(table.rows[0]).toEqual({ name: "a", name_2: "b", name_3: "c" });
  });

  it("names unlabelled columns rather than dropping them", () => {
    const table = parseCsvBuffer(Buffer.from("a,,c\n1,2,3\n"));
    expect(table.columns).toEqual(["a", "column_2", "c"]);
  });
});

describe("XLSX ingestion", () => {
  it("parses the first worksheet", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Registry");
    sheet.addRow(["farmer_name", "district_name", "area"]);
    sheet.addRow(["Aminata Kamara", "Bo", 1.5]);
    sheet.addRow(["Mohamed Sesay", "Kenema", 2]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const table = await parseXlsxBuffer(buffer);
    expect(table.columns).toEqual(["farmer_name", "district_name", "area"]);
    expect(table.rows).toHaveLength(2);
    expect(table.rows[0].farmer_name).toBe("Aminata Kamara");

    const viaDispatch = await parseTable(buffer, "xlsx");
    expect(viaDispatch.rows).toHaveLength(2);
  });

  it("rejects unsupported file types", async () => {
    await expect(parseTable(Buffer.from("x"), "exe")).rejects.toThrow(/Unsupported file type/);
  });
});

describe("profiling", () => {
  const profile = profileTable(parseCsvBuffer(Buffer.from(CSV)));

  it("detects column types and completeness without modifying data", () => {
    const area = profile.columns.find((c) => c.name === "cultivated_area")!;
    expect(area.detectedType).toBe("number");
    expect(area.nullCount).toBe(1);
    expect(area.completenessPercent).toBe(75);
  });

  it("counts exact duplicate rows", () => {
    expect(profile.duplicateRowCount).toBe(1);
    expect(profile.duplicateRowNumbers).toEqual([3]);
  });

  it("hashes rows independently of key order and casing", () => {
    expect(hashRow({ a: "X", b: "y" })).toBe(hashRow({ b: " Y ", a: " x " }));
  });
});
