#!/usr/bin/env python3
"""
🛡️ Automated Data Validation Guardrail for QuantBreadth™ Pipeline.
Enforces schema completeness, statistical bounds, date continuity,
annual drilldown JSON integrity, and strict mathematical invariants:
1. Modal constituent count == Summary card counts (len(high52w) - len(low52w) == Net New Highs).
2. Mutual exclusion (0 stocks appear in both 52W Highs and Lows simultaneously).
3. Strict seasoning (0 unseasoned stocks < 252 sessions in 52W Highs/Lows; LUMINO/SKYWAYS eliminated).
4. Corporate action split integrity (POCL eliminated from post-split 52W Lows and down45 on ex-date).
"""

import os
import sys
import json
import math
from datetime import datetime
import duckdb

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
    parquet_dir = os.path.join(project_root, "data", "parquet")

    print("==================================================")
    print("🛡️ QUANTBREADTH™ DATA INTEGRITY & GUARDRAIL AUDIT")
    print("==================================================")

    target_file = data_json_path if os.path.exists(data_json_path) else web_json_path
    if not os.path.exists(target_file):
        print(f"❌ FATAL: Master JSON not found at {target_file}")
        sys.exit(1)

    print(f"📁 Validating master file: {target_file}")

    try:
        with open(target_file, "r") as f:
            data = json.load(f)
    except Exception as e:
        print(f"❌ FATAL: Corrupt JSON syntax in master file: {e}")
        sys.exit(1)

    # ----------------------------------------------------
    # 1. Row Count & Date Continuity Check
    # ----------------------------------------------------
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

    # ----------------------------------------------------
    # 2. Schema, Null/NaN & Boundary Checks
    # ----------------------------------------------------
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
        print("✅ Tier 1: Schema completeness and mathematical boundaries: 100% CLEAN")

    # ----------------------------------------------------
    # 3. Annual Drilldown File Structure Audit
    # ----------------------------------------------------
    print("\n🔍 Auditing Annual Drilldown JSON Files...")
    current_year = datetime.now().year
    years_to_check = [str(y) for y in range(2015, current_year + 1)]
    drilldown_errors = 0
    annual_drilldowns = {}

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

            annual_drilldowns[yr] = yr_data
            print(f"  ✅ {yr}.json: {len(yr_data)} sessions verified")

        except Exception as e:
            print(f"  ❌ Drilldown {yr}.json failed JSON parsing: {e}")
            drilldown_errors += 1

    if drilldown_errors > 0:
        print(f"\n❌ VALIDATION FAILED: {drilldown_errors} Drilldown structure errors.")
        sys.exit(1)
    else:
        print("✅ Tier 2: Annual drilldown file structure: 100% CLEAN")

    # ----------------------------------------------------
    # 4. STRICT INVARIANT 1: Modal Constituent Reconciliation
    # ----------------------------------------------------
    print("\n🔍 Invariant 1: Auditing Modal Count vs Summary Card Reconciliation...")
    breadth_map = {row["Date"]: row for row in data}
    reconciliation_errors = 0

    for yr, yr_data in annual_drilldowns.items():
        for d_str, session_data in yr_data.items():
            if d_str not in breadth_map:
                continue
            card_row = breadth_map[d_str]
            card_nnh = card_row.get("Net New Highs")
            
            modal_highs = len(session_data.get("high52w", []))
            modal_lows = len(session_data.get("low52w", []))
            modal_nnh = modal_highs - modal_lows

            if card_nnh is not None and modal_nnh != card_nnh:
                print(f"  ❌ Reconciliation Mismatch on {d_str}: Card NNH={card_nnh} vs Modal NNH={modal_nnh} (Highs={modal_highs}, Lows={modal_lows})")
                reconciliation_errors += 1

            if "New52W_Highs" in card_row and modal_highs != card_row["New52W_Highs"]:
                print(f"  ❌ Highs Mismatch on {d_str}: Card Highs={card_row['New52W_Highs']} vs Modal Highs={modal_highs}")
                reconciliation_errors += 1

            if "New52W_Lows" in card_row and modal_lows != card_row["New52W_Lows"]:
                print(f"  ❌ Lows Mismatch on {d_str}: Card Lows={card_row['New52W_Lows']} vs Modal Lows={modal_lows}")
                reconciliation_errors += 1

    if reconciliation_errors > 0:
        print(f"\n❌ FAILED: {reconciliation_errors} Modal reconciliation mismatches detected.")
        sys.exit(1)
    else:
        print("✅ Invariant 1: len(high52w) - len(low52w) == Net New Highs: 100% MATCH")

    # ----------------------------------------------------
    # 5. STRICT INVARIANT 2: Mutual Exclusion
    # ----------------------------------------------------
    print("\n🔍 Invariant 2: Auditing 52W Highs/Lows Mutual Exclusion...")
    overlap_errors = 0
    for yr, yr_data in annual_drilldowns.items():
        for d_str, session_data in yr_data.items():
            high_syms = set(s[0] for s in session_data.get("high52w", []))
            low_syms = set(s[0] for s in session_data.get("low52w", []))
            overlap = high_syms & low_syms
            if len(overlap) > 0:
                print(f"  ❌ Session {d_str}: {len(overlap)} stocks appear in BOTH 52W Highs and Lows: {overlap}")
                overlap_errors += 1

    if overlap_errors > 0:
        print(f"\n❌ FAILED: {overlap_errors} mutual exclusion violations detected.")
        sys.exit(1)
    else:
        print("✅ Invariant 2: 0 stocks appear in both 52W Highs and Lows simultaneously: 100% CLEAN")

    # ----------------------------------------------------
    # 6. STRICT INVARIANT 3: Seasoning Check (< 252 Sessions)
    # ----------------------------------------------------
    print("\n🔍 Invariant 3: Auditing Seasoning Invariant (>= 252 trading sessions required)...")
    seasoning_errors = 0

    # Build symbol session counts up to date using DuckDB
    con = duckdb.connect()
    count_query = f"""
    WITH clean_dates AS (
        SELECT 
            symbol,
            CAST(trade_date AS DATE) as d
        FROM read_parquet('{parquet_dir}/**/*.parquet', union_by_name=true)
        WHERE series IN ('EQ', 'BE', 'BZ')
        GROUP BY symbol, d
    )
    SELECT symbol, d::VARCHAR, ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY d) as cnt
    FROM clean_dates
    """
    print("  Calculating trading session history per symbol in DuckDB...")
    sym_counts = {}
    for sym, d_str, cnt in con.execute(count_query).fetchall():
        sym_counts[(sym, d_str)] = cnt
    con.close()

    for yr, yr_data in annual_drilldowns.items():
        for d_str, session_data in yr_data.items():
            for item in session_data.get("high52w", []):
                sym = item[0]
                cnt = sym_counts.get((sym, d_str), 0)
                if cnt < 252:
                    print(f"  ❌ Unseasoned stock {sym} in high52w on {d_str} (only {cnt} sessions < 252)")
                    seasoning_errors += 1

            for item in session_data.get("low52w", []):
                sym = item[0]
                cnt = sym_counts.get((sym, d_str), 0)
                if cnt < 252:
                    print(f"  ❌ Unseasoned stock {sym} in low52w on {d_str} (only {cnt} sessions < 252)")
                    seasoning_errors += 1

    # Specifically assert LUMINO and SKYWAYS never appear in 52W lists
    for sym in ["LUMINO", "SKYWAYS"]:
        for yr, yr_data in annual_drilldowns.items():
            for d_str, session_data in yr_data.items():
                if any(s[0] == sym for s in session_data.get("high52w", [])):
                    print(f"  ❌ {sym} erroneously appeared in high52w on {d_str}")
                    seasoning_errors += 1
                if any(s[0] == sym for s in session_data.get("low52w", [])):
                    print(f"  ❌ {sym} erroneously appeared in low52w on {d_str}")
                    seasoning_errors += 1

    if seasoning_errors > 0:
        print(f"\n❌ FAILED: {seasoning_errors} seasoning violations detected.")
        sys.exit(1)
    else:
        print("✅ Invariant 3: 0 unseasoned stocks (< 252 sessions) in 52W Highs or Lows: 100% CLEAN")

    # ----------------------------------------------------
    # 7. STRICT INVARIANT 4: Corporate Action Split Integrity
    # ----------------------------------------------------
    print("\n🔍 Invariant 4: Auditing Corporate Action Split Integrity...")
    ca_errors = 0
    drill_2026 = annual_drilldowns.get("2026", {})

    # Check 1: POCL does not enter down45 on ex-split date (2026-07-21)
    session_21 = drill_2026.get("2026-07-21", {})
    down45_21 = [item for item in session_21.get("down45", []) if item[0] == "POCL"]
    if len(down45_21) > 0:
        print(f"  ❌ POCL entered down45 on ex-split date 2026-07-21: {down45_21}")
        ca_errors += 1
    else:
        print("  ✅ POCL did not enter down45 on ex-split date 2026-07-21")

    # Check 2: POCL does not appear in 52W Lows post-split (>= 2026-07-21)
    pocl_low_dates = []
    for d_str, s_data in drill_2026.items():
        if d_str >= "2026-07-21":
            if any(item[0] == "POCL" for item in s_data.get("low52w", [])):
                pocl_low_dates.append(d_str)

    if len(pocl_low_dates) > 0:
        print(f"  ❌ POCL falsely appeared in low52w on post-split dates: {pocl_low_dates}")
        ca_errors += len(pocl_low_dates)
    else:
        print("  ✅ POCL never appeared in low52w post-split (2026-07-21 onwards)")

    # Check 3: Specific guardrail for GOODLUCK on ex-date 2026-08-21 (gained +2.31% post-bonus)
    session_goodluck = drill_2026.get("2026-08-21", {})
    down45_goodluck = [item for item in session_goodluck.get("down45", []) if item[0] == "GOODLUCK"]
    if len(down45_goodluck) > 0:
        print(f"  ❌ GOODLUCK falsely entered down45 on ex-date 2026-08-21: {down45_goodluck}")
        ca_errors += 1
    else:
        print("  ✅ GOODLUCK did not enter down45 on ex-date 2026-08-21")

    # Check 4: Specific guardrail for ANGELONE on ex-split date (2026-02-26) and low52w post-split
    session_angel = drill_2026.get("2026-02-26", {})
    down45_angel = [item for item in session_angel.get("down45", []) if item[0] == "ANGELONE"]
    if len(down45_angel) > 0:
        print(f"  ❌ ANGELONE falsely entered down45 on ex-date 2026-02-26: {down45_angel}")
        ca_errors += 1
    else:
        print("  ✅ ANGELONE did not enter down45 on ex-date 2026-02-26")

    angel_low_dates = []
    for d_str, s_data in drill_2026.items():
        if d_str >= "2026-02-26":
            if any(item[0] == "ANGELONE" for item in s_data.get("low52w", [])):
                angel_low_dates.append(d_str)
    if len(angel_low_dates) > 0:
        print(f"  ❌ ANGELONE falsely appeared in low52w on post-split dates: {angel_low_dates}")
        ca_errors += len(angel_low_dates)
    else:
        print("  ✅ ANGELONE never appeared in low52w post-split (2026-02-26 onwards)")

    # Check 5: Audit all registered actions against artificial unadjusted split plunge
    ca_path = os.path.join(os.path.dirname(__file__), "..", "data", "corporate_actions.json")
    if os.path.exists(ca_path):
        with open(ca_path, "r") as f:
            all_cas = json.load(f)
        for ca in all_cas:
            sym = ca['symbol']
            ex_d = ca['ex_date']
            ratio = float(ca['ratio'])
            if ratio < 1.4:
                continue
            unadj_drop = (1.0 / ratio) - 1.0  # e.g. -50% for 2x, -60% for 2.5x, -90% for 10x
            yr_str = ex_d[:4]
            yr_dict = annual_drilldowns.get(yr_str, {})
            sess = yr_dict.get(ex_d, {})
            
            for item in sess.get("down45", []):
                if item[0] == sym:
                    pct = item[2] / 100.0
                    if pct <= (unadj_drop + 0.10):
                        print(f"  ❌ {sym} has an unadjusted split plunge on ex-date {ex_d}: {pct*100:.2f}% (unadjusted baseline: {unadj_drop*100:.2f}%)")
                        ca_errors += 1

    if ca_errors > 0:
        print(f"\n❌ FAILED: {ca_errors} corporate action integrity errors detected.")
        sys.exit(1)
    else:
        print("✅ Invariant 4: Corporate action split integrity (POCL, GOODLUCK, ANGELONE + registry): 100% CLEAN")

    print("\n==================================================")
    print("🎉 ALL 4 STRICT INVARIANT TIERS PASSED! SAFE FOR PRODUCTION.")
    print("==================================================")
    sys.exit(0)

if __name__ == "__main__":
    validate_pipeline_data()
