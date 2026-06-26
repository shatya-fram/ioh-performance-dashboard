// Load LMTD product data (May 2026) into product_mtd_raw
import { createConnection } from "mysql2/promise";
import ExcelJS from "exceljs";
import { readFileSync } from "fs";

// Read DATABASE_URL from the injected env (set by the dev server runtime)
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL not set");

// Parse mysql://user:pass@host:port/dbname?...
const m = dbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:/]+):(\d+)\/([^?]+)/);
if (!m) throw new Error("Cannot parse DATABASE_URL: " + dbUrl.slice(0, 40));
const [, user, password, host, portStr, dbname] = m;
const port = parseInt(portStr);

console.log(`Connecting to ${host}:${port}/${dbname}`);
const conn = await createConnection({
  host, port, user, password,
  database: dbname.split("?")[0],
  ssl: { rejectUnauthorized: false },
  multipleStatements: false,
});

const INSERT_SQL = `
INSERT INTO product_mtd_raw
  (yearMonth,brand,areaRegion,areaBranch,areaKabkot,channelGroup,channelDetail,
   productFamily,productGroup,atlBtl,atlBtlDetail,tenure,merchant,kpi,rev)
VALUES ?
`;

const FILES = [
  "/home/ubuntu/upload/ProductIM3LMTD24Jun2026.xlsx",
  "/home/ubuntu/upload/Product3IDLMTD24Jun2026.xlsx",
];

const BATCH = 2000;
let totalInserted = 0;

for (const fpath of FILES) {
  console.log(`\nLoading ${fpath.split("/").pop()} ...`);
  const wb = new ExcelJS.stream.xlsx.WorkbookReader(fpath, { sharedStrings: "cache" });

  let headers = null;
  let ci = {};
  let batch = [];
  let skipped = 0;
  let rowNum = 0;

  await new Promise((resolve, reject) => {
    wb.on("worksheet", (ws) => {
      ws.on("row", (row) => {
        rowNum++;
        const vals = row.values.slice(1); // ExcelJS row.values is 1-indexed, slice off index 0
        if (rowNum === 1) {
          headers = vals.map(v => (v == null ? "" : String(v)));
          headers.forEach((h, i) => { ci[h] = i; });
          return;
        }

        const brand = vals[ci["Brand"] ?? 1];
        const kpi = vals[ci["KPI"] ?? 25];
        if (!brand || !kpi) { skipped++; return; }

        const yearMonth = vals[ci["YearMonth"] ?? 0] != null ? String(vals[ci["YearMonth"] ?? 0]) : null;
        const areaRegion = vals[ci["Area-Region"] ?? 3] ?? null;
        const areaBranch = vals[ci["Area-Branch"] ?? 4] ?? null;
        const areaKabkot = vals[ci["Area-Kabkot"] ?? 5] ?? null;
        const channelGroup = vals[ci["Svc Type-Channel Group"] ?? 14] ?? null;
        const channelDetail = vals[ci["Svc Type-Channel Detail"] ?? 15] ?? null;
        const productFamily = vals[ci["Product-Family"] ?? 16] ?? null;
        const productGroup = vals[ci["Product-Group"] ?? 17] ?? null;
        const atlBtl = vals[ci["ATL/BTL"] ?? 20] ?? null;
        const atlBtlDetail = vals[ci["ATL/BTL DETAILS"] ?? 21] ?? null;
        const tenure = vals[ci["TENURE - ADD (FOR DATA OLY)"] ?? 23] ?? null;
        const merchant = vals[ci["MERCHANT FOR DD - ADD (FOR DATA ONLY)"] ?? 24] ?? null;
        const revRaw = vals[ci["REV"] ?? 31];
        const rev = revRaw != null ? Math.round(Number(revRaw)) : null;

        batch.push([yearMonth, String(brand), areaRegion, areaBranch, areaKabkot,
          channelGroup, channelDetail, productFamily, productGroup,
          atlBtl, atlBtlDetail, tenure, merchant, String(kpi), rev]);
      });

      ws.on("end", resolve);
      ws.on("error", reject);
    });

    wb.on("error", reject);
    wb.read();
  });

  // Insert remaining batch
  if (batch.length > 0) {
    for (let i = 0; i < batch.length; i += BATCH) {
      const chunk = batch.slice(i, i + BATCH);
      await conn.query(INSERT_SQL, [chunk]);
      totalInserted += chunk.length;
      process.stdout.write(`\r  Inserted ${totalInserted} rows...`);
    }
  }

  console.log(`\n  Done. Skipped ${skipped} rows with null brand/kpi.`);
}

await conn.end();
console.log(`\nTotal LMTD rows inserted: ${totalInserted}`);
