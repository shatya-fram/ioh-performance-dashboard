#!/usr/bin/env python3
"""
IOH Performance Dashboard — Health Check Utility
=================================================
Checks the health of the running application and database.

Usage:
  python3 scripts/health_check.py
  python3 scripts/health_check.py --url http://localhost:3000
  python3 scripts/health_check.py --url https://dashboard.gamextopia.id

Requirements:
  pip install requests pymysql python-dotenv
"""

import os
import sys
import argparse
import logging
from pathlib import Path
from datetime import datetime

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

try:
    import requests
    import pymysql
    from dotenv import load_dotenv
except ImportError as e:
    log.error(f"Missing dependency: {e}")
    log.error("Run: pip install requests pymysql python-dotenv")
    sys.exit(1)

load_dotenv(Path(__file__).parent.parent / ".env")
load_dotenv(Path(__file__).parent.parent / ".env.local")

CHECKS_PASSED = 0
CHECKS_FAILED = 0


def check(name: str, fn):
    global CHECKS_PASSED, CHECKS_FAILED
    try:
        result = fn()
        log.info(f"  ✅ {name}: {result}")
        CHECKS_PASSED += 1
    except Exception as e:
        log.error(f"  ❌ {name}: {e}")
        CHECKS_FAILED += 1


def main():
    parser = argparse.ArgumentParser(description="IOH Dashboard — Health Check")
    parser.add_argument("--url", default="http://localhost:3000",
                        help="App URL to check (default: http://localhost:3000)")
    args = parser.parse_args()

    print("\n" + "="*60)
    print("  IOH Performance Dashboard — Health Check")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60 + "\n")

    # ── 1. App HTTP check ──────────────────────────────────────────────────────
    print("[ App Server ]")
    def check_http():
        r = requests.get(args.url, timeout=10)
        r.raise_for_status()
        return f"HTTP {r.status_code} ({r.elapsed.total_seconds()*1000:.0f}ms)"
    check("HTTP response", check_http)

    def check_api():
        r = requests.get(f"{args.url}/api/trpc/auth.me", timeout=10)
        return f"tRPC reachable (HTTP {r.status_code})"
    check("tRPC API endpoint", check_api)

    # ── 2. Database check ──────────────────────────────────────────────────────
    print("\n[ Database ]")
    import re
    url = os.environ.get("DATABASE_URL", "")
    if url:
        m = re.match(r"mysql://([^:]+):([^@]+)@([^:/]+):?(\d+)?/(\S+)", url)
        if m:
            user, password, host, port, database = m.groups()
            db_cfg = {
                "host": host, "port": int(port or 3306),
                "user": user, "password": password,
                "database": database.split("?")[0]
            }

            def check_db_connect():
                conn = pymysql.connect(**db_cfg, charset="utf8mb4",
                                       cursorclass=pymysql.cursors.DictCursor,
                                       connect_timeout=5)
                conn.close()
                return f"Connected to {db_cfg['host']}:{db_cfg['port']}/{db_cfg['database']}"
            check("MySQL connection", check_db_connect)

            def check_tables():
                conn = pymysql.connect(**db_cfg, charset="utf8mb4",
                                       cursorclass=pymysql.cursors.DictCursor)
                with conn.cursor() as cur:
                    cur.execute("SHOW TABLES")
                    tables = [list(r.values())[0] for r in cur.fetchall()]
                conn.close()
                return f"{len(tables)} tables: {', '.join(tables)}"
            check("Tables exist", check_tables)

            def check_data():
                conn = pymysql.connect(**db_cfg, charset="utf8mb4",
                                       cursorclass=pymysql.cursors.DictCursor)
                counts = {}
                with conn.cursor() as cur:
                    for tbl in ["fm_raw", "mtd_raw", "vlr_kecamatan", "soga_dms_weekly", "product_data"]:
                        try:
                            cur.execute(f"SELECT COUNT(*) as cnt FROM `{tbl}`")
                            counts[tbl] = cur.fetchone()["cnt"]
                        except:
                            counts[tbl] = "N/A"
                conn.close()
                return " | ".join(f"{k}:{v}" for k, v in counts.items())
            check("Row counts", check_data)
        else:
            log.warning("  ⚠️  DATABASE_URL format not recognized")
    else:
        log.warning("  ⚠️  DATABASE_URL not set — skipping DB checks")

    # ── 3. Summary ────────────────────────────────────────────────────────────
    print("\n" + "="*60)
    total = CHECKS_PASSED + CHECKS_FAILED
    print(f"  Result: {CHECKS_PASSED}/{total} checks passed")
    if CHECKS_FAILED == 0:
        print("  Status: 🟢 ALL HEALTHY")
    elif CHECKS_FAILED < total:
        print("  Status: 🟡 DEGRADED")
    else:
        print("  Status: 🔴 UNHEALTHY")
    print("="*60 + "\n")

    sys.exit(0 if CHECKS_FAILED == 0 else 1)


if __name__ == "__main__":
    main()
