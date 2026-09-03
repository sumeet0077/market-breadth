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
        
        # 6. Automated Corporate Action Detection
        detect_and_register_corporate_actions(con, local_master)
        
    except Exception as e:
        print(f"Ingestion Error for {daily_file}: {e}")
        import traceback
        traceback.print_exc()

def detect_and_register_corporate_actions(con, local_master="data/parquet/master_copy.parquet"):
    """
    Scans daily_source for large overnight drops (Close / PrevClose <= 0.72)
    and checks against 20D average volume to detect standard splits and bonus issues.
    Automatically registers newly detected actions in data/corporate_actions.json.
    """
    import json
    ca_path = os.path.join(os.path.dirname(__file__), "..", "data", "corporate_actions.json")
    if not os.path.exists(ca_path):
        ca_path = "data/corporate_actions.json"
        
    existing_actions = []
    if os.path.exists(ca_path):
        try:
            with open(ca_path, "r") as f:
                existing_actions = json.load(f)
        except Exception:
            existing_actions = []

    existing_keys = {(a['symbol'].strip().upper(), a['ex_date']) for a in existing_actions}
    
    query = """
    WITH daily_candidates AS (
        SELECT 
            TRIM(Symbol) as symbol,
            TRIM(Series) as series,
            strptime(TRIM(DateStr), '%d-%b-%Y')::DATE as trade_date,
            PrevClose as prev_close,
            Close as close,
            Volume as volume,
            (Close / NULLIF(PrevClose, 0)) as drop_ratio
        FROM daily_source
        WHERE TRIM(Series) IN ('EQ', 'BE')
          AND PrevClose IS NOT NULL 
          AND PrevClose > 0
          AND (Close / NULLIF(PrevClose, 0)) <= 0.72
    )
    SELECT symbol, trade_date, prev_close, close, volume, drop_ratio
    FROM daily_candidates
    """
    try:
        candidates = con.execute(query).fetchall()
    except Exception as e:
        print(f"Corporate action detection query error: {e}")
        return

    new_actions = []
    for row in candidates:
        sym, t_date, prev_c, close_c, vol, r = row
        sym_clean = sym.strip().upper()
        date_str = str(t_date)
        
        if (sym_clean, date_str) in existing_keys:
            continue
            
        # Check volume against 20-day average volume in historical master
        vol_query = f"""
            SELECT AVG(volume) FROM '{local_master}/**/*.parquet'
            WHERE symbol = ? AND trade_date < ? AND trade_date >= ? - INTERVAL 45 DAYS
        """
        try:
            avg_vol_res = con.execute(vol_query, [sym_clean, t_date, t_date]).fetchone()
            avg_vol = avg_vol_res[0] if avg_vol_res and avg_vol_res[0] else 0
        except Exception:
            avg_vol = 0
            
        if avg_vol > 0 and vol < (1.5 * avg_vol):
            continue
            
        action_type = None
        ratio = None
        desc = None
        
        # Match standard split / bonus ratios
        if 0.07 <= r <= 0.13:
            action_type, ratio, desc = "SPLIT", 10.0, "10:1 Stock Split (auto-detected)"
        elif 0.17 <= r <= 0.23:
            action_type, ratio, desc = "SPLIT", 5.0, "5:1 Stock Split (auto-detected)"
        elif 0.23 < r <= 0.28:
            action_type, ratio, desc = "SPLIT", 4.0, "4:1 Stock Split (auto-detected)"
        elif 0.30 <= r <= 0.36:
            action_type, ratio, desc = "BONUS", 3.0, "2:1 Bonus Issue (auto-detected)"
        elif 0.37 <= r <= 0.44:
            action_type, ratio, desc = "SPLIT", 2.5, "5:2 Stock Split (auto-detected)"
        elif 0.46 <= r <= 0.54:
            action_type, ratio, desc = "SPLIT", 2.0, "2:1 Stock Split (auto-detected)"
        elif 0.62 <= r <= 0.70:
            action_type, ratio, desc = "BONUS", 1.5, "1:2 Bonus Issue (auto-detected)"
            
        if action_type and ratio:
            new_record = {
                "symbol": sym_clean,
                "ex_date": date_str,
                "action": action_type,
                "ratio": ratio,
                "description": desc
            }
            existing_actions.append(new_record)
            existing_keys.add((sym_clean, date_str))
            new_actions.append(new_record)
            print(f"  🔍 [AUTO-DETECT] Detected corporate action for {sym_clean}: {action_type} {ratio}x on {date_str} (drop ratio: {r:.3f})")

    if new_actions:
        existing_actions.sort(key=lambda x: (x.get('ex_date', ''), x.get('symbol', '')))
        with open(ca_path, "w") as f:
            json.dump(existing_actions, f, indent=2)
        print(f"  📝 Saved {len(new_actions)} newly detected corporate action(s) to {ca_path}")

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
