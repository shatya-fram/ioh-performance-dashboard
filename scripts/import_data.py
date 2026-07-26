#!/usr/bin/env python3
"""
IOH Performance Dashboard — Data Import Utility
================================================
Imports Excel data files into the MySQL database.

Supported file types:
  - KPI Performance (MTD/FM)
  - VLR Kecamatan data
  - SOGA/DMS weekly data
  - Product data

Usage:
  python3 scripts/import_data.py --file data/kpi_july2026.xlsx --type kpi
  python3 scripts/import_data.py --file data/vlr_kecamatan.xlsx --type vlr
  python3 scripts/import_data.py --file data/soga_w26.xlsx --type soga --brand IM3 --week W26
  python3 scripts/import_data.py --file data/product_july.xlsx --type product

Requirements:
  pip install pandas openpyxl pymysql python-dotenv
"""

import os
import sys
import argparse
import time
import logging
from pathlib import Path

# ─── Setup ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
log = logging.getLogger(__name__)

try:
    import pandas as pd
    import pymysql
    from dotenv import load_dotenv
except ImportError as e:
    log.error(f"Missing dependency: {e}")
    log.error("Run: pip install pandas openpyxl pymysql python-dotenv")
    sys.exit(1)

# Load .env file
load_dotenv(Path(__file__).parent.parent / ".env")
load_dotenv(Path(__file__).parent.parent / ".env.local")


# ─── Database Connection ──────────────────────────────────────────────────────
def get_connection():
    """Parse DATABASE_URL and return a pymysql connection."""
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        raise ValueError("DATABASE_URL environment variable not set")

    # Parse mysql://user:pass@host:port/dbname
    import re
    m = re.match(r"mysql://([^:]+):([^@]+)@([^:/]+):?(\d+)?/(\S+)", url)
    if not m:
        raise ValueError(f"Cannot parse DATABASE_URL: {url}")

    user, password, host, port, database = m.groups()
    port = int(port) if port else 3306
    database = database.split("?")[0]

    log.info(f"Connecting to MySQL: {host}:{port}/{database}")
    return pymysql.connect(
        host=host, port=port, user=user, password=password,
        database=database, charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor
    )


# ─── Import Functions ─────────────────────────────────────────────────────────
def import_kpi(conn, df: pd.DataFrame, data_date: str):
    """Import KPI performance data (MTD/FM)."""
    now = int(time.time() * 1000)
    inserted = 0

    with conn.cursor() as cur:
        for _, row in df.iterrows():
            brand = str(row.get("brand", row.get("Brand", "IOH"))).strip().upper()
            area = str(row.get("area", row.get("Area", ""))).strip()
            location = str(row.get("location", row.get("Location", ""))).strip()
            channel = str(row.get("channel", row.get("Channel", ""))).strip()

            def v(col_variants):
                for c in col_variants:
                    if c in row and pd.notna(row[c]):
                        return float(row[c])
                return None

            cur.execute("""
                INSERT INTO fm_raw
                  (data_date, brand, area, location, channel,
                   revenue, acq_revenue, base_revenue, vlr, gross_add,
                   pack_pu, arpu, rgu90d, created_at, updated_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON DUPLICATE KEY UPDATE
                  revenue=VALUES(revenue), updated_at=VALUES(updated_at)
            """, (
                data_date, brand, area, location, channel,
                v(["revenue_mtd","Revenue MTD","revenue"]),
                v(["acq_revenue_mtd","Acq Revenue MTD","acq_revenue"]),
                v(["base_revenue_mtd","Base Revenue MTD","base_revenue"]),
                v(["vlr_mtd","VLR MTD","vlr"]),
                v(["gross_add_mtd","Gross Add MTD","gross_add"]),
                v(["pack_pu_mtd","Pack PU MTD","pack_pu"]),
                v(["arpu_mtd","ARPU MTD","arpu"]),
                v(["rgu90d_mtd","RGU 90D MTD","rgu90d"]),
                now, now
            ))
            inserted += 1

    conn.commit()
    log.info(f"✅ KPI: inserted/updated {inserted} rows for {data_date}")


def import_vlr_kecamatan(conn, df: pd.DataFrame, data_date: str):
    """Import VLR kecamatan-level data."""
    now = int(time.time() * 1000)
    inserted = 0

    with conn.cursor() as cur:
        for _, row in df.iterrows():
            kecamatan = str(row.get("kecamatan", row.get("Kecamatan", ""))).strip()
            if not kecamatan:
                continue
            brand = str(row.get("brand", row.get("Brand", "IOH"))).strip().upper()

            def v(col_variants):
                for c in col_variants:
                    if c in row and pd.notna(row[c]):
                        return float(row[c])
                return None

            cur.execute("""
                INSERT INTO vlr_kecamatan
                  (data_date, kecamatan, area, brand,
                   vlr_mtd, vlr_lmtd, vlr_gap, vlr_rate, mom_growth,
                   latitude, longitude, created_at, updated_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON DUPLICATE KEY UPDATE
                  vlr_mtd=VALUES(vlr_mtd), vlr_lmtd=VALUES(vlr_lmtd),
                  vlr_gap=VALUES(vlr_gap), vlr_rate=VALUES(vlr_rate),
                  updated_at=VALUES(updated_at)
            """, (
                data_date, kecamatan,
                str(row.get("area", row.get("Area", ""))).strip(),
                brand,
                v(["vlr_mtd","VLR MTD","VLR"]),
                v(["vlr_lmtd","VLR LMTD"]),
                v(["vlr_gap","VLR Gap","Gap"]),
                v(["vlr_rate","VLR Rate","Rate"]),
                v(["mom_growth","MoM Growth","Growth"]),
                v(["latitude","Latitude","lat"]),
                v(["longitude","Longitude","lng","lon"]),
                now, now
            ))
            inserted += 1

    conn.commit()
    log.info(f"✅ VLR Kecamatan: inserted/updated {inserted} rows for {data_date}")


def import_soga_dms(conn, df: pd.DataFrame, brand: str, week_label: str, metric_type: str):
    """Import SOGA or DMS weekly kecamatan data."""
    now = int(time.time() * 1000)
    inserted = 0
    brand = brand.strip().upper()
    metric_type = metric_type.strip().upper()

    with conn.cursor() as cur:
        for _, row in df.iterrows():
            kecamatan = str(row.get("kecamatan", row.get("Kecamatan", ""))).strip()
            if not kecamatan:
                continue

            # Try to find the value column
            value = None
            for col in [metric_type, metric_type.lower(), "value", "Value", "pct", "%"]:
                if col in row and pd.notna(row[col]):
                    value = float(row[col])
                    # Convert percentage if > 1 (assume it's 0-100 scale)
                    if value > 1:
                        value = value / 100
                    break

            cur.execute("""
                INSERT INTO soga_dms_weekly
                  (week_label, kecamatan, brand, metric_type, value, created_at, updated_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s)
                ON DUPLICATE KEY UPDATE
                  value=VALUES(value), updated_at=VALUES(updated_at)
            """, (week_label, kecamatan, brand, metric_type, value, now, now))
            inserted += 1

    conn.commit()
    log.info(f"✅ SOGA/DMS: inserted/updated {inserted} rows — {brand} {metric_type} {week_label}")


def import_product(conn, df: pd.DataFrame, data_date: str):
    """Import product performance data."""
    now = int(time.time() * 1000)
    inserted = 0

    with conn.cursor() as cur:
        for _, row in df.iterrows():
            product_name = str(row.get("product_name", row.get("Product", row.get("Pack", "")))).strip()
            if not product_name:
                continue

            def v(col_variants):
                for c in col_variants:
                    if c in row and pd.notna(row[c]):
                        return float(row[c])
                return None

            cur.execute("""
                INSERT INTO product_data
                  (data_date, brand, product_name, category, channel,
                   hits_mtd, hits_lmtd, revenue_mtd, revenue_lmtd, ticket_size,
                   created_at, updated_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON DUPLICATE KEY UPDATE
                  hits_mtd=VALUES(hits_mtd), revenue_mtd=VALUES(revenue_mtd),
                  updated_at=VALUES(updated_at)
            """, (
                data_date,
                str(row.get("brand", row.get("Brand", "IOH"))).strip().upper(),
                product_name,
                str(row.get("category", row.get("Category", ""))).strip(),
                str(row.get("channel", row.get("Channel", ""))).strip(),
                v(["hits_mtd","Hits MTD","Hits"]),
                v(["hits_lmtd","Hits LMTD"]),
                v(["revenue_mtd","Revenue MTD","Revenue"]),
                v(["revenue_lmtd","Revenue LMTD"]),
                v(["ticket_size","Ticket Size","Price"]),
                now, now
            ))
            inserted += 1

    conn.commit()
    log.info(f"✅ Product: inserted/updated {inserted} rows for {data_date}")


# ─── CLI ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="IOH Dashboard — Excel Data Importer",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 scripts/import_data.py --file data/kpi_july2026.xlsx --type kpi --date 2026-07-11
  python3 scripts/import_data.py --file data/vlr_kecamatan.xlsx --type vlr --date 2026-07-11
  python3 scripts/import_data.py --file data/soga_w26.xlsx --type soga --brand IM3 --week W26 --metric SOGA
  python3 scripts/import_data.py --file data/product_july.xlsx --type product --date 2026-07-11
        """
    )
    parser.add_argument("--file", required=True, help="Path to Excel file (.xlsx)")
    parser.add_argument("--type", required=True,
                        choices=["kpi", "vlr", "soga", "product"],
                        help="Type of data to import")
    parser.add_argument("--date", default=None,
                        help="Data date (YYYY-MM-DD). Defaults to today.")
    parser.add_argument("--brand", default="IOH",
                        help="Brand (IM3, 3ID, IOH). Used for soga/dms imports.")
    parser.add_argument("--week", default=None,
                        help="Week label (e.g. W26). Used for soga/dms imports.")
    parser.add_argument("--metric", default="SOGA",
                        choices=["SOGA", "DMS"],
                        help="Metric type for soga/dms imports.")
    parser.add_argument("--sheet", default=0,
                        help="Sheet name or index (default: first sheet)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Parse file but do not write to database")

    args = parser.parse_args()

    # Validate file
    filepath = Path(args.file)
    if not filepath.exists():
        log.error(f"File not found: {filepath}")
        sys.exit(1)

    # Default date
    from datetime import date
    data_date = args.date or date.today().isoformat()

    # Load Excel
    log.info(f"Loading {filepath} (sheet: {args.sheet})...")
    try:
        sheet = int(args.sheet) if str(args.sheet).isdigit() else args.sheet
        df = pd.read_excel(filepath, sheet_name=sheet)
    except Exception as e:
        log.error(f"Failed to read Excel file: {e}")
        sys.exit(1)

    log.info(f"Loaded {len(df)} rows, {len(df.columns)} columns")
    log.info(f"Columns: {list(df.columns)}")

    if args.dry_run:
        log.info("DRY RUN — no data written to database")
        print(df.head(5).to_string())
        return

    # Connect and import
    try:
        conn = get_connection()
    except Exception as e:
        log.error(f"Database connection failed: {e}")
        sys.exit(1)

    try:
        if args.type == "kpi":
            import_kpi(conn, df, data_date)
        elif args.type == "vlr":
            import_vlr_kecamatan(conn, df, data_date)
        elif args.type == "soga":
            if not args.week:
                log.error("--week is required for soga/dms imports (e.g. --week W26)")
                sys.exit(1)
            import_soga_dms(conn, df, args.brand, args.week, args.metric)
        elif args.type == "product":
            import_product(conn, df, data_date)
    except Exception as e:
        log.error(f"Import failed: {e}")
        conn.rollback()
        sys.exit(1)
    finally:
        conn.close()

    log.info("Import complete!")


if __name__ == "__main__":
    main()
