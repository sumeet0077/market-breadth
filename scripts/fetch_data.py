import requests
from datetime import datetime, timedelta
from datetime import datetime, timedelta, date
import os
import time
import random
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

# Configuration
START_DATE = datetime(2021, 1, 1) # Warm-up for 52-week highs
END_DATE = datetime.now()
DATA_DIR = "data/raw_bhavcopies"

os.makedirs(DATA_DIR, exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Referer": "https://www.nseindia.com/all-reports"
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
        SESSION.get("https://www.nseindia.com", timeout=10)
    except:
        pass

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
