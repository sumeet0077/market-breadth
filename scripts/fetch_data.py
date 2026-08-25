import requests
from datetime import datetime, timedelta
from datetime import datetime, timedelta, date
import os
import time
import random
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

# Configuration
DATA_DIR = os.getenv("DATA_DIR", "data/raw_bhavcopies")
os.makedirs(DATA_DIR, exist_ok=True)

# Smart History Check
# Count existing CSV files to see if we have enough history for 200-day SMA + Buffer
existing_files_count = len([name for name in os.listdir(DATA_DIR) if name.endswith(".csv")])
MIN_HISTORY_FILES = 400 # ~1.5 years of data

def get_latest_parquet_date():
    try:
        import duckdb
        parquet_dir = "data/parquet/master_copy.parquet"
        if os.path.exists(parquet_dir):
            con = duckdb.connect()
            res = con.execute("SELECT max(trade_date) FROM 'data/parquet/master_copy.parquet'").fetchone()
            if res and res[0]:
                if isinstance(res[0], str):
                    return datetime.strptime(res[0], "%Y-%m-%d")
                elif hasattr(res[0], "year"):
                    return datetime(res[0].year, res[0].month, res[0].day)
    except Exception as e:
        print(f"Could not read parquet max date: {e}")
    return None

latest_parquet_date = get_latest_parquet_date()
LOOKBACK_DAYS = os.getenv("LOOKBACK_DAYS")

if LOOKBACK_DAYS:
    try:
        days = int(LOOKBACK_DAYS)
        START_DATE = datetime.now() - timedelta(days=days)
        if latest_parquet_date and latest_parquet_date < START_DATE:
            print(f"⚠️ Parquet max date ({latest_parquet_date.date()}) is older than LOOKBACK_DAYS ({days}d). Adjusting start date to bridge gap...")
            START_DATE = latest_parquet_date - timedelta(days=3)
        print(f"Incremental Mode: Fetching from {START_DATE.date()} to {datetime.now().date()}")
    except ValueError:
        START_DATE = datetime(2021, 1, 1)
elif latest_parquet_date:
    START_DATE = latest_parquet_date - timedelta(days=5)
    print(f"Smart Incremental Mode (from Parquet Max): Fetching from {START_DATE.date()}")
elif existing_files_count < MIN_HISTORY_FILES:
    print(f"⚠️ Insufficient history detected ({existing_files_count} files). Forcing Full Rebuild...")
    START_DATE = datetime(2021, 1, 1) 
else:
    START_DATE = datetime.now() - timedelta(days=365*4)
    print(f"Full Rebuild Mode: Fetching history from {START_DATE.date()}")

END_DATE = datetime.now()

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Referer": "https://www.nseindia.com/all-reports",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"macOS"',
    "Upgrade-Insecure-Requests": "1"
}

SESSION = requests.Session()
SESSION.headers.update(HEADERS)

def get_bhavcopy_url(date_obj):
    """Generate the URL for the secular bhavcopy CSV."""
    # format: sec_bhavdata_full_DDMMYYYY.csv
    date_str = date_obj.strftime("%d%m%Y")
    return f"https://archives.nseindia.com/products/content/sec_bhavdata_full_{date_str}.csv", f"sec_bhavdata_full_{date_str}.csv"

# Retry on connection errors or 5xx server errors
@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=1, min=4, max=20),
    retry=retry_if_exception_type((requests.exceptions.ConnectionError, requests.exceptions.Timeout, requests.exceptions.ChunkedEncodingError))
)
def download_file(date_obj):
    url, filename = get_bhavcopy_url(date_obj)
    local_path = os.path.join(DATA_DIR, filename)

    if os.path.exists(local_path):
        # Validate file size is not empty (sometimes failed downloads leave 0kb files)
        if os.path.getsize(local_path) > 0:
            return f"Skipped {filename} (Exists)"
        else:
            print(f"Removed empty file {local_path}")
            os.remove(local_path)

    # Optimized Weekend Skeeping:
    # Only check weekends if they are recent (last 30 days) to catch special sessions like Budget Day.
    # Skip older weekends to save time (NSE doesn't have data for them anyway).
    is_weekend = date_obj.weekday() >= 5
    is_recent = (datetime.now() - date_obj).days < 30
    
    if is_weekend and not is_recent:
         return f"Skipped {date_obj.date()} (Weekend, Old)"

    try:
        # NSE often blocks if no cookies are set. Visiting homepage first once might help, 
        # but for archives usually direct link works if headers are good.
        
        response = SESSION.get(url, timeout=15)
        
        if response.status_code == 200:
            with open(local_path, "wb") as f:
                f.write(response.content)
            return f"Downloaded {filename}"
        elif response.status_code == 404:
            return f"Data not found for {date_obj.date()} (Holiday?)"
        elif response.status_code == 403:
            # If forbidden, we might be blocked. Renew session?
            print("403 Forbidden - sleeping longer...")
            time.sleep(10)
            return f"Failed {filename} status 403" 
        else:
            return f"Failed {filename} status {response.status_code}"
            
    except Exception as e:
        raise e # Let tenacity handle it

def main():
    print("Initializing robust download...")
    
    # Establish a clean session visit
    try:
        print("Establishing session via reports page...")
        # Visiting all-reports sets the necessary cookies for archive access
        SESSION.get("https://www.nseindia.com/all-reports", timeout=15)
        print(f"Session established. Cookies: {dict(SESSION.cookies)}")
    except Exception as e:
        print(f"Warning: Failed to establish session: {e}")
        # Proceed anyway as some headers might still work

    dates = []
    curr = START_DATE
    while curr <= END_DATE:
        dates.append(curr)
        curr += timedelta(days=1)
    
    print(f"Targeting {len(dates)} days...")
    
    # Sequential Execution for Safety
    # NSE blocks aggressive parallel requests. 
    # We will use a simple loop with randomized sleep.
    
    count = 0
    for d in dates:
        try:
            res = download_file(d)
            print(res)
            
            # If we actually downloaded (not skipped), sleep to be polite
            if "Downloaded" in res:
                time.sleep(random.uniform(1.0, 3.0)) 
                count += 1
            else:
                 # If skipped (weekend/exists), minimal sleep
                pass 
                
        except Exception as e:
            print(f"FATAL Failed {d.date()}: {e}")
            
    print("Download process completed.")

if __name__ == "__main__":
    main()
