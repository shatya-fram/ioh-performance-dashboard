/**
 * Load ProductIM3 and Product3ID Excel files into product_mtd_raw table.
 * Run: node load_product_data.mjs
 */
import { config } from "dotenv";
config();

import { readFileSync } from "fs";
import { createConnection } from "mysql2/promise";
import ExcelJS from "exceljs";

const DB_URL = process.env.DATABASE_URL || "";
// parse mysql://user:pass@host:port/dbname
const urlObj = new URL(DB_URL.replace('mysql://', 'http://'));
const user = urlObj.username;
const pass = urlObj.password;
const host = urlObj.hostname;
const port = parseInt(urlObj.port) || 3306;
const database = urlObj.pathname.replace(/^\//, '').split('?')[0];

const conn = await createConnection({
  host,
  port,
  user,
  password: pass,
  database,
  ssl: { rejectUnauthorized: false },
});

console.log("Connected to DB");

// Clear existing data
await conn.execute("DELETE FROM product_mtd_raw");
console.log("Cleared existing product_mtd_raw data");

const INSERT_SQL = `
INSERT INTO product_mtd_raw
  (yearMonth, brand, areaRegion, areaBranch, areaKabkot,
   channelGroup, channelDetail, productFamily, productGroup,
   atlBtl, atlBtlDetail, tenure, merchant, kpi, rev)
VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`;

const files = [
  "/home/ubuntu/upload/ProductIM3MTD24Jun2026.xlsx",
  "/home/ubuntu/upload/Product3IDMTD24Jun2026.xlsx",
];

let grandTotal = 0;

for (const fpath of files) {
  const fname = fpath.split("/").pop();
  console.log(`Loading ${fname}...`);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(fpath);
  const ws = wb.getWorksheet("Export");

  // Build column index from header row
  const headerRow = ws.getRow(1);
  const ci = {};
  headerRow.eachCell((cell, colNum) => {
    if (cell.value) ci[String(cell.value).trim()] = colNum;
  });

  // Find merchant column (has trailing newline)
  const merchantKey = Object.keys(ci).find((k) => k.includes("MERCHANT"));

  const batch = [];
  let count = 0;

  const flushBatch = async () => {
    if (batch.length === 0) return;
    await conn.query(INSERT_SQL + " , (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)".repeat(batch.length - 1).replace(" , ", ""), batch.flat());
    batch.length = 0;
  };

  // Use a simpler approach: build all values and insert in chunks
  const allRows = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
    if (rowNum === 1) return; // skip header
    const g = (colName) => {
      const idx = ci[colName];
      if (!idx) return null;
      const v = row.getCell(idx).value;
      if (v === null || v === undefined) return null;
      return String(v).trim() || null;
    };

    const revCell = row.getCell(ci["REV"] || 32);
    let revVal = revCell.value;
    let revInt = null;
    if (revVal !== null && revVal !== undefined) {
      try { revInt = Math.round(parseFloat(String(revVal))); } catch {}
    }

    const merchantVal = merchantKey ? (() => {
      const v = row.getCell(ci[merchantKey]).value;
      return v ? String(v).trim() || null : null;
    })() : null;

    const yearMonth = g("YearMonth");
    const brand = g("Brand");
    const kpi = g("KPI");
    if (!brand || !kpi || !yearMonth) return; // skip invalid rows
    allRows.push([
      yearMonth,
      brand,
      g("Area-Region"),
      g("Area-Branch"),
      g("Area-Kabkot"),
      g("Svc Type-Channel Group"),
      g("Svc Type-Channel Detail"),
      g("Product-Family"),
      g("Product-Group"),
      g("ATL/BTL"),
      g("ATL/BTL DETAILS"),
      g("TENURE - ADD (FOR DATA OLY)"),
      merchantVal,
      kpi,
      revInt,
    ]);
  });

  console.log(`  Parsed ${allRows.length} rows, inserting in chunks...`);

  const CHUNK = 500;
  for (let i = 0; i < allRows.length; i += CHUNK) {
    const chunk = allRows.slice(i, i + CHUNK);
    const placeholders = chunk.map(() => "(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").join(",");
    await conn.query(`INSERT INTO product_mtd_raw (yearMonth,brand,areaRegion,areaBranch,areaKabkot,channelGroup,channelDetail,productFamily,productGroup,atlBtl,atlBtlDetail,tenure,merchant,kpi,rev) VALUES ${placeholders}`, chunk.flat());
    if ((i + CHUNK) % 10000 === 0) console.log(`  ${i + CHUNK} rows inserted...`);
  }

  grandTotal += allRows.length;
  console.log(`  Done: ${allRows.length} rows from ${fname}`);
}

console.log(`\nTotal rows loaded: ${grandTotal}`);
await conn.end();
process.exit(0);
