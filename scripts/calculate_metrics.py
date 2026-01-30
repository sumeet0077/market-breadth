import polars as pl
import os

INPUT_FILE = "data/master_bhavcopy.parquet"
OUTPUT_FILE = "data/market_breadth_metrics.parquet"

def calculate_stock_indicators(df):
    """
    Calculates rolling indicators for each stock.
    Returns the original DF with added columns.
    """
    print("Calculating rolling indicators (SMAs, Returns)...")
    
    # Sort just in case
    df = df.sort(["Symbol", "Date"])
    
    # Window operations needed:
    # 1. 5-day Return: (Close / Close_lag_5) - 1
    # 2. SMAs: 20, 50, 200
    # 3. New Highs/Lows: Rolling Max/Min 252 days (1 year approx)
    
    # We use 'over("Symbol")' to partition operations
    
    df = df.with_columns([
        # Returns
        (pl.col("Close") / pl.col("Close").shift(1).over("Symbol") - 1).alias("PctChange1D"),
        (pl.col("Close") / pl.col("Close").shift(5).over("Symbol") - 1).alias("PctChange5D"),
        
        # SMAs
        pl.col("Close").rolling_mean(window_size=20).over("Symbol").alias("SMA20"),
        pl.col("Close").rolling_mean(window_size=50).over("Symbol").alias("SMA50"),
        pl.col("Close").rolling_mean(window_size=200).over("Symbol").alias("SMA200"),
        
        # 52 Week High/Low (approx 252 trading days)
        pl.col("High").rolling_max(window_size=252).over("Symbol").alias("High52W"),
        pl.col("Low").rolling_min(window_size=252).over("Symbol").alias("Low52W"),
        
        # Volume Spike
        pl.col("Volume").rolling_mean(window_size=20).over("Symbol").alias("AvgVol20")
    ])
    
    # Derived Boolean Flags (Pre-calculate for fast aggregation)
    # Using raw numbers is fine, but boolean cols help in aggregations
    
    return df

def calculate_breadth_aggregates(df):
    """
    Aggregates daily statistics across the market.
    """
    print("Aggregating daily market breadth...")
    
    # Filter for active trading days only? ensure date links
    
    # Conditions
    # 1. Up 4.5%
    # 2. Down 4.5%
    # 3. Up 20% in 5D
    # 4. Down 20% in 5D
    # 5. Above SMA 20, 50, 200
    # 6. Positive/Negative
    # 7. New Highs/Lows (Close > High52W prev day? using High/Low)
    #    Strictly speaking, "New High" is when High >= High52W. 
    #    Or commonly, High > Prev_High52W. 
    #    Let's use High == High52W for simplicity, or High >= rolling_max(252)
    
    # Aggregate by Date
    daily_stats = df.group_by("Date").agg([
        pl.len().alias("TotalTraded"),
        
        # 1. Stocks up 4.5%+
        (pl.col("PctChange1D") >= 0.045).sum().alias("No. of stocks up 4.5%+ in the current day"),
        
        # 2. Stocks down 4.5%+
        (pl.col("PctChange1D") <= -0.045).sum().alias("No. of stocs down 4.5%+ in the current day"),
        
        # 3. Up 20% in 5 days
        (pl.col("PctChange5D") >= 0.20).sum().alias("No. of stocks up 20%+ in 5 days"),
        
        # 4. Down 20% in 5 days
        (pl.col("PctChange5D") <= -0.20).sum().alias("No. of stocks down 20%+ in 5 days"),
        
        # 5. Above SMA 200
        (pl.col("Close") > pl.col("SMA200")).sum().alias("No of stocks above 200 day simple moving average"),
        
        # 6. Above SMA 50
        (pl.col("Close") > pl.col("SMA50")).sum().alias("No of stocks above 50 day simple moving average"),
        
        # 7. Above SMA 20
        (pl.col("Close") > pl.col("SMA20").fill_null(0)).sum().alias("No of stocks above 20 day simple moving average"),
        
        # 8. Positive
        (pl.col("PctChange1D") > 0).sum().alias("No of stocks which are positive"),
        
        # 9. Negative
        (pl.col("PctChange1D") < 0).sum().alias("No of stocks which are negative"),
        
        # 11. Net New Highs components
        (pl.col("High") >= pl.col("High52W")).sum().alias("New52W_Highs"),
        (pl.col("Low") <= pl.col("Low52W")).sum().alias("New52W_Lows"),
    ])
    
    # Post-aggregation metrics
    daily_stats = daily_stats.with_columns([
        (pl.col("No of stocks which are positive") / pl.col("No of stocks which are negative")).alias("Advance/Decline Ratio"),
        (pl.col("New52W_Highs").cast(pl.Int64) - pl.col("New52W_Lows").cast(pl.Int64)).alias("Net New Highs")
    ])

    daily_stats = daily_stats.with_columns([
        ((pl.col("Net New Highs") / pl.col("TotalTraded")) * 100).alias("Net New 52-Week Highs as % of Total Stocks")
    ])
    
    return daily_stats.sort("Date")

def main():
    if not os.path.exists(INPUT_FILE):
        print(f"Input {INPUT_FILE} not found. Run process_data.py first.")
        return

    df = pl.read_parquet(INPUT_FILE)
    print(f"Loaded {len(df)} rows.")
    
    # 1. Calc Indicators
    df_ind = calculate_stock_indicators(df)
    
    # 2. Aggregates
    df_agg = calculate_breadth_aggregates(df_ind)
    
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
