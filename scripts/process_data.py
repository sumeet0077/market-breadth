import polars as pl
import os
import glob
from datetime import datetime

DATA_DIR = "data/raw_bhavcopies"
OUTPUT_FILE = "data/master_bhavcopy.parquet"

def process_chunk(files):
    """
    Reads a list of CSV files and returns a combined polars DataFrame.
    """
    schema = {
        "SYMBOL": pl.Utf8, 
        " SERIES": pl.Utf8, # Note the space in original CSV header usually " SERIES" or "SERIES"
        " DATE1": pl.Utf8,  # " DATE1"
        " PREV_CLOSE": pl.Float64,
        " OPEN_PRICE": pl.Float64,
        " HIGH_PRICE": pl.Float64,
        " LOW_PRICE": pl.Float64,
        " CLOSE_PRICE": pl.Float64,
        " LAST_PRICE": pl.Float64,
        " AVG_PRICE": pl.Float64,
        " TTL_TRD_QNTY": pl.Int64, 
        " TURNOVER_LACS": pl.Float64,
        " NO_OF_TRADES": pl.Int64,
        " DELIV_QTY": pl.Utf8, # Often has failures to parse if not handled, keep as utf8 then cast
        " DELIV_PER": pl.Utf8
    }

    # Iterate and read carefully
    dfs = []
    
    # We need to inspect one file to be sure of headers, but typically sec_bhavdata_full has:
    # SYMBOL, SERIES, DATE1, PREV_CLOSE, OPEN_PRICE, HIGH_PRICE, LOW_PRICE, CLOSE_PRICE, LAST_PRICE, AVG_PRICE, TTL_TRD_QNTY, TURNOVER_LACS, NO_OF_TRADES, DELIV_QTY, DELIV_PER
    # There might be leading spaces in headers.
        
    for i, f in enumerate(files):
        try:
            # Lazy read is risky with varying headers, so eager read with robust settings
            # Using latin1 to avoid utf-8 errors
            df = pl.read_csv(f, ignore_errors=True, infer_schema_length=0, encoding="latin1") 
            
            # Normalize headers: strip whitespace
            df.columns = [c.strip() for c in df.columns]
            
            # Check if critical columns exist
            if "SERIES" not in df.columns or "SYMBOL" not in df.columns:
                print(f"Skipping {f}: Missing columns")
                continue

            # Cleanup String Columns
            df = df.with_columns([
                pl.col("SERIES").str.strip_chars(), 
                pl.col("SYMBOL").str.strip_chars()
            ])

            # Filter for Equity only (EQ, BE)
            df = df.filter(pl.col("SERIES").is_in(["EQ", "BE"]))
            
            # Parse Date
            df = df.with_columns(
                pl.col("DATE1").str.strptime(pl.Date, "%d-%b-%Y").alias("Date")
            )
            
            # Cast numerics
            cols_to_float = ["OPEN_PRICE", "HIGH_PRICE", "LOW_PRICE", "CLOSE_PRICE", "PREV_CLOSE"]
            for c in cols_to_float:
                # Handle potential whitespace or dashes in numeric columns
                df = df.with_columns(pl.col(c).str.strip_chars().cast(pl.Float64, strict=False))
                
            # Select relevant columns 
            df = df.select([
                pl.col("Date"),
                pl.col("SYMBOL").alias("Symbol"),
                pl.col("SERIES").alias("Series"),
                pl.col("OPEN_PRICE").alias("Open"),
                pl.col("HIGH_PRICE").alias("High"),
                pl.col("LOW_PRICE").alias("Low"),
                pl.col("CLOSE_PRICE").alias("Close"),
                pl.col("PREV_CLOSE").alias("PrevClose"),
                pl.col("TTL_TRD_QNTY").str.strip_chars().cast(pl.Float64, strict=False).alias("Volume"),
                pl.col("TURNOVER_LACS").str.strip_chars().cast(pl.Float64, strict=False).alias("Turnover")
            ])
            
            # if i % 100 == 0:
            #     print(f"Processed {i}/{len(files)}: {f} -> {len(df)} rows")
            
            dfs.append(df)
        except Exception as e:
            print(f"Error processing {f}: {e}")
            continue

    if not dfs:
        return None
        
    return pl.concat(dfs)


def main():
    print("Looking for CSV files...")
    files = glob.glob(os.path.join(DATA_DIR, "*.csv"))
    print(f"Found {len(files)} files.")
    
    if len(files) == 0:
        print("No files found. Run fetch_data.py first.")
        return

    # Process in chunks to avoid memory explosion if 3 years is huge (though 3 years daily is manageable in RAM usually ~1GB)
    # 3 years * 2000 stocks * 250 days = 1.5M rows. Tiny for Polars.
    
    df = process_chunk(files)
    
    if df is not None:
        # Sort
        df = df.sort(["Date", "Symbol"])
        
        # Deduplicate (in case overlapping files downloaded)
        df = df.unique(subset=["Date", "Symbol", "Series"])
        
        print(f"Saving {df.shape[0]} rows to {OUTPUT_FILE}...")
        df.write_parquet(OUTPUT_FILE)
        print("Done.")

if __name__ == "__main__":
    main()
