import duckdb
import os
import glob
import shutil
from datetime import datetime, timedelta

# Config
DATA_DIR = "data/raw_bhavcopies"
PARQUET_DIR = "data/parquet"
METRICS_DB = "market.duckdb"

def ingest_daily(daily_file=None):
    """
    Ingests a single CSV file into the partitioned Parquet dataset.
    If no file is provided, it defaults to the latest available file in the data dir.
    """
    print("Starting Daily Ingestion...")
    con = duckdb.connect(METRICS_DB)
    
    try:
        # 1. Identify File
        if not daily_file:
            # Find latest file if not provided
            list_of_files = glob.glob(f'{DATA_DIR}/*.csv') 
            if not list_of_files:
                print("No CSV files found.")
                return
            daily_file = max(list_of_files, key=os.path.getctime)
        
        print(f"Ingesting: {daily_file}")
        
        # 2. Define Schema
        column_spec = {
            'Symbol': 'VARCHAR',
            'Series': 'VARCHAR',
            'DateStr': 'VARCHAR',
            'PrevClose': 'DOUBLE',
            'Open': 'DOUBLE',
            'High': 'DOUBLE',
            'Low': 'DOUBLE',
            'Last': 'DOUBLE',
            'Close': 'DOUBLE',
            'AvgPrice': 'DOUBLE',
            'Volume': 'BIGINT',
            'Turnover': 'DOUBLE',
            'Trades': 'BIGINT',
            'DelivQty': 'VARCHAR', 
            'DelivPer': 'VARCHAR'
        }

        # 3. Read CSV with Robust Settings
        query_view = f"""
            CREATE OR REPLACE TEMP VIEW daily_source AS 
            SELECT * FROM read_csv('{daily_file}',
                header=True, 
                auto_detect=False, 
                columns={column_spec}, 
                encoding='utf-8',
                ignore_errors=True
            )
        """
        con.execute(query_view)
        
        # 3.5 Idempotency Check
        try:
            # Extract date from the file being ingested
            date_check_query = "SELECT DISTINCT strptime(TRIM(DateStr), '%d-%b-%Y') FROM daily_source LIMIT 1"
            ingest_date = con.execute(date_check_query).fetchone()
            
            if ingest_date and ingest_date[0]:
                check_date = ingest_date[0]
                print(f"Checking for existing data on {check_date}...")
                
                # Check if local master exists and contains this date
                local_master_check = "data/parquet/master_copy.parquet"
                if os.path.exists(local_master_check):
                    # Use TRY/CATCH logic implicitly via count
                    # DuckDB GLOB works on files
                    count_query = f"SELECT count(*) FROM '{local_master_check}/**/*.parquet' WHERE trade_date = ?"
                    try:
                        existing_count = con.execute(count_query, [check_date]).fetchone()[0]
                        if existing_count > 0:
                            print(f"Data for {check_date} already exists ({existing_count} rows). Skipping ingestion.")
                            con.close()
                            return
                    except Exception as e:
                        # Table might not exist or schema mismatch, proceed safely
                        print(f"Warning during idempotency check: {e}. Proceeding with ingestion.")
        except Exception as e:
             print(f"Skipping idempotency check due to error: {e}")

        # 4. Copy-on-Write Logic
        # We maintain a local copy to avoid modifying the original Shortcut
        original_master = "NSE Master parquet/nse_master_adjusted_2014_onwards.parquet"
        local_master = "data/parquet/master_copy.parquet"
        
        # Initialize Local Copy if missing
        if not os.path.exists(local_master):
            print(f"Initializing local copy from {original_master}...")
            if os.path.isdir(original_master):
                 try:
                    shutil.copytree(original_master, local_master)
                 except Exception as e:
                     print(f"Failed to copy master: {e}")
                     return
            else:
                 os.makedirs(os.path.dirname(local_master), exist_ok=True)
                 shutil.copy2(original_master, local_master)
        
        # 5. Append to Local Master Copy
        query_insert = f"""
            COPY (
                SELECT 
                    TRIM(Symbol) as symbol,
                    TRIM(Series) as series,
                    strptime(TRIM(DateStr), '%d-%b-%Y') as trade_date,
                    Open as open,
                    High as high,
                    Low as low,
                    Close as close,
                    Last as last,
                    PrevClose as prev_close,
                    Volume as volume,
                    Turnover as turnover,
                    Trades as trades,
                    TRY_CAST(TRIM(DelivQty) AS DOUBLE) as deliv_qty,
                    TRY_CAST(TRIM(DelivPer) AS DOUBLE) as deliv_pct,
                    NULL as source_url,
                    Close as adjusted_close, -- Default until adjustment logic
                    year(strptime(TRIM(DateStr), '%d-%b-%Y')) as year
                FROM daily_source
                WHERE TRIM(Series) IN ('EQ', 'BE')
            ) TO '{local_master}' (FORMAT PARQUET, PARTITION_BY (year), OVERWRITE_OR_IGNORE 1)
        """
        
        con.execute(query_insert)
        print(f"Successfully appended {daily_file} to {local_master}")
        
    except Exception as e:
        print(f"Ingestion Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        con.close()

if __name__ == "__main__":
    import sys
    # Allow passing file path as argument
    if len(sys.argv) > 1:
        ingest_daily(sys.argv[1])
    else:
        ingest_daily()
