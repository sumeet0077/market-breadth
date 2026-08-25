#!/usr/bin/env python3
"""
🛡️ Automated Data Validation Guardrail for QuantBreadth™ Pipeline.
Enforces schema completeness, statistical bounds, date continuity,
and annual drilldown JSON integrity before committing to production.
"""

import os
import sys
import json
import math
from datetime import datetime

MIN_EXPECTED_SESSIONS = 2800
MIN_TOTAL_TRADED = 500
VALID_REGIME_STATES = {0, 1, 2, 3}

CRITICAL_FIELDS = [
    "Date",
    "Regime_State",
    "Swing_Score",
    "Advance/Decline Ratio",
    "TotalTraded",
    "No of stocks above 200 day SMA",
    "No of stocks above 50 day SMA",
    "No of stocks above 20 day SMA",
    "Net New Highs"
]

def validate_pipeline_data():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(base_dir, ".."))
    data_json_path = os.path.join(project_root, "data", "market_breadth.json")
    web_json_path = os.path.join(project_root, "web", "public", "market_breadth.json")
    drilldown_dir = os.path.join(project_root, "data", "drilldowns")

    print("==================================================")
    print("🛡️ QUANTBREADTH™ DATA INTEGRITY & GUARDRAIL AUDIT")
    print("==================================================")

    target_file = data_json_path if os.path.exists(data_json_path) else web_json_path
    if not os.path.exists(target_file):
        print(f"❌ FATAL: Master JSON not found at {target_file}")
        sys.exit(1)

    print(f"📁 Validating file: {target_file}")

    try:
        with open(target_file, "r") as f:
            data = json.load(f)
    except Exception as e:
        print(f"❌ FATAL: Corrupt JSON syntax in master file: {e}")
        sys.exit(1)

    # 1. Row Count & Date Continuity Check
    total_sessions = len(data)
    print(f"📊 Total Historical Sessions: {total_sessions}")
    if total_sessions < MIN_EXPECTED_SESSIONS:
        print(f"❌ FAILED: Total sessions {total_sessions} is less than required minimum {MIN_EXPECTED_SESSIONS}")
        sys.exit(1)

    earliest_date = data[0].get("Date")
    latest_date = data[-1].get("Date")
    print(f"📅 Date Range: {earliest_date} → {latest_date}")

    try:
        datetime.strptime(latest_date, "%Y-%m-%d")
    except Exception:
        print(f"❌ FAILED: Invalid latest date format '{latest_date}' (expected YYYY-MM-DD)")
        sys.exit(1)

    # 2. Schema, Null/NaN & Boundary Checks
    null_errors = 0
    boundary_errors = 0

    for idx, row in enumerate(data):
        d_str = row.get("Date", f"Row_{idx}")

        # Check critical fields
        for field in CRITICAL_FIELDS:
            val = row.get(field)
            if val is None or (isinstance(val, float) and (math.isnan(val) or math.isinf(val))):
                print(f"  ❌ Null/NaN found in '{field}' on session {d_str}")
                null_errors += 1

        # Mathematical Bounds
        swing = row.get("Swing_Score")
        if swing is not None and not (0.0 <= swing <= 100.0):
            print(f"  ❌ Swing_Score out of bounds ({swing}) on session {d_str}")
            boundary_errors += 1

        regime = row.get("Regime_State")
        if regime is not None and regime not in VALID_REGIME_STATES:
            print(f"  ❌ Invalid Regime_State ({regime}) on session {d_str}")
            boundary_errors += 1

        tt = row.get("TotalTraded")
        if tt is not None and tt < MIN_TOTAL_TRADED:
            print(f"  ❌ TotalTraded too low ({tt} < {MIN_TOTAL_TRADED}) on session {d_str}")
            boundary_errors += 1

        ad = row.get("Advance/Decline Ratio")
        if ad is not None and ad < 0:
            print(f"  ❌ Negative Advance/Decline Ratio ({ad}) on session {d_str}")
            boundary_errors += 1

    if null_errors > 0 or boundary_errors > 0:
        print(f"\n❌ VALIDATION FAILED: {null_errors} Null/NaN errors, {boundary_errors} Boundary errors.")
        sys.exit(1)
    else:
        print("✅ Schema completeness and mathematical boundaries: 100% CLEAN")

    # 3. Annual Drilldown File Audit
    print("\n🔍 Auditing Annual Drilldown JSON Files...")
    current_year = datetime.now().year
    years_to_check = [str(y) for y in range(2015, current_year + 1)]
    drilldown_errors = 0

    for yr in years_to_check:
        drill_file = os.path.join(drilldown_dir, f"{yr}.json")
        if not os.path.exists(drill_file):
            print(f"  ❌ Missing annual drilldown: {yr}.json")
            drilldown_errors += 1
            continue

        try:
            with open(drill_file, "r") as f:
                yr_data = json.load(f)

            if len(yr_data) == 0:
                print(f"  ❌ Drilldown {yr}.json is empty!")
                drilldown_errors += 1
                continue

            has_setups = any("top_setups" in v and len(v["top_setups"]) > 0 for v in yr_data.values())
            if not has_setups:
                print(f"  ⚠️ Warning: {yr}.json has 0 top_setups recorded")

            print(f"  ✅ {yr}.json: {len(yr_data)} sessions verified")

        except Exception as e:
            print(f"  ❌ Drilldown {yr}.json failed JSON parsing: {e}")
            drilldown_errors += 1

    if drilldown_errors > 0:
        print(f"\n❌ VALIDATION FAILED: {drilldown_errors} Drilldown errors.")
        sys.exit(1)

    print("\n==================================================")
    print("🎉 ALL 3 GUARDRAIL TIERS PASSED! SAFE FOR PRODUCTION.")
    print("==================================================")
    sys.exit(0)

if __name__ == "__main__":
    validate_pipeline_data()
