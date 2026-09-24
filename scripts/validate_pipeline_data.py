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

    # Check 5: PGIL on ex-bonus date (2026-09-11) and post-bonus low52w
    session_pgil = drill_2026.get("2026-09-11", {})
    down45_pgil = [item for item in session_pgil.get("down45", []) if item[0] == "PGIL"]
    if len(down45_pgil) > 0:
        print(f"  ❌ PGIL falsely entered down45 on ex-date 2026-09-11: {down45_pgil}")
        ca_errors += 1
    else:
        print("  ✅ PGIL did not enter down45 on ex-date 2026-09-11")

    pgil_low_dates = []
    for d_str, s_data in drill_2026.items():
        if d_str >= "2026-09-11":
            if any(item[0] == "PGIL" for item in s_data.get("low52w", [])):
                pgil_low_dates.append(d_str)
    if len(pgil_low_dates) > 0:
        print(f"  ❌ PGIL falsely appeared in low52w on post-bonus dates: {pgil_low_dates}")
        ca_errors += len(pgil_low_dates)
    else:
        print("  ✅ PGIL never appeared in low52w post-bonus (2026-09-11 onwards)")

    # Check 6: INDIAGLYCO on ex-split date (2026-09-02) and post-split low52w
    session_indiaglyco = drill_2026.get("2026-09-02", {})
    down45_indiaglyco = [item for item in session_indiaglyco.get("down45", []) if item[0] == "INDIAGLYCO"]
    if len(down45_indiaglyco) > 0:
        print(f"  ❌ INDIAGLYCO falsely entered down45 on ex-date 2026-09-02: {down45_indiaglyco}")
        ca_errors += 1
    else:
        print("  ✅ INDIAGLYCO did not enter down45 on ex-date 2026-09-02")

    indiaglyco_low_dates = []
    for d_str, s_data in drill_2026.items():
        if d_str >= "2026-09-02":
            if any(item[0] == "INDIAGLYCO" for item in s_data.get("low52w", [])):
                indiaglyco_low_dates.append(d_str)
    if len(indiaglyco_low_dates) > 0:
        print(f"  ❌ INDIAGLYCO falsely appeared in low52w on post-split dates: {indiaglyco_low_dates}")
        ca_errors += len(indiaglyco_low_dates)
    else:
        print("  ✅ INDIAGLYCO never appeared in low52w post-split (2026-09-02 onwards)")

    # Check 7: POLICYBZR on crash date (2026-09-24)
    session_pb = drill_2026.get("2026-09-24", {})
    if session_pb:
        down45_pb = [item for item in session_pb.get("down45", []) if item[0] == "POLICYBZR"]
        if len(down45_pb) == 0:
            print("  ❌ POLICYBZR missing from down45 on 2026-09-24 crash session!")
            ca_errors += 1
        else:
            pb_ret = down45_pb[0][2]
            if pb_ret > -30.0:
                print(f"  ❌ POLICYBZR return masked on 2026-09-24 ({pb_ret:.2f}% vs expected ~ -36.00%)!")
                ca_errors += 1
            else:
                print(f"  ✅ POLICYBZR accurately captured in down45 on 2026-09-24 with true plunge return ({pb_ret:.2f}%)")

        high52w_pb = [item for item in session_pb.get("high52w", []) if item[0] == "POLICYBZR"]
        if len(high52w_pb) > 0:
            print(f"  ❌ POLICYBZR falsely appeared in high52w on crash date 2026-09-24: {high52w_pb}")
            ca_errors += 1
        else:
            print("  ✅ POLICYBZR cleanly excluded from high52w on crash date 2026-09-24")

        low52w_pb = [item for item in session_pb.get("low52w", []) if item[0] == "POLICYBZR"]
        if len(low52w_pb) == 0:
            print("  ❌ POLICYBZR missing from low52w on 2026-09-24 crash date!")
            ca_errors += 1
        else:
            print("  ✅ POLICYBZR correctly included in low52w on 2026-09-24 crash date")

    # Check 8: Audit all registered actions against artificial unadjusted split plunge
    ca_path = os.path.join(os.path.dirname(__file__), "..", "data", "corporate_actions.json")
    all_cas = []
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

    # Invariant 4B: Active fail-closed scan for ANY unregistered split drop (drop <= -28% with open gap)
    registered_keys = {(ca['symbol'].strip().upper(), ca['ex_date']) for ca in all_cas}
    unregistered_split_drops = 0
    con = duckdb.connect()
    for yr, yr_data in annual_drilldowns.items():
        if int(yr) < 2026:
            continue
        for d_str, session_data in yr_data.items():
            for item in session_data.get("down45", []):
                sym = item[0]
                pct1d = item[2]
                if pct1d <= -28.0:
                    if (sym, d_str) not in registered_keys and not sym.endswith("-RE"):
                        # Differentiate between unadjusted split drop (opened down at split ratio)
                        # vs genuine intraday market crash (e.g. POLICYBZR plunged -36%)
                        cand_row = con.execute(f"""
                            SELECT open, high, low, close, prev_close 
                            FROM read_parquet('{parquet_dir}/**/*.parquet', union_by_name=true)
                            WHERE symbol = ? AND CAST(trade_date AS DATE) = ?::DATE
                            LIMIT 1
                        """, [sym, d_str]).fetchone()
                        if cand_row:
                            c_o, c_h, c_l, c_c, c_pc = cand_row
                            r_open = (c_o / c_pc) if (c_pc and c_pc > 0) else 1.0
                            r_high = (c_h / c_pc) if (c_pc and c_pc > 0) else 1.0
                            intra_vol = abs(c_c - c_o) / c_o if (c_o and c_o > 0) else 0.0
                            if r_open <= 0.72 and r_high <= 0.75:
                                print(f"  🚨 Invariant 4B Violation: Unregistered split drop for {sym} on {d_str} ({pct1d:.2f}%, open_ratio={r_open:.3f}). Must be registered in corporate_actions.json!")
                                unregistered_split_drops += 1
                            else:
                                print(f"  ℹ️ [Market Plunge Verified] {sym} on {d_str} dropped {pct1d:.2f}% (open_ratio={r_open:.3f}, intraday_drop={intra_vol*100:.1f}%) - Verified genuine crash, NOT an unadjusted corporate action.")
                        else:
                            print(f"  🚨 Invariant 4B Violation: Unregistered split drop for {sym} on {d_str} ({pct1d:.2f}%). Must be registered in corporate_actions.json!")
                            unregistered_split_drops += 1
    if unregistered_split_drops > 0:
        ca_errors += unregistered_split_drops

    # Invariant 4C: Unadjusted Price Baseline Test
    # A stock cannot be declared a 52-Week High based solely on a freshly auto-detected corporate action factor
    # if its raw unadjusted price did not also breach the unadjusted 52-week high,
    # while preserving legitimate Climax Tops (stocks that genuinely hit ATH in the morning and collapsed intraday).
    auto_detected_cas = {(ca['symbol'].strip().upper(), ca['ex_date']) for ca in all_cas if 'auto-detected' in ca.get('description', '').lower()}
    raw_highs_lookup = {}
    if auto_detected_cas:
        auto_syms = list({s for s, _ in auto_detected_cas})
        placeholders = ", ".join(["?"] * len(auto_syms))
        raw_high_query = f"""
        WITH raw_prices AS (
            SELECT 
                symbol,
                CAST(trade_date AS DATE) as d,
                high,
                MAX(high) OVER (
                    PARTITION BY symbol 
                    ORDER BY CAST(trade_date AS DATE) 
                    ROWS BETWEEN 252 PRECEDING AND 1 PRECEDING
                ) as prior_raw_high52w
            FROM read_parquet('{parquet_dir}/**/*.parquet', union_by_name=true)
            WHERE series IN ('EQ', 'BE', 'BZ')
              AND symbol IN ({placeholders})
        )
        SELECT symbol, d::VARCHAR, high, prior_raw_high52w
        FROM raw_prices
        """
        for r_sym, r_d, r_h, r_prior_h in con.execute(raw_high_query, auto_syms).fetchall():
            raw_highs_lookup[(r_sym, r_d)] = (r_h, r_prior_h)
    con.close()

    inv4c_errors = 0
    for yr, yr_data in annual_drilldowns.items():
        for d_str, session_data in yr_data.items():
            for item in session_data.get("high52w", []):
                sym = item[0]
                if (sym, d_str) in auto_detected_cas:
                    h_val, prior_h = raw_highs_lookup.get((sym, d_str), (None, None))
                    if h_val is not None and prior_h is not None:
                        if h_val < prior_h:
                            print(f"  🚨 Invariant 4C Violation: {sym} falsely crowned 52-Week High on {d_str} solely via auto-detected factor (raw high {h_val:.2f} < unadjusted 52W high {prior_h:.2f})!")
                            inv4c_errors += 1
    if inv4c_errors > 0:
        ca_errors += inv4c_errors
    else:
        print("  ✅ Invariant 4C: Unadjusted Price Baseline Test 100% CLEAN (0 false 52W highs from auto-detected actions, Climax Tops preserved)")

    if ca_errors > 0:
        print(f"\n❌ FAILED: {ca_errors} corporate action integrity errors detected.")
        sys.exit(1)
    else:
        print("✅ Invariant 4: Corporate action split integrity (POCL, GOODLUCK, ANGELONE, PGIL, INDIAGLYCO, POLICYBZR + 4B & 4C Guards): 100% CLEAN")

    # ----------------------------------------------------
    # 8. STRICT INVARIANT 5: Zero ETF & Rights Entitlement Leakage Guardrail
    # ----------------------------------------------------
    print("\n🔍 Invariant 5: Auditing Zero ETF & Rights Entitlement (-RE) Leakage...")
    try:
        from etf_util import is_etf_or_re, load_etf_symbols, get_protected_whitelist
    except ImportError:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        if base_dir not in sys.path:
            sys.path.append(base_dir)
        from etf_util import is_etf_or_re, load_etf_symbols, get_protected_whitelist

    canonical_etfs = load_etf_symbols()
    probe_etfs = {
        "NIFTYBEES", "GOLDBEES", "BANKBEES", "ABSLLIQUID", "LIQUIDBEES", "SILVERBEES",
        "CPSEETF", "ICICIB22", "AUTOBEES", "COMMOIETF",
        "ISENSEX", "RELBANK", "RELCNX100", "RELCONS", "RELDIVOPP", "RELIGAREGO",
        "M100", "M50", "N100", "MANXT50", "MANV30F", "EQ30",
        "BHARATIWIN", "LOWVOLIWIN", "MASILVER", "KOTAKLIQ", "ICICI10GS", "ICICICOMMO", "ICICIQTY30"
    }
    probe_whitelist = [
        "SKYGOLD", "GOLDIAM", "SILVERTUC", "EUROBOND", "CHEMBOND", "PNBGILTS",
        "BHARATFORG", "JETFREIGHT", "CHEMBONDCH", "DECNGOLD", "SBIFUNDS", "GROWW",
        "MUTHOOTMF", "JMFINANCIL", "EDELWEISS"
    ]

    # Verify whitelist precedence immunity
    for sym in probe_whitelist:
        if is_etf_or_re(sym):
            print(f"  ❌ FATAL: Whitelisted equity '{sym}' was erroneously classified as ETF/RE!")
            sys.exit(1)

    etf_leak_errors = 0
    checked_sessions = 0

    for yr, yr_data in annual_drilldowns.items():
        for d_str, session_data in yr_data.items():
            checked_sessions += 1
            # Check standard tuple drilldown lists
            for list_name in ["high52w", "low52w", "up45", "down45", "up20_5d", "down20_5d"]:
                for row in session_data.get(list_name, []):
                    sym = row[0]
                    if is_etf_or_re(sym) or sym in probe_etfs:
                        print(f"  ❌ ETF/RE Leakage: '{sym}' appeared in {list_name} on session {d_str}")
                        etf_leak_errors += 1

            # Check top_setups dictionaries
            for s_dict in session_data.get("top_setups", []):
                sym = s_dict.get("symbol") or s_dict.get("Symbol")
                if sym and (is_etf_or_re(sym) or sym in probe_etfs):
                    print(f"  ❌ ETF/RE Leakage: '{sym}' appeared in top_setups on session {d_str}")
                    etf_leak_errors += 1

    if etf_leak_errors > 0:
        print(f"\n❌ FAILED: {etf_leak_errors} ETF/RE leakage violations detected across {checked_sessions} sessions.")
        sys.exit(1)
    else:
        print(f"✅ Invariant 5: Zero ETF & Rights Entitlement (-RE) leakage across {checked_sessions} sessions: 100% CLEAN")

    print("\n==================================================")
    print("🎉 ALL 5 STRICT INVARIANT TIERS PASSED! SAFE FOR PRODUCTION.")
    print("==================================================")
    sys.exit(0)

if __name__ == "__main__":
    validate_pipeline_data()
