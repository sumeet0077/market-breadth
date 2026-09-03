import duckdb
import polars as pl
import numpy as np

con = duckdb.connect()

try:
    from corporate_actions_util import register_corporate_actions_duckdb
except ImportError:
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    from corporate_actions_util import register_corporate_actions_duckdb
register_corporate_actions_duckdb(con)

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
    WHERE series IN ('EQ', 'BE', 'BZ')
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
adjusted_stocks AS (
    SELECT 
        s.Symbol, s.Date,
        s.Open * COALESCE(adj.adj_factor, 1.0) AS AdjOpen,
        s.High * COALESCE(adj.adj_factor, 1.0) AS AdjHigh,
        s.Low * COALESCE(adj.adj_factor, 1.0) AS AdjLow,
        s.Close * COALESCE(adj.adj_factor, 1.0) AS AdjClose,
        s.Open, s.High, s.Low, s.Close, s.PrevClose, s.Volume, s.Turnover
    FROM clean_stocks s
    LEFT JOIN corporate_action_intervals adj
      ON s.Symbol = adj.symbol 
     AND s.Date >= adj.start_date 
     AND s.Date <= adj.end_date
),
calculated AS (
    SELECT 
        Symbol, Date, Open, High, Low, Close, PrevClose, Volume, Turnover,
        AdjOpen, AdjHigh, AdjLow, AdjClose,
        ROW_NUMBER() OVER (PARTITION BY Symbol ORDER BY Date) AS symbol_day_count,
        (AdjClose / NULLIF(COALESCE(LAG(AdjClose, 1) OVER (PARTITION BY Symbol ORDER BY Date), PrevClose), 0)) - 1.0 AS Pct1D,
        (AdjClose / NULLIF(LAG(AdjClose, 5) OVER (PARTITION BY Symbol ORDER BY Date), 0)) - 1.0 AS Pct5D,
        AVG(Volume) OVER (PARTITION BY Symbol ORDER BY Date ROWS BETWEEN 20 PRECEDING AND 1 PRECEDING) AS AvgVol20,
        AVG(AdjClose) OVER (PARTITION BY Symbol ORDER BY Date ROWS BETWEEN 19 PRECEDING AND CURRENT ROW) AS SMA20,
        AVG(AdjClose) OVER (PARTITION BY Symbol ORDER BY Date ROWS BETWEEN 49 PRECEDING AND CURRENT ROW) AS SMA50,
        AVG(AdjClose) OVER (PARTITION BY Symbol ORDER BY Date ROWS BETWEEN 199 PRECEDING AND CURRENT ROW) AS SMA200,
        CASE 
            WHEN ROW_NUMBER() OVER (PARTITION BY Symbol ORDER BY Date) >= 252 
            THEN MAX(AdjHigh) OVER (PARTITION BY Symbol ORDER BY Date ROWS BETWEEN 251 PRECEDING AND CURRENT ROW)
            ELSE NULL 
        END AS High52W,
        AVG((AdjHigh - AdjLow)/NULLIF(AdjClose,0)) OVER (PARTITION BY Symbol ORDER BY Date ROWS BETWEEN 4 PRECEDING AND CURRENT ROW) AS ATR5,
        AVG((AdjHigh - AdjLow)/NULLIF(AdjClose,0)) OVER (PARTITION BY Symbol ORDER BY Date ROWS BETWEEN 19 PRECEDING AND CURRENT ROW) AS ATR20,
        -- Forward 5-day return and max favorable/adverse excursion (using AdjClose for consistency)
        (LEAD(AdjClose, 5) OVER (PARTITION BY Symbol ORDER BY Date) / NULLIF(AdjClose, 0)) - 1.0 AS Fwd5DReturn,
        (MAX(AdjHigh) OVER (PARTITION BY Symbol ORDER BY Date ROWS BETWEEN 1 FOLLOWING AND 5 FOLLOWING) / NULLIF(AdjClose, 0)) - 1.0 AS Fwd5DMFE,
        (MIN(AdjLow) OVER (PARTITION BY Symbol ORDER BY Date ROWS BETWEEN 1 FOLLOWING AND 5 FOLLOWING) / NULLIF(AdjClose, 0)) - 1.0 AS Fwd5DMAE
    FROM adjusted_stocks
)
SELECT 
    Symbol, Date, Close, Volume, Turnover, Pct1D, Pct5D,
    CASE WHEN AdjHigh = AdjLow THEN 0.5 ELSE (AdjClose - AdjLow) / NULLIF(AdjHigh - AdjLow, 0) END AS CLV,
    Volume / NULLIF(AvgVol20, 0) AS RVOL,
    ATR5 / NULLIF(ATR20, 0) AS Compression,
    (symbol_day_count >= 200 AND AdjClose > SMA20 AND SMA20 > SMA50 AND SMA50 > SMA200) AS IsStage2,
    (High52W - AdjClose) / NULLIF(High52W, 0) * 100.0 AS Dist52W,
    (High52W IS NOT NULL AND AdjHigh >= High52W) AS IsNew52W_High,
    Fwd5DReturn, Fwd5DMFE, Fwd5DMAE
FROM calculated
WHERE Date >= '2015-01-01' AND Turnover >= 10000000 AND (Pct1D >= 0.035 OR Pct5D >= 0.15 OR (High52W IS NOT NULL AND AdjHigh >= High52W))
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
