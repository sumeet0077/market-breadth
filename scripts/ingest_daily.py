import duckdb
import os
import glob
import shutil
from datetime import datetime, timedelta

# Config
DATA_DIR = "data/raw_bhavcopies"
PARQUET_DIR = "data/parquet"
METRICS_DB = "market.duckdb"

def ingest_single_file(con, daily_file):
    """Ingests a single CSV file into the partitioned Parquet dataset."""
    print(f"Ingesting: {daily_file}")
    
    try:
        # 1. Define Schema
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

        # 2. Read CSV with Robust Settings
        query_view = f"""
            CREATE OR REPLACE TEMP VIEW daily_source AS 
            SELECT * FROM read_csv('{daily_file}',
                header=True, 
                auto_detect=False, 
                columns={column_spec}, 
                encoding='utf-8',
                ignore_errors=True,
                strict_mode=False
            )
        """
        con.execute(query_view)
        
        # 3. Idempotency Check
        try:
            # Extract date from the file being ingested
            date_check_query = "SELECT DISTINCT strptime(TRIM(DateStr), '%d-%b-%Y') FROM daily_source LIMIT 1"
            ingest_date = con.execute(date_check_query).fetchone()
            
            if ingest_date and ingest_date[0]:
                check_date = ingest_date[0]
                # Log filename date vs internal date
                filename = os.path.basename(daily_file)
                print(f"File: {filename} | Internal Date: {check_date.date()}")
                
                # Check if local master exists and contains this date
                local_master_check = "data/parquet/master_copy.parquet"
                if os.path.exists(local_master_check):
                    count_query = f"SELECT count(*) FROM '{local_master_check}/**/*.parquet' WHERE trade_date = ?"
                    try:
                        existing_count = con.execute(count_query, [check_date]).fetchone()[0]
                        if existing_count > 0:
                            print(f"  --> Data for {check_date.date()} already exists. Skipping.")
                            return
                    except Exception as e:
                        print(f"Warning during idempotency check: {e}. Proceeding.")
        except Exception as e:
             print(f"Skipping idempotency check: {e}")

        # 4. Copy-on-Write Logic
        original_master = "NSE Master parquet/nse_master_adjusted_2014_onwards.parquet"
        local_master = "data/parquet/master_copy.parquet"
        
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
            ) TO '{local_master}' (FORMAT PARQUET, PARTITION_BY (year), FILENAME_PATTERN 'daily_{{uuid}}', OVERWRITE_OR_IGNORE 1)
        """
        
        con.execute(query_insert)
        print(f"Successfully appended {daily_file} to {local_master}")
        
    except Exception as e:
        print(f"Ingestion Error for {daily_file}: {e}")
        import traceback
        traceback.print_exc()

def ingest_daily(daily_file=None):
    """
    Ingests one or all CSV files into the partitioned Parquet dataset.
    If no file is provided, it processes ALL available files in chronological order 
    (relying on idempotency to skip existing ones).
    """
    print("Starting Daily Ingestion...")
    con = duckdb.connect(METRICS_DB)
    
    try:
        if daily_file:
            ingest_single_file(con, daily_file)
        else:
            list_of_files = glob.glob(f'{DATA_DIR}/*.csv') 
            if not list_of_files:
                print("No CSV files found.")
                return
            
            # Sort files by modification time (oldest to newest) to process chronologically
            list_of_files.sort(key=os.path.getctime)
            
            print(f"Found {len(list_of_files)} CSV files. Processing sequentially...")
            for f in list_of_files:
                ingest_single_file(con, f)
                
    finally:
        con.close()

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        ingest_daily(sys.argv[1])
    else:
        ingest_daily()
