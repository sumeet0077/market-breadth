import pandas as pd
import os

BAD_FILE = "data/raw_bhavcopies/sec_bhavdata_full_08082022.csv"
RECOVERED_FILE = "data/raw_bhavcopies/sec_bhavdata_full_08082022_recovered.csv"

def recover():
    print(f"Attempting to recover {BAD_FILE}...")
    try:
        # Try reading as excel
        df = pd.read_excel(BAD_FILE, engine='openpyxl')
        print(f"Successfully read Excel file. Rows: {len(df)}")
        
        # Save as standard CSV
        df.to_csv(RECOVERED_FILE, index=False)
        print(f"Saved recovered CSV to {RECOVERED_FILE}")
        
    except Exception as e:
        print(f"Recovery failed: {e}")

if __name__ == "__main__":
    recover()
