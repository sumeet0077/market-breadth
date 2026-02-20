import duckdb
import pandas as pd
from datetime import datetime, date, timedelta
import os
import sys

# Import functions from existing scripts
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
try:
    from fetch_data import download_file, DATA_DIR
    from ingest_daily import ingest_daily
except ImportError as e:
    print(f"Error importing modules: {e}")
    sys.exit(1)

def heal_data():
    print("Connecting to database to find missing dates...")
    con = duckdb.connect("market.duckdb")
    
    # 1. Get existing dates since 2021
    # We restrict to 2021+ because older data may not be available at the sec_bhavdata_full URLs
    query = """
    SELECT DISTINCT trade_date::DATE 
    FROM 'data/parquet/master_copy.parquet/**/*.parquet' 
    WHERE trade_date >= '2021-01-01'
    """
    
    try:
        existing_rows = con.execute(query).fetchall()
        existing_dates = {row[0] for row in existing_rows}
    except Exception as e:
        print(f"Failed to query Parquet dataset: {e}")
        con.close()
        return

    con.close()
    
    # 2. Generate expected business days (Mon-Fri)
    today = datetime.now().date()
    yesterday = today - timedelta(days=1)
    
    # bdate_range ignores weekends
    expected_dates_index = pd.bdate_range(start="2021-01-01", end=yesterday)
    expected_dates = {d.date() for d in expected_dates_index}
    
    # 3. Find missing dates
    missing_dates = sorted(list(expected_dates - existing_dates))
    
    if not missing_dates:
        print("Dataset is perfectly intact. No missing business days found since Jan 2021.")
        return
        
    print(f"Found {len(missing_dates)} potential missing dates (including market holidays).")
    
    # 4. Attempt to fetch missing dates
    # `download_file` handles 404s for holidays naturally.
    downloaded_count = 0
    for d in missing_dates:
        dt_obj = datetime.combine(d, datetime.min.time())
        print(f"Checking missing date: {d}...", end=" ")
        result = download_file(dt_obj)
        print(result)
        
        if "Downloaded" in result:
            downloaded_count += 1
            
    # 5. Run ingestion and recalculate if new data was found
    if downloaded_count > 0:
        print(f"\nSuccessfully recovered {downloaded_count} missing days! Running daily ingestion...")
        ingest_daily()
        
        print("\nRecalculating metrics...")
        os.system(f"{sys.executable} scripts/calculate_metrics.py")
        print("Healing complete.")
    else:
        print("\nNo new data downloaded. The missing dates are likely all market holidays.")


if __name__ == "__main__":
    heal_data()
