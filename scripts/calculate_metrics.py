import polars as pl
import duckdb
import os
import json
from datetime import datetime

INPUT_FILE = "data/parquet/master_copy.parquet"
OUTPUT_FILE = "data/market_breadth_metrics.parquet"

def calculate_stock_indicators(df):
    """
    Calculates rolling indicators for each stock.
    Returns the original DF with added columns.
    """
    print("Calculating rolling indicators (SMAs, Returns)...")
    
    # Schema Mapping: Master Parquet (lowercase) -> Metrics Logic (TitleCase)
    # Master: symbol, series, trade_date, open, high, low, close, ...
    
    # Rename columns if needed
    # We construct a map of what exists
    rename_map = {
        "symbol": "Symbol",
        "trade_date": "Date",
        "open": "Open",
        "high": "High",
        "low": "Low",
        "close": "Close",
        "prev_close": "PrevClose",
        "volume": "Volume"
    }
    
    valid_renames = {k: v for k, v in rename_map.items() if k in df.columns}
    if valid_renames:
        df = df.rename(valid_renames)
    
    # Ensure Date is Date type (it might be timestamp in master)
    df = df.with_columns(pl.col("Date").cast(pl.Date))

    # Filter to equity series (EQ, BE, BZ) to maintain series continuity across T2T transitions.
    # Excludes SME and non-equity debt instruments (SM, ST, GB, GS, etc.)
    series_col = "series" if "series" in df.columns else ("Series" if "Series" in df.columns else None)
    if series_col:
        before_count = len(df)
        df = df.filter(pl.col(series_col).is_in(["EQ", "BE", "BZ"]))
        after_count = len(df)
        print(f"Filtered to EQ/BE/BZ series: {before_count} -> {after_count} rows ({before_count - after_count} non-equity removed)")

    # Filter out ETFs and Rights Entitlements (-RE) using canonical registry and patterns
    try:
        from etf_util import filter_etfs_polars
    except ImportError:
        import sys
        sys.path.append(os.path.dirname(os.path.abspath(__file__)))
        from etf_util import filter_etfs_polars
    df = filter_etfs_polars(df, symbol_col="Symbol")

    # Deduplicate: sort by Symbol, Date, Volume DESC so the primary series is retained if both EQ and BE exist
    before_dedup = len(df)
    if "Volume" in df.columns:
        df = df.sort(["Symbol", "Date", "Volume"], descending=[False, False, True])
    else:
        df = df.sort(["Symbol", "Date"])
    df = df.unique(subset=["Symbol", "Date"], keep="first")
    df = df.sort(["Symbol", "Date"])
    after_dedup = len(df)
    if before_dedup != after_dedup:
        print(f"Deduplicated: {before_dedup} -> {after_dedup} rows ({before_dedup - after_dedup} duplicates removed)")

    # Apply corporate action backward cumulative adjustment factors
    try:
        from corporate_actions_util import apply_corporate_actions_polars
    except ImportError:
        import sys
        sys.path.append(os.path.dirname(os.path.abspath(__file__)))
        from corporate_actions_util import apply_corporate_actions_polars
    df = apply_corporate_actions_polars(df)
    
    # Window operations needed:
    # 1. Seasoning count per symbol
    # 2. Split-adjusted 1D and 5D returns (with PrevClose fallback for listing days)
    # 3. SMAs: 20, 50, 200 on AdjClose
    # 4. New Highs/Lows: Rolling Max/Min 252 days on AdjHigh/AdjLow with >= 252 day seasoning
    
    df = df.with_columns([
        pl.int_range(1, pl.len() + 1).over("Symbol").alias("symbol_day_count"),
        pl.col("AdjClose").shift(1).over("Symbol").alias("Prev_AdjClose"),
        pl.col("AdjClose").shift(5).over("Symbol").alias("Prev_AdjClose5"),
    ])

    df = df.with_columns([
        # Returns
        pl.when(pl.col("Prev_AdjClose").is_not_null())
          .then(pl.col("AdjClose") / pl.col("Prev_AdjClose") - 1.0)
          .otherwise(
              pl.when(pl.col("PrevClose").is_not_null() & (pl.col("PrevClose") > 0))
                .then(pl.col("Close") / pl.col("PrevClose") - 1.0)
                .otherwise(None)
          ).alias("PctChange1D"),
        (pl.col("AdjClose") / pl.col("Prev_AdjClose5") - 1.0).alias("PctChange5D"),
        
        # SMAs on AdjClose
        pl.col("AdjClose").rolling_mean(window_size=20).over("Symbol").alias("SMA20"),
        pl.col("AdjClose").rolling_mean(window_size=50).over("Symbol").alias("SMA50"),
        pl.col("AdjClose").rolling_mean(window_size=200).over("Symbol").alias("SMA200"),
        
        # 52 Week High/Low (252 trading days) with strict >= 252 session seasoning check
        pl.when(pl.col("symbol_day_count") >= 252)
          .then(pl.col("AdjHigh").rolling_max(window_size=252).over("Symbol"))
          .otherwise(None)
          .alias("High52W"),
        pl.when(pl.col("symbol_day_count") >= 252)
          .then(pl.col("AdjLow").rolling_min(window_size=252).over("Symbol"))
          .otherwise(None)
          .alias("Low52W"),
        
        # Volume Spike
        pl.col("Volume").rolling_mean(window_size=20).over("Symbol").alias("AvgVol20")
    ])
    
    # Derived Boolean Flags with Mutual Exclusion and Seasoning
    is_high_cond = (
        pl.col("High52W").is_not_null() & 
        (pl.col("AdjHigh") >= pl.col("High52W")) & 
        (pl.col("AdjHigh") > pl.col("Low52W")) & 
        ((pl.col("AdjLow") > pl.col("Low52W")) | (pl.col("PctChange1D") >= 0))
    )
    is_low_cond = (
        pl.col("Low52W").is_not_null() & 
        (pl.col("AdjLow") <= pl.col("Low52W")) & 
        (pl.col("AdjLow") < pl.col("High52W")) & 
        (~is_high_cond)
    )
    df = df.with_columns([
        is_high_cond.alias("IsNew52W_High"),
        is_low_cond.alias("IsNew52W_Low")
    ])
    
    return df

def calculate_breadth_aggregates(df):
    """
    Aggregates daily statistics across the market.
    """
    print("Aggregating daily market breadth...")
    
    # Aggregate by Date
    daily_stats = df.group_by("Date").agg([
        pl.len().alias("TotalTraded"),
        
        # 1. Stocks up 4.5%+
        (pl.col("PctChange1D") >= 0.045).sum().alias("No. of stocks up 4.5%+ in the current day"),
        
        # 2. Stocks down 4.5%+
        (pl.col("PctChange1D") <= -0.045).sum().alias("No. of stocks down 4.5%+ in the current day"),
        
        # 3. Up 20% in 5 days
        (pl.col("PctChange5D") >= 0.20).sum().alias("No. of stocks up 20%+ in 5 days"),
        
        # 4. Down 20% in 5 days
        (pl.col("PctChange5D") <= -0.20).sum().alias("No. of stocks down 20%+ in 5 days"),
        
        # 5. SMA Counts (requiring non-null SMA values; no fill_null(0))
        ((pl.col("SMA200").is_not_null()) & (pl.col("AdjClose") > pl.col("SMA200"))).sum().alias("No of stocks above 200 day SMA"),
        ((pl.col("SMA50").is_not_null()) & (pl.col("AdjClose") > pl.col("SMA50"))).sum().alias("No of stocks above 50 day SMA"),
        ((pl.col("SMA20").is_not_null()) & (pl.col("AdjClose") > pl.col("SMA20"))).sum().alias("No of stocks above 20 day SMA"),
        ((pl.col("SMA200").is_not_null()) & (pl.col("SMA50").is_not_null()) & (pl.col("SMA20").is_not_null()) & 
         (pl.col("AdjClose") > pl.col("SMA200")) & (pl.col("AdjClose") > pl.col("SMA50")) & (pl.col("AdjClose") > pl.col("SMA20"))).sum().alias("No of stocks above all 3 SMAs"),
        
        # 6. Market Breadth
        (pl.col("PctChange1D") > 0).sum().alias("No of stocks which are positive"),
        (pl.col("PctChange1D") < 0).sum().alias("No of stocks which are negative"),
        
        # 7. Highs/Lows
        pl.col("IsNew52W_High").sum().alias("New52W_Highs"),
        pl.col("IsNew52W_Low").sum().alias("New52W_Lows")
    ])
    
    # Post-aggregation metrics
    daily_stats = daily_stats.with_columns([
        (pl.col("No of stocks which are positive") / pl.col("No of stocks which are negative")).alias("Advance/Decline Ratio"),
        (pl.col("New52W_Highs").cast(pl.Int64) - pl.col("New52W_Lows").cast(pl.Int64)).alias("Net New Highs")
    ])
    
    # Select and Reorder columns precisely (retaining New52W_Highs and New52W_Lows)
    final_cols = [
        "Date",
        "No. of stocks up 4.5%+ in the current day",
        "No. of stocks down 4.5%+ in the current day",
        "No. of stocks up 20%+ in 5 days",
        "No. of stocks down 20%+ in 5 days",
        "No of stocks above 200 day SMA",
        "No of stocks above 50 day SMA",
        "No of stocks above 20 day SMA",
        "No of stocks above all 3 SMAs",
        "No of stocks which are positive",
        "No of stocks which are negative",
        "Advance/Decline Ratio",
        "Net New Highs",
        "New52W_Highs",
        "New52W_Lows",
        "TotalTraded"
    ]
    
    # Filter for display (User wants to see 2015 onwards to ensure 200SMA is valid)
    daily_stats = daily_stats.filter(pl.col("Date") >= datetime(2015, 1, 1))

    return daily_stats.select(final_cols).sort("Date")

def generate_annual_drilldowns(df):
    """
    Generates compact annual JSON files containing stock-level drilldown data.
    Tuples schema: [Symbol, Close, Pct1D, Pct5D, Volume]
    """
    print("Generating annual drilldown JSON datasets...")
    data_drilldown_dir = "data/drilldowns"
    web_drilldown_dir = "web/public/drilldowns"
    os.makedirs(data_drilldown_dir, exist_ok=True)
    os.makedirs(web_drilldown_dir, exist_ok=True)
    
    # Filter for display (2015 onwards)
    df_filtered = df.filter(pl.col("Date") >= datetime(2015, 1, 1))
    
    # Extract unique years
    df_filtered = df_filtered.with_columns(pl.col("Date").dt.year().alias("Year"))
    years = sorted(df_filtered["Year"].unique().to_list())
    
    for yr in years:
        df_yr = df_filtered.filter(pl.col("Year") == yr)
        drill_yr = {}
        
        for d_val in df_yr["Date"].unique().sort():
            sub = df_yr.filter(pl.col("Date") == d_val)
            d_str = str(d_val)
            
            def extract_tuples(sub_filtered, sort_col, desc=True):
                if len(sub_filtered) == 0:
                    return []
                res = sub_filtered.sort(sort_col, descending=desc).select([
                    pl.col("Symbol"),
                    pl.col("Close").round(2),
                    (pl.col("PctChange1D") * 100).round(2),
                    (pl.col("PctChange5D") * 100).round(2),
                    pl.col("Volume").fill_null(0),
                    (pl.col("Close") * pl.col("Volume") / 10000000.0).round(2)
                ])
                return [list(row) for row in res.iter_rows()]

            drill_yr[d_str] = {
                "up45": extract_tuples(sub.filter(pl.col("PctChange1D") >= 0.045), "PctChange1D", True),
                "down45": extract_tuples(sub.filter(pl.col("PctChange1D") <= -0.045), "PctChange1D", False),
                "up20_5d": extract_tuples(sub.filter(pl.col("PctChange5D") >= 0.20), "PctChange5D", True),
                "down20_5d": extract_tuples(sub.filter(pl.col("PctChange5D") <= -0.20), "PctChange5D", False),
                "high52w": extract_tuples(sub.filter(pl.col("IsNew52W_High")), "PctChange1D", True),
                "low52w": extract_tuples(sub.filter(pl.col("IsNew52W_Low")), "PctChange1D", False),
                "top_setups": []
            }
            
        json_content = json.dumps(drill_yr, separators=(',', ':'))
        
        file_name = f"{yr}.json"
        data_path = os.path.join(data_drilldown_dir, file_name)
        web_path = os.path.join(web_drilldown_dir, file_name)
        
        with open(data_path, "w") as f:
            f.write(json_content)
        with open(web_path, "w") as f:
            f.write(json_content)
            
    print(f"Generated drilldown files for {len(years)} years ({years[0]}-{years[-1]}).")

def main():
    # Input is a directory (Partitioned Parquet)
    # DuckDB handles partitioned reads and schema merging natively
    input_path = os.path.join(INPUT_FILE, "**/*.parquet")
    
    if not os.path.exists(INPUT_FILE):
         print(f"Input directory {INPUT_FILE} not found. Run ingest_daily.py first.")
         return

    print(f"Reading from {input_path} using DuckDB...")
    
    try:
        # Use DuckDB read_parquet with union_by_name to handle schema evolution
        # This handles the UInt32 vs UInt64 mismatch automatically
        df = duckdb.sql(f"SELECT * FROM read_parquet('{input_path}', union_by_name=true)").pl()
    except Exception as e:
        print(f"Failed to read parquet with DuckDB: {e}")
        return

    print(f"Loaded {len(df)} rows.")
    
    # 1. Calc Indicators
    df_ind = calculate_stock_indicators(df)
    
    # 2. Aggregates
    df_agg = calculate_breadth_aggregates(df_ind)
    
    # 3. Drilldowns (Enriched Annual Partitioned JSONs with Sector Clusters & Setups)
    try:
        from enrich_sector_setups import generate_enriched_drilldowns
        generate_enriched_drilldowns()
    except Exception as e:
        print(f"Fallback to base drilldowns: {e}")
        generate_annual_drilldowns(df_ind)
    
    # Save Parquet
    print(f"Saving metrics to {OUTPUT_FILE}...")
    df_agg.write_parquet(OUTPUT_FILE)
    
    # Save JSON for Frontend (Next.js)
    json_path = "data/market_breadth.json"
    print(f"Exporting JSON to {json_path}...")
    df_agg.write_json(json_path)
    
    print("Done.")

if __name__ == "__main__":
    main()
