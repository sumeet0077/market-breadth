import duckdb
import glob
import os
import shutil

# Config
DATA_DIR = "data/raw_bhavcopies"
PARQUET_DIR = "data/parquet"
DB_PATH = "market.duckdb"

def init_db():
    print("Initializing DuckDB migration...")
    
    # 1. Setup Directories
    if os.path.exists(PARQUET_DIR):
        try:
            shutil.rmtree(PARQUET_DIR)
        except:
            pass
    os.makedirs(PARQUET_DIR, exist_ok=True)
    
    # Use in-memory validation first
    con = duckdb.connect()
    
    columns = {
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
    
    print("Validating CSV files...")
    files = glob.glob(f"{DATA_DIR}/*.csv")
    valid_files = []

    print(f"Checking {len(files)} files...")

    # Force check specific file first to match test_duck_2
    target = os.path.join(DATA_DIR, "sec_bhavdata_full_01012021.csv")
    if target in files:
        files.remove(target)
        files.insert(0, target)

    for f in files:
        query = f"""
            SELECT 
                strptime(DateStr, '%d-%b-%Y')::DATE as Date,
                Symbol
            FROM read_csv('{f}', 
                header=True, 
                auto_detect=False, 
                columns={columns}, 
                encoding='utf-8'
            )
            LIMIT 1
        """
        
        try:
            con.execute(query).fetchall()
            valid_files.append(f)
        except Exception as e:
            err_msg = str(e).split('\n')[0]
            print(f"Skipping bad file: {os.path.basename(f)} - {err_msg}")

    print(f"Found {len(valid_files)} valid files out of {len(files)}")
    
    if not valid_files:
        print("No valid files found. Aborting.")
        return

    # 4. Bulk Migration via Python API -> View -> Copy
    print("Starting Bulk Migration...")
    
    try:
        # For bulk read, we need to pass the list of files to read_csv
        # But we need to ensure the options match (header, columns, encoding)
        
        # We can create a view from the list of files
        files_list_str = "[" + ", ".join([f"'{f}'" for f in valid_files]) + "]"
        
        # DuckDB read_csv can take a list of files.
        # But we need to construct the SQL query because Python API read_csv was flaky?
        # No, Python API read_csv FAILED earlier.
        # So we MUST use con.execute with SQL.
        
        # Construct the read_csv SQL function call with the list of files
        # NOTE: read_csv(['f1', 'f2']) syntax in SQL?
        # Yes, read_csv(['file1', 'file2'], ...) is valid DuckDB SQL.
        
        create_view_query = f"""
            CREATE OR REPLACE TEMP VIEW source_data AS 
            SELECT * FROM read_csv({files_list_str},
                header=True,
                auto_detect=False,
                columns={columns},
                encoding='utf-8',
                union_by_name=True,
                filename=True,
                ignore_errors=True,
                null_padding=True
            );
        """
        
        con.execute(create_view_query)
        
        query = f"""
            COPY (
                SELECT 
                    strptime(DateStr, '%d-%b-%Y')::DATE as Date,
                    year(strptime(DateStr, '%d-%b-%Y')) as Year,
                    Symbol,
                    Series,
                    Open,
                    High,
                    Low,
                    Close,
                    PrevClose,
                    Volume,
                    Turnover
                FROM source_data
                WHERE Series IN ('EQ', 'BE')
            ) TO '{PARQUET_DIR}' (FORMAT PARQUET, PARTITION_BY (Year), OVERWRITE_OR_IGNORE 1);
        """
        
        con.execute(query)
        print("Migration successful! Data partitioned in data/parquet/")
        
    except Exception as e:
        print(f"Migration failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        con.close()

if __name__ == "__main__":
    init_db()
