#!/usr/bin/env python3
"""
IOH Performance Dashboard — Database Export Utility
====================================================
Exports the MySQL database to a SQL dump file or Excel files.

Usage:
  python3 scripts/export_db.py --format sql          # full SQL dump
  python3 scripts/export_db.py --format excel        # all tables as Excel sheets
  python3 scripts/export_db.py --format sql --table kpi_performance

Requirements:
  pip install pandas openpyxl pymysql python-dotenv
"""

import os
import sys
import argparse
import subprocess
import time
import logging
from pathlib import Path
from datetime import datetime

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

try:
    import pandas as pd
    import pymysql
    from dotenv import load_dotenv
except ImportError as e:
    log.error(f"Missing dependency: {e}")
    log.error("Run: pip install pandas openpyxl pymysql python-dotenv")
    sys.exit(1)

load_dotenv(Path(__file__).parent.parent / ".env")
load_dotenv(Path(__file__).parent.parent / ".env.local")


def parse_db_url():
    import re
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        raise ValueError("DATABASE_URL not set")
    m = re.match(r"mysql://([^:]+):([^@]+)@([^:/]+):?(\d+)?/(\S+)", url)
    if not m:
        raise ValueError(f"Cannot parse DATABASE_URL: {url}")
    user, password, host, port, database = m.groups()
    return {
        "user": user, "password": password,
        "host": host, "port": int(port or 3306),
        "database": database.split("?")[0]
    }


def get_connection(db):
    return pymysql.connect(
        host=db["host"], port=db["port"],
        user=db["user"], password=db["password"],
        database=db["database"], charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor
    )


def export_sql(db, output_dir: Path, table: str = None):
    """Export database as SQL dump using mysqldump."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"ioh_dashboard_{timestamp}.sql"
    output_path = output_dir / filename

    cmd = [
        "mysqldump",
        f"-h{db['host']}", f"-P{db['port']}",
        f"-u{db['user']}", f"-p{db['password']}",
        "--single-transaction", "--routines",
        "--set-gtid-purged=OFF",
        db["database"]
    ]
    if table:
        cmd.append(table)

    log.info(f"Running mysqldump → {output_path}")
    try:
        with open(output_path, "w") as f:
            result = subprocess.run(cmd, stdout=f, stderr=subprocess.PIPE, text=True)
        if result.returncode != 0:
            log.error(f"mysqldump failed: {result.stderr}")
            sys.exit(1)
        size = output_path.stat().st_size / 1024
        log.info(f"✅ SQL dump saved: {output_path} ({size:.1f} KB)")
    except FileNotFoundError:
        log.warning("mysqldump not found — falling back to Python export")
        export_excel(db, output_dir, table)


def export_excel(db, output_dir: Path, table: str = None):
    """Export all tables (or one table) to Excel."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"ioh_dashboard_{timestamp}.xlsx"
    output_path = output_dir / filename

    conn = get_connection(db)
    tables_to_export = []

    if table:
        tables_to_export = [table]
    else:
        with conn.cursor() as cur:
            cur.execute("SHOW TABLES")
            tables_to_export = [list(r.values())[0] for r in cur.fetchall()]

    log.info(f"Exporting {len(tables_to_export)} tables to Excel...")

    with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
        for tbl in tables_to_export:
            try:
                df = pd.read_sql(f"SELECT * FROM `{tbl}`", conn)
                sheet_name = tbl[:31]  # Excel sheet name limit
                df.to_excel(writer, sheet_name=sheet_name, index=False)
                log.info(f"  → {tbl}: {len(df)} rows")
            except Exception as e:
                log.warning(f"  ✗ {tbl}: {e}")

    conn.close()
    size = output_path.stat().st_size / 1024
    log.info(f"✅ Excel export saved: {output_path} ({size:.1f} KB)")


def main():
    parser = argparse.ArgumentParser(description="IOH Dashboard — Database Export")
    parser.add_argument("--format", default="sql", choices=["sql", "excel"],
                        help="Export format (default: sql)")
    parser.add_argument("--table", default=None,
                        help="Export specific table only")
    parser.add_argument("--output", default="deploy/backups",
                        help="Output directory (default: deploy/backups)")
    args = parser.parse_args()

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        db = parse_db_url()
    except Exception as e:
        log.error(e)
        sys.exit(1)

    if args.format == "sql":
        export_sql(db, output_dir, args.table)
    else:
        export_excel(db, output_dir, args.table)


if __name__ == "__main__":
    main()
