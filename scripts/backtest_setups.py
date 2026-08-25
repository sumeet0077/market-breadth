import duckdb
import polars as pl
import numpy as np

con = duckdb.connect()

query = """
WITH raw_stocks AS (
    SELECT 
        symbol AS Symbol,
        CAST(trade_date AS DATE) AS Date,
        open AS Open,
        high AS High,
        low AS Low,
        close AS Close,
        prev_close AS PrevClose,
        volume AS Volume,
        COALESCE(turnover, close * volume) AS Turnover
    FROM read_parquet('data/parquet/**/*.parquet', union_by_name=true)
    WHERE series = 'EQ'
),
deduped AS (
    SELECT *,
        ROW_NUMBER() OVER (PARTITION BY Symbol, Date ORDER BY Volume DESC) AS rn
    FROM raw_stocks
),
clean_stocks AS (
    SELECT Symbol, Date, Open, High, Low, Close, PrevClose, Volume, Turnover
    FROM deduped
    WHERE rn = 1
),
calculated AS (
    SELECT 
        Symbol, Date, Open, High, Low, Close, PrevClose, Volume, Turnover,
        (Close / NULLIF(LAG(Close, 1) OVER (PARTITION BY Symbol ORDER BY Date), 0)) - 1.0 AS Pct1D,
        (Close / NULLIF(LAG(Close, 5) OVER (PARTITION BY Symbol ORDER BY Date), 0)) - 1.0 AS Pct5D,
        AVG(Volume) OVER (PARTITION BY Symbol ORDER BY Date ROWS BETWEEN 20 PRECEDING AND 1 PRECEDING) AS AvgVol20,
        AVG(Close) OVER (PARTITION BY Symbol ORDER BY Date ROWS BETWEEN 20 PRECEDING AND CURRENT ROW) AS SMA20,
        AVG(Close) OVER (PARTITION BY Symbol ORDER BY Date ROWS BETWEEN 50 PRECEDING AND CURRENT ROW) AS SMA50,
        AVG(Close) OVER (PARTITION BY Symbol ORDER BY Date ROWS BETWEEN 200 PRECEDING AND CURRENT ROW) AS SMA200,
        MAX(High) OVER (PARTITION BY Symbol ORDER BY Date ROWS BETWEEN 252 PRECEDING AND CURRENT ROW) AS High52W,
        AVG((High - Low)/NULLIF(Close,0)) OVER (PARTITION BY Symbol ORDER BY Date ROWS BETWEEN 5 PRECEDING AND CURRENT ROW) AS ATR5,
        AVG((High - Low)/NULLIF(Close,0)) OVER (PARTITION BY Symbol ORDER BY Date ROWS BETWEEN 20 PRECEDING AND CURRENT ROW) AS ATR20,
        -- Forward 5-day return and max favorable/adverse excursion
        (LEAD(Close, 5) OVER (PARTITION BY Symbol ORDER BY Date) / NULLIF(Close, 0)) - 1.0 AS Fwd5DReturn,
        (MAX(High) OVER (PARTITION BY Symbol ORDER BY Date ROWS BETWEEN 1 FOLLOWING AND 5 FOLLOWING) / NULLIF(Close, 0)) - 1.0 AS Fwd5DMFE,
        (MIN(Low) OVER (PARTITION BY Symbol ORDER BY Date ROWS BETWEEN 1 FOLLOWING AND 5 FOLLOWING) / NULLIF(Close, 0)) - 1.0 AS Fwd5DMAE
    FROM clean_stocks
)
SELECT 
    Symbol, Date, Close, Volume, Turnover, Pct1D, Pct5D,
    CASE WHEN High = Low THEN 0.5 ELSE (Close - Low) / NULLIF(High - Low, 0) END AS CLV,
    Volume / NULLIF(AvgVol20, 0) AS RVOL,
    ATR5 / NULLIF(ATR20, 0) AS Compression,
    (Close > SMA20 AND SMA20 > SMA50 AND SMA50 > SMA200) AS IsStage2,
    (High52W - Close) / NULLIF(High52W, 0) * 100.0 AS Dist52W,
    (High >= High52W) AS IsNew52W_High,
    Fwd5DReturn, Fwd5DMFE, Fwd5DMAE
FROM calculated
WHERE Date >= '2015-01-01' AND Turnover >= 10000000 AND (Pct1D >= 0.035 OR Pct5D >= 0.15 OR High >= High52W)
"""

print("Running 12-Year Empirical Backtest Query...")
df = con.execute(query).pl()
print(f"Total Breakout candidate instances evaluated: {len(df):,}")

# Score each instance
def compute_row_score(row):
    clv = row['CLV'] or 0.5
    rvol = row['RVOL'] or 1.0
    comp = row['Compression'] or 1.0
    s2 = bool(row['IsStage2'])
    d52 = row['Dist52W'] or 20.0
    
    score = 0
    if clv >= 0.90: score += 25
    elif clv >= 0.75: score += 18
    elif clv >= 0.60: score += 10

    if rvol >= 3.0: score += 25
    elif rvol >= 2.0: score += 18
    elif rvol >= 1.2: score += 10

    if comp <= 0.70: score += 20
    elif comp <= 0.85: score += 12
    else: score += 5

    if s2: score += 15
    else: score += 5

    if d52 <= 3.0: score += 15
    elif d52 <= 8.0: score += 10
    elif d52 <= 15.0: score += 5
    
    return score

scores = [compute_row_score(r) for r in df.to_dicts()]
df = df.with_columns(pl.Series("Score", scores))

# Define target win: MFE >= +5% and MAE > -3.5%
df = df.with_columns([
    ((pl.col("Fwd5DMFE") >= 0.05) & (pl.col("Fwd5DMAE") > -0.035)).alias("IsWin"),
    (pl.col("Fwd5DReturn") * 100.0).alias("GainPct")
])

print("\n" + "="*70)
print("  12-YEAR EMPIRICAL EXPECTANCY & WIN RATE BY SETUP GRADE (2015-2026)")
print("="*70)

for grade_name, (min_s, max_s) in [
    ("Grade A+ Prime Breakout (Score >= 80)", (80, 100)),
    ("Grade A Momentum Thrust (Score 65-79)", (65, 79)),
    ("Grade B Tactical Setup (Score 50-64)", (50, 64)),
    ("Grade C / Trap Risk (Score < 50)", (0, 49)),
]:
    sub = df.filter((pl.col("Score") >= min_s) & (pl.col("Score") <= max_s) & pl.col("Fwd5DReturn").is_not_null())
    n = len(sub)
    if n == 0: continue
    win_rate = sub["IsWin"].mean() * 100.0
    avg_gain = sub["GainPct"].mean()
    avg_win = sub.filter(pl.col("GainPct") > 0)["GainPct"].mean()
    avg_loss = abs(sub.filter(pl.col("GainPct") <= 0)["GainPct"].mean())
    profit_factor = (sub.filter(pl.col("GainPct") > 0)["GainPct"].sum()) / abs(sub.filter(pl.col("GainPct") <= 0)["GainPct"].sum() or 1.0)
    
    print(f"📊 {grade_name}:")
    print(f"   • Total Trades: {n:,}")
    print(f"   • Win Rate: {win_rate:.1f}%")
    print(f"   • Average 5-Day Return: {avg_gain:+.2f}%")
    print(f"   • Profit Factor: {profit_factor:.2f}x")
    print(f"   • Avg Winner: +{avg_win:.2f}% | Avg Loser: -{avg_loss:.2f}%\n")
