import { BadRequestException, Injectable } from "@nestjs/common";
import { readSheet } from "read-excel-file/node";
import writeXlsxFile, { type SheetData } from "write-excel-file/node";

import { bodyObject, optionalString, stringField } from "../utils/payload";

export type ExcelSheet = {
  name: string;
  headers: string[];
  rows: Array<Record<string, unknown>>;
};

export type ExcelFileResponse = {
  fileName: string;
  contentType: string;
  contentBase64: string;
};

const EXCEL_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

@Injectable()
export class ExcelService {
  async rowsFromBase64(
    rawBody: unknown,
  ): Promise<Array<Record<string, unknown>>> {
    const body = bodyObject(rawBody);
    const buffer = this.bufferFromBase64(stringField(body, "contentBase64"));
    const sheetName = optionalString(body, "sheetName");
    const sheetData = sheetName
      ? await readSheet(buffer, sheetName)
      : await readSheet(buffer);
    const headerRow = sheetData[0] ?? [];
    const headers = headerRow.map((cell) => String(cell ?? "").trim());
    if (!headers.some(Boolean)) {
      throw new BadRequestException("Excel header row is required.");
    }

    return sheetData.slice(1).map((row) => {
      const record: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        if (header) {
          record[header] = row[index] ?? "";
        }
      });
      return record;
    });
  }

  async createWorkbook(
    fileName: string,
    sheets: ExcelSheet[],
  ): Promise<ExcelFileResponse> {
    if (!sheets.length) {
      throw new BadRequestException("At least one Excel sheet is required.");
    }

    const output = await writeXlsxFile(
      sheets.map((sheet) => ({
        sheet: this.safeSheetName(sheet.name),
        data: this.sheetData(sheet),
        stickyRowsCount: 1,
      })),
    ).toBuffer();
    const buffer = Buffer.isBuffer(output) ? output : Buffer.from(output);

    return {
      fileName,
      contentType: EXCEL_CONTENT_TYPE,
      contentBase64: buffer.toString("base64"),
    };
  }

  private bufferFromBase64(contentBase64: string) {
    const normalized = contentBase64.includes(",")
      ? contentBase64.split(",").at(-1)
      : contentBase64;
    if (!normalized) {
      throw new BadRequestException("contentBase64 is required.");
    }

    const buffer = Buffer.from(normalized, "base64");
    if (!buffer.length) {
      throw new BadRequestException("Invalid Excel file content.");
    }

    return buffer;
  }

  private sheetData(sheet: ExcelSheet): SheetData {
    return [
      sheet.headers.map((header) => ({
        value: header,
        fontWeight: "bold" as const,
      })),
      ...sheet.rows.map((row) =>
        sheet.headers.map((header) => row[header] ?? null),
      ),
    ];
  }

  private safeSheetName(name: string) {
    return name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Sheet1";
  }
}
