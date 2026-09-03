"""
18 Unified Parent Sectors & 74 Granular Industry Themes Engine.
Loads the single source of truth from data/industry_themes.json and enriches
annual drilldown files with institutional breakout setup quality scores,
sub-theme badges, and multi-layered sympathy waves.
"""

import os
import json
import duckdb
import polars as pl
import numpy as np

# -------------------------------------------------------------------------
# 1. LOAD THE SINGLE SOURCE OF TRUTH: industry_themes.json
# -------------------------------------------------------------------------
THEMES_JSON_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "industry_themes.json")

if not os.path.exists(THEMES_JSON_PATH):
    THEMES_JSON_PATH = "data/industry_themes.json"

with open(THEMES_JSON_PATH, "r") as f:
    INDUSTRY_THEMES_DATA = json.load(f)

# -------------------------------------------------------------------------
# 2. MAP THE 74 GRANULAR THEMES TO 18 UNIFIED PARENT SECTORS
# -------------------------------------------------------------------------
THEME_TO_PARENT_SECTOR = {
    # 1. Defence & Aerospace
    "Defence & Aerospace": "Defence & Aerospace",
    "Shipbuilding": "Defence & Aerospace",
    "Marine & Offshore Services": "Defence & Aerospace",
    
    # 2. Railways & Heavy Infra
    "Railways & Infrastructure": "Railways & Heavy Infra",
    
    # 3. Power & Green Energy
    "Power Generation": "Power & Green Energy",
    "Power T&D": "Power & Green Energy",
    "Solar Manufacturing": "Power & Green Energy",
    "Renewable Energy Generation": "Power & Green Energy",
    "Green Hydrogen": "Power & Green Energy",
    "Wires and Cables": "Power & Green Energy",
    
    # 4. Private Banks
    "Private Banking": "Private Banks",
    
    # 5. Public Banks
    "PSU Banking": "Public Banks",
    
    # 6. Financial Services & NBFC
    "NBFC": "Financial Services & NBFC",
    "Housing Finance": "Financial Services & NBFC",
    "Life Insurance": "Financial Services & NBFC",
    "General Insurance": "Financial Services & NBFC",
    "Asset Management": "Financial Services & NBFC",
    "Wealth Management": "Financial Services & NBFC",
    "Capital Market": "Financial Services & NBFC",
    "Fintech": "Financial Services & NBFC",
    
    # 7. IT & Software Services
    "IT Services": "IT & Software Services",
    
    # 8. Semiconductors & EMS
    "Semiconductors & EMS": "Semiconductors & EMS",
    "Data Centre and AI": "Semiconductors & EMS",
    "IT Hardware & Peripherals": "Semiconductors & EMS",
    "Technology Hardware Distribution": "Semiconductors & EMS",
    "Telecom Services": "Semiconductors & EMS",
    "Telecom Infra": "Semiconductors & EMS",
    
    # 9. Auto & Ancillaries
    "Auto Passenger & CV": "Auto & Ancillaries",
    "Two & Three Wheelers": "Auto & Ancillaries",
    "EV Ecosystem": "Auto & Ancillaries",
    "Auto Ancillary": "Auto & Ancillaries",
    "Tyres & Rubber Products": "Auto & Ancillaries",
    
    # 10. Healthcare & Pharma
    "Pharma Formulations": "Healthcare & Pharma",
    "Pharma CDMO & API": "Healthcare & Pharma",
    "Hospitals": "Healthcare & Pharma",
    "Diagnostics & Pathology": "Healthcare & Pharma",
    
    # 11. Capital Goods & Engg
    "Capital Goods": "Capital Goods & Engg",
    "Infrastructure & EPC": "Capital Goods & Engg",
    "Water & Irrigation Infrastructure": "Capital Goods & Engg",
    "Packaging Solutions": "Capital Goods & Engg",
    "Business Services": "Capital Goods & Engg",
    
    # 12. Consumer & Retail / QSR
    "Retail & E-Commerce": "Consumer & Retail / QSR",
    "QSR": "Consumer & Retail / QSR",
    "Personal Care & Wellness": "Consumer & Retail / QSR",
    "Alcohols & Breweries": "Consumer & Retail / QSR",
    "Luxury": "Consumer & Retail / QSR",
    "Jewellery & Gold": "Consumer & Retail / QSR",
    "Footwear": "Consumer & Retail / QSR",
    "White Goods & Durables": "Consumer & Retail / QSR",
    "Textiles": "Consumer & Retail / QSR",
    "Media & Broadcasting": "Consumer & Retail / QSR",
    "Music & Content": "Consumer & Retail / QSR",
    
    # 13. FMCG Staples
    "FMCG Staples": "FMCG Staples",
    
    # 14. Real Estate & Materials
    "Real Estate & Realty": "Real Estate & Materials",
    "Cement": "Real Estate & Materials",
    "Building Materials": "Real Estate & Materials",
    "PVC Pipes & Plumbing": "Real Estate & Materials",
    "Paints": "Real Estate & Materials",
    
    # 15. Metals & Mining
    "Metals & Mining": "Metals & Mining",
    "Copper": "Metals & Mining",
    "Silver": "Metals & Mining",
    "Critical Minerals": "Metals & Mining",
    "Carbon and Graphite": "Metals & Mining",
    
    # 16. Chemicals & Fertilisers
    "Specialty Chemicals": "Chemicals & Fertilisers",
    "Agrochemicals & Fertilisers": "Chemicals & Fertilisers",
    "Sugar": "Chemicals & Fertilisers",
    "Paper": "Chemicals & Fertilisers",
    
    # 17. Oil, Gas & Energy
    "Oil & Gas Upstream": "Oil, Gas & Energy",
    "Oil & Gas Midstream": "Oil, Gas & Energy",
    "Oil & Gas Downstream": "Oil, Gas & Energy",
    
    # 18. Travel & Hospitality
    "Hotels & Hospitality": "Travel & Hospitality",
    "Travel & Tourism": "Travel & Hospitality",
    "Aviation": "Travel & Hospitality",
    "Logistics": "Travel & Hospitality",
}

# -------------------------------------------------------------------------
# 3. BUILD STOCK -> (PARENT_SECTOR, THEME) INVERTED INDEX
# -------------------------------------------------------------------------
SYMBOL_TAXONOMY_MAP = {}

for theme_title, theme_data in INDUSTRY_THEMES_DATA.items():
    parent_sec = THEME_TO_PARENT_SECTOR.get(theme_title, "Diversified")
    for sym in theme_data.get("clean_symbols", []):
        sym_clean = sym.upper().strip()
        if sym_clean not in SYMBOL_TAXONOMY_MAP:
            SYMBOL_TAXONOMY_MAP[sym_clean] = {
                "sector": parent_sec,
                "theme": theme_title
            }

# Manual additions for key IPOs
SYMBOL_TAXONOMY_MAP.update({
    "WAAREE": {"sector": "Power & Green Energy", "theme": "Solar Manufacturing"},
    "PREMIERENE": {"sector": "Power & Green Energy", "theme": "Solar Manufacturing"},
    "SWIGGY": {"sector": "Consumer & Retail / QSR", "theme": "Retail & E-Commerce"},
    "HYUNDAI": {"sector": "Auto & Ancillaries", "theme": "Auto Passenger & CV"},
    "NTPCGREEN": {"sector": "Power & Green Energy", "theme": "Renewable Energy Generation"},
    "ACME": {"sector": "Power & Green Energy", "theme": "Solar Manufacturing"},
})

def get_stock_taxonomy(symbol: str):
    """Returns (ParentSector, GranularTheme) for any symbol."""
    sym = symbol.upper().strip()
    if sym in SYMBOL_TAXONOMY_MAP:
        info = SYMBOL_TAXONOMY_MAP[sym]
        return info["sector"], info["theme"]
    
    # Intelligent Heuristic Fallback
    if "PHARMA" in sym or "LAB" in sym or "HEALTH" in sym: 
        return "Healthcare & Pharma", "Pharma Formulations"
    if "BANK" in sym: 
        return ("Public Banks", "PSU Banking") if any(k in sym for k in ["SBI", "PNB", "BOB", "CAN", "UNION", "INDIAN", "UCO"]) else ("Private Banks", "Private Banking")
    if "FIN" in sym or "CAP" in sym or "MUTHOOT" in sym: 
        return "Financial Services & NBFC", "NBFC"
    if "TECH" in sym or "SOFT" in sym or "INFO" in sym: 
        return "IT & Software Services", "IT Services"
    if "POWER" in sym or "SOLAR" in sym or "ENERGY" in sym or "WIND" in sym: 
        return "Power & Green Energy", "Renewable Energy Generation"
    if "STEEL" in sym or "METAL" in sym or "MIN" in sym: 
        return "Metals & Mining", "Metals & Mining"
    if "CHEM" in sym or "FERT" in sym: 
        return "Chemicals & Fertilisers", "Specialty Chemicals"
    if "INFRA" in sym or "CONST" in sym or "ENG" in sym: 
        return "Capital Goods & Engg", "Capital Goods"
    if "AUTO" in sym or "MOTOR" in sym: 
        return "Auto & Ancillaries", "Auto Passenger & CV"
    if "DEF" in sym or "AERO" in sym:
        return "Defence & Aerospace", "Defence & Aerospace"
    if "RAIL" in sym:
        return "Railways & Heavy Infra", "Railways & Infrastructure"
    if "HOTEL" in sym:
        return "Travel & Hospitality", "Hotels & Hospitality"

    return "Diversified", "Diversified"

# -------------------------------------------------------------------------
# 4. MICROSTRUCTURE SETUP SCORING & CLUSTERING
# -------------------------------------------------------------------------
def compute_setup_score(clv, rvol, compression, is_stage2, dist_52w, is_cluster):
    score = 0
    if clv >= 0.90: score += 25
    elif clv >= 0.75: score += 18
    elif clv >= 0.60: score += 10

    if rvol >= 3.0: score += 25
    elif rvol >= 2.0: score += 18
    elif rvol >= 1.2: score += 10

    if compression <= 0.70: score += 20
    elif compression <= 0.85: score += 12
    else: score += 5

    if is_stage2: score += 15
    else: score += 5

    if dist_52w <= 3.0: score += 15
    elif dist_52w <= 8.0: score += 10
    elif dist_52w <= 15.0: score += 5

    if is_cluster: score += 10

    return min(score, 100)

def classify_grade(score):
    if score >= 85: return "A+ Prime Breakout"
    if score >= 70: return "A Momentum Thrust"
    if score >= 50: return "B Tactical Setup"
    return "C / Trap Risk"

# -------------------------------------------------------------------------
# 5. HIGH-SPEED DUCKDB DATA ENGINE & JSON GENERATOR
# -------------------------------------------------------------------------
def generate_enriched_drilldowns():
    print("=" * 75)
    print("  ENRICHING DRILLDOWNS WITH 18 PARENT SECTORS & 74 GRANULAR THEMES")
    print("=" * 75)
    
    con = duckdb.connect()
    
    # Register corporate actions table
    try:
        from corporate_actions_util import register_corporate_actions_duckdb
    except ImportError:
        import sys
        sys.path.append(os.path.dirname(os.path.abspath(__file__)))
        from corporate_actions_util import register_corporate_actions_duckdb
    register_corporate_actions_duckdb(con)

    # Register ETF exclusion table
    try:
        from etf_util import register_etf_filter_duckdb, get_etf_exclusion_sql_clause
    except ImportError:
        import sys
        sys.path.append(os.path.dirname(os.path.abspath(__file__)))
        from etf_util import register_etf_filter_duckdb, get_etf_exclusion_sql_clause
    register_etf_filter_duckdb(con)
    etf_clause = get_etf_exclusion_sql_clause("symbol")
    
    query = f"""
    WITH raw_stocks AS (
        SELECT 
            symbol AS Symbol,
            CAST(trade_date AS DATE) AS Date,
            open AS Open,
            high AS High,
            low AS Low,
            close AS Close,
            prev_close AS PrevClose,
            volume AS Volume,
            (close * volume) AS Turnover
        FROM read_parquet('data/parquet/**/*.parquet', union_by_name=true)
        WHERE series IN ('EQ', 'BE', 'BZ')
          AND {etf_clause}
    ),
    deduped AS (
        SELECT *,
            ROW_NUMBER() OVER (PARTITION BY Symbol, Date ORDER BY Volume DESC) AS rn
        FROM raw_stocks
    ),
    clean_stocks AS (
        SELECT Symbol, Date, Open, High, Low, Close, PrevClose, Volume, Turnover
        FROM deduped
        WHERE rn = 1
    ),
    adjusted_stocks AS (
        SELECT 
            s.Symbol, s.Date,
            s.Open * COALESCE(adj.adj_factor, 1.0) AS AdjOpen,
            s.High * COALESCE(adj.adj_factor, 1.0) AS AdjHigh,
            s.Low * COALESCE(adj.adj_factor, 1.0) AS AdjLow,
            s.Close * COALESCE(adj.adj_factor, 1.0) AS AdjClose,
            s.Open, s.High, s.Low, s.Close, s.PrevClose, s.Volume, s.Turnover
        FROM clean_stocks s
        LEFT JOIN corporate_action_intervals adj
          ON s.Symbol = adj.symbol 
         AND s.Date >= adj.start_date 
         AND s.Date <= adj.end_date
    ),
    calculated AS (
        SELECT 
            Symbol, Date, Open, High, Low, Close, PrevClose, Volume, Turnover,
            AdjOpen, AdjHigh, AdjLow, AdjClose,
            ROW_NUMBER() OVER (PARTITION BY Symbol ORDER BY Date) AS symbol_day_count,
            (AdjClose / NULLIF(COALESCE(LAG(AdjClose, 1) OVER (PARTITION BY Symbol ORDER BY Date), PrevClose), 0)) - 1.0 AS Pct1D,
            (AdjClose / NULLIF(LAG(AdjClose, 5) OVER (PARTITION BY Symbol ORDER BY Date), 0)) - 1.0 AS Pct5D,
            AVG(Volume) OVER (PARTITION BY Symbol ORDER BY Date ROWS BETWEEN 20 PRECEDING AND 1 PRECEDING) AS AvgVol20,
            AVG(AdjClose) OVER (PARTITION BY Symbol ORDER BY Date ROWS BETWEEN 19 PRECEDING AND CURRENT ROW) AS SMA20,
            AVG(AdjClose) OVER (PARTITION BY Symbol ORDER BY Date ROWS BETWEEN 49 PRECEDING AND CURRENT ROW) AS SMA50,
            AVG(AdjClose) OVER (PARTITION BY Symbol ORDER BY Date ROWS BETWEEN 199 PRECEDING AND CURRENT ROW) AS SMA200,
            CASE 
                WHEN ROW_NUMBER() OVER (PARTITION BY Symbol ORDER BY Date) >= 252 
                THEN MAX(AdjHigh) OVER (PARTITION BY Symbol ORDER BY Date ROWS BETWEEN 251 PRECEDING AND CURRENT ROW)
                ELSE NULL 
            END AS High52W,
            CASE 
                WHEN ROW_NUMBER() OVER (PARTITION BY Symbol ORDER BY Date) >= 252 
                THEN MIN(AdjLow) OVER (PARTITION BY Symbol ORDER BY Date ROWS BETWEEN 251 PRECEDING AND CURRENT ROW)
                ELSE NULL 
            END AS Low52W,
            AVG((AdjHigh - AdjLow)/NULLIF(AdjClose,0)) OVER (PARTITION BY Symbol ORDER BY Date ROWS BETWEEN 4 PRECEDING AND CURRENT ROW) AS ATR5,
            AVG((AdjHigh - AdjLow)/NULLIF(AdjClose,0)) OVER (PARTITION BY Symbol ORDER BY Date ROWS BETWEEN 19 PRECEDING AND CURRENT ROW) AS ATR20
        FROM adjusted_stocks
    )
    SELECT 
        Symbol, Date, Close, Volume, Turnover, Pct1D, Pct5D,
        CASE WHEN AdjHigh = AdjLow THEN 0.5 ELSE (AdjClose - AdjLow) / NULLIF(AdjHigh - AdjLow, 0) END AS CLV,
        Volume / NULLIF(AvgVol20, 0) AS RVOL,
        ATR5 / NULLIF(ATR20, 0) AS Compression,
        (symbol_day_count >= 200 AND AdjClose > SMA20 AND SMA20 > SMA50 AND SMA50 > SMA200) AS IsStage2,
        (High52W - AdjClose) / NULLIF(High52W, 0) * 100.0 AS Dist52W,
        (High52W IS NOT NULL AND AdjHigh >= High52W AND AdjHigh > Low52W AND (AdjLow > Low52W OR Pct1D >= 0)) AS IsNew52W_High,
        (Low52W IS NOT NULL AND AdjLow <= Low52W AND AdjLow < High52W AND NOT (High52W IS NOT NULL AND AdjHigh >= High52W AND AdjHigh > Low52W AND (AdjLow > Low52W OR Pct1D >= 0))) AS IsNew52W_Low
    FROM calculated
    WHERE Date >= '2015-01-01'
    ORDER BY Date ASC, Turnover DESC
    """
    
    print("Executing DuckDB query across historical Bhavcopies...")
    df = con.execute(query).pl()
    print(f"Loaded {len(df):,} stock-day records.")
    
    df = df.with_columns(pl.col("Date").dt.year().alias("Year"))
    years = sorted(df["Year"].unique().to_list())
    
    data_drilldown_dir = "data/drilldowns"
    web_drilldown_dir = "web/public/drilldowns"
    os.makedirs(data_drilldown_dir, exist_ok=True)
    os.makedirs(web_drilldown_dir, exist_ok=True)
    
    for yr in years:
        df_yr = df.filter(pl.col("Year") == yr)
        drill_yr = {}
        dates_in_yr = sorted(df_yr["Date"].unique().to_list())
        
        for d_val in dates_in_yr:
            d_str = str(d_val)
            sub = df_yr.filter(pl.col("Date") == d_val)
            
            # Base drilldown tuples: [Symbol, Close, Pct1D, Pct5D, Volume, TurnoverCr]
            def extract_tuples(sub_filtered, sort_col, desc=True):
                if len(sub_filtered) == 0:
                    return []
                res = sub_filtered.sort(sort_col, descending=desc).select([
                    pl.col("Symbol"),
                    pl.col("Close").round(2),
                    (pl.col("Pct1D") * 100).round(2),
                    (pl.col("Pct5D") * 100).round(2),
                    pl.col("Volume").fill_null(0),
                    (pl.col("Turnover") / 10000000.0).round(2)
                ])
                return [list(row) for row in res.iter_rows()]

            # Top Breakout Setup Candidates
            candidates = sub.filter(
                (pl.col("Turnover") >= 10000000) &
                ((pl.col("Pct1D") >= 0.035) | (pl.col("Pct5D") >= 0.15) | pl.col("IsNew52W_High"))
            )
            
            if len(candidates) > 0:
                cand_list = candidates.to_dicts()
                
                # Count theme & parent sector occurrences
                theme_counts = {}
                sector_counts = {}
                for c in cand_list:
                    sec, th = get_stock_taxonomy(c["Symbol"])
                    c["Sector"] = sec
                    c["Theme"] = th
                    if th != "Diversified":
                        theme_counts[th] = theme_counts.get(th, 0) + 1
                    if sec != "Diversified":
                        sector_counts[sec] = sector_counts.get(sec, 0) + 1
                
                top_setups = []
                for c in cand_list:
                    clv = float(c["CLV"]) if c["CLV"] is not None else 0.5
                    rvol = float(c["RVOL"]) if c["RVOL"] is not None else 1.0
                    comp = float(c["Compression"]) if c["Compression"] is not None else 1.0
                    stage2 = bool(c["IsStage2"]) if c["IsStage2"] is not None else False
                    dist52 = float(c["Dist52W"]) if c["Dist52W"] is not None else 20.0
                    sec = c["Sector"]
                    th = c["Theme"]
                    
                    # Dual-layer sympathy wave detection
                    is_theme_cluster = theme_counts.get(th, 0) >= 2
                    is_sec_cluster = sector_counts.get(sec, 0) >= 3
                    is_cluster = is_theme_cluster or is_sec_cluster
                    
                    score = compute_setup_score(clv, rvol, comp, stage2, dist52, is_cluster)
                    grade = classify_grade(score)
                    
                    if is_theme_cluster:
                        cluster_badge = f"🔥 {th} ({theme_counts[th]})"
                    elif is_sec_cluster:
                        cluster_badge = f"🔥 {sec} ({sector_counts[sec]})"
                    else:
                        cluster_badge = sec
                    
                    pct1d_val = float(c["Pct1D"]) * 100.0 if c["Pct1D"] is not None else 0.0
                    pct5d_val = float(c["Pct5D"]) * 100.0 if c["Pct5D"] is not None else 0.0

                    top_setups.append({
                        "symbol": c["Symbol"],
                        "close": round(float(c["Close"]), 2),
                        "pct1d": round(pct1d_val, 2),
                        "pct5d": round(pct5d_val, 2),
                        "turnover_cr": round(float(c["Turnover"]) / 10000000.0, 2),
                        "sector": sec,
                        "theme": th,
                        "cluster": cluster_badge,
                        "score": score,
                        "grade": grade,
                        "rvol": round(rvol, 1),
                        "clv": round(clv, 2)
                    })
                
                # Sort by score descending, then turnover descending
                top_setups.sort(key=lambda x: (x["score"], x["turnover_cr"]), reverse=True)
                top_setups = top_setups[:30]
            else:
                top_setups = []
            
            drill_yr[d_str] = {
                "up45": extract_tuples(sub.filter(pl.col("Pct1D") >= 0.045), "Pct1D", True),
                "down45": extract_tuples(sub.filter(pl.col("Pct1D") <= -0.045), "Pct1D", False),
                "up20_5d": extract_tuples(sub.filter(pl.col("Pct5D") >= 0.20), "Pct5D", True),
                "down20_5d": extract_tuples(sub.filter(pl.col("Pct5D") <= -0.20), "Pct5D", False),
                "high52w": extract_tuples(sub.filter(pl.col("IsNew52W_High")), "Pct1D", True),
                "low52w": extract_tuples(sub.filter(pl.col("IsNew52W_Low")), "Pct1D", False),
                "top_setups": top_setups
            }
            
        json_content = json.dumps(drill_yr, separators=(',', ':'))
        file_name = f"{yr}.json"
        with open(os.path.join(data_drilldown_dir, file_name), "w") as f:
            f.write(json_content)
        with open(os.path.join(web_drilldown_dir, file_name), "w") as f:
            f.write(json_content)
            
        print(f"  ✅ Generated enriched drilldown: {file_name} ({len(dates_in_yr)} sessions)")
        
    print("\n🎉 ALL DRILLDOWN YEARS SUCCESSFULLY REBUILT WITH 18 SECTORS & 74 THEMES!")

if __name__ == "__main__":
    generate_enriched_drilldowns()
