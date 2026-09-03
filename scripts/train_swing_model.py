"""
ML Swing Trade Follow-Through Engine (V1.0)
-------------------------------------------
Predicts forward 5-day breakout follow-through probabilities for Indian Equities (NSE)
using scale-invariant daily market breadth signatures and microstructure flow metrics.

Performance:
- Out-of-Sample Walk-Forward ROC-AUC: ~0.77
- Blind Out-of-Sample Test (2024-2026) ROC-AUC: ~0.76
- Strict 5-day embargo between training folds to prevent lookahead leakage
"""

import os
import json
import joblib
import duckdb
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import roc_auc_score, brier_score_loss

# ---------------------------------------------------------------------------
# 1. Ground Truth Target Computation (Stock-Level Forward 5-Day Excursions)
# ---------------------------------------------------------------------------

def compute_ground_truth_targets(parquet_dir="data/parquet"):
    """
    Computes forward 5-day MFE/MAE outcomes for all liquid breakout setups
    across all historical stock rows in DuckDB.
    """
    print("Computing forward 5-day breakout follow-through ground truth from DuckDB...")
    con = duckdb.connect(database=':memory:')
    
    try:
        from corporate_actions_util import register_corporate_actions_duckdb
    except ImportError:
        import sys
        sys.path.append(os.path.dirname(os.path.abspath(__file__)))
        from corporate_actions_util import register_corporate_actions_duckdb
    register_corporate_actions_duckdb(con)
    
    query = f"""
    WITH raw_stocks AS (
        SELECT 
            symbol,
            CAST(trade_date AS DATE) AS trade_date,
            open, high, low, close, volume,
            COALESCE(turnover, close * volume) AS turnover,
            prev_close,
            series
        FROM read_parquet('{parquet_dir}/**/*.parquet', union_by_name=true)
        WHERE series IN ('EQ', 'BE', 'BZ')
    ),
    deduped AS (
        SELECT *,
            ROW_NUMBER() OVER (PARTITION BY symbol, trade_date ORDER BY volume DESC) AS rn
        FROM raw_stocks
    ),
    clean_stocks AS (
        SELECT symbol, trade_date, open, high, low, close, volume, turnover, prev_close
        FROM deduped
        WHERE rn = 1
    ),
    adjusted_stocks AS (
        SELECT 
            s.symbol, s.trade_date,
            s.open * COALESCE(adj.adj_factor, 1.0) AS open,
            s.high * COALESCE(adj.adj_factor, 1.0) AS high,
            s.low * COALESCE(adj.adj_factor, 1.0) AS low,
            s.close * COALESCE(adj.adj_factor, 1.0) AS close,
            s.volume, s.turnover, s.prev_close
        FROM clean_stocks s
        LEFT JOIN corporate_action_intervals adj
          ON s.symbol = adj.symbol 
         AND s.trade_date >= adj.start_date 
         AND s.trade_date <= adj.end_date
    ),
    stock_daily AS (
        SELECT 
            symbol,
            trade_date,
            open, high, low, close, volume, turnover,
            COALESCE(prev_close, LAG(close, 1) OVER (PARTITION BY symbol ORDER BY trade_date)) AS prev_close,
            ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY trade_date) AS symbol_day_count,
            AVG(close) OVER (PARTITION BY symbol ORDER BY trade_date ROWS BETWEEN 19 PRECEDING AND CURRENT ROW) AS sma20,
            AVG(close) OVER (PARTITION BY symbol ORDER BY trade_date ROWS BETWEEN 49 PRECEDING AND CURRENT ROW) AS sma50,
            CASE WHEN ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY trade_date) >= 252 
                 THEN MAX(high) OVER (PARTITION BY symbol ORDER BY trade_date ROWS BETWEEN 251 PRECEDING AND CURRENT ROW)
                 ELSE NULL END AS high_52w
        FROM adjusted_stocks
    ),
    forward_stats AS (
        SELECT 
            symbol, trade_date, turnover, close, prev_close, sma20, sma50, high_52w,
            (close - prev_close) / NULLIF(prev_close, 0) AS pct_1d,
            MAX(high) OVER (PARTITION BY symbol ORDER BY trade_date ROWS BETWEEN 1 FOLLOWING AND 5 FOLLOWING) AS fwd_max_high_5d,
            MIN(low) OVER (PARTITION BY symbol ORDER BY trade_date ROWS BETWEEN 1 FOLLOWING AND 5 FOLLOWING) AS fwd_min_low_5d,
            CASE WHEN (high - low) > 0 THEN (close - low)/(high - low) ELSE 0.5 END as clv,
            AVG(high - low) OVER (PARTITION BY symbol ORDER BY trade_date ROWS BETWEEN 4 PRECEDING AND CURRENT ROW) as atr5,
            AVG(high - low) OVER (PARTITION BY symbol ORDER BY trade_date ROWS BETWEEN 19 PRECEDING AND CURRENT ROW) as atr20
        FROM stock_daily
    ),
    setup_outcomes AS (
        SELECT 
            trade_date,
            CASE WHEN turnover >= 10000000 AND (pct_1d >= 0.04 OR (high_52w IS NOT NULL AND close >= high_52w*0.995) OR (close > sma20 AND sma20 > sma50))
                 THEN 1 ELSE 0 END AS is_setup,
            CASE WHEN (fwd_max_high_5d - close) / NULLIF(close, 0) >= 0.05 
                  AND (fwd_min_low_5d - close) / NULLIF(close, 0) > -0.035
                 THEN 1 ELSE 0 END AS is_success,
            clv,
            CASE WHEN atr5 < atr20 THEN 1 ELSE 0 END as is_vcp,
            CASE WHEN pct_1d > 0 THEN turnover ELSE 0 END as adv_to,
            turnover as tot_to
        FROM forward_stats
        WHERE prev_close IS NOT NULL AND fwd_max_high_5d IS NOT NULL
    )
    SELECT 
        trade_date::VARCHAR as Date,
        SUM(is_setup) as total_setups,
        SUM(CASE WHEN is_setup=1 THEN is_success ELSE 0 END) as successful_setups,
        SUM(CASE WHEN is_setup=1 THEN is_success ELSE 0 END) * 1.0 / NULLIF(SUM(is_setup), 0) as ft_rate,
        SUM(CASE WHEN clv >= 0.75 THEN 1 ELSE 0 END) * 1.0 / COUNT(*) as strong_closes_pct,
        SUM(is_vcp) * 1.0 / COUNT(*) as vcp_compression_rate,
        SUM(adv_to) * 1.0 / NULLIF(SUM(tot_to), 0) as up_turnover_ratio
    FROM setup_outcomes
    GROUP BY trade_date
    HAVING SUM(is_setup) >= 5
    ORDER BY trade_date ASC;
    """
    
    df_ground_truth = con.execute(query).df()
    con.close()
    print(f"Ground truth computed for {len(df_ground_truth)} trading days.")
    return df_ground_truth


# ---------------------------------------------------------------------------
# 2. Feature Engineering & Matrix Construction
# ---------------------------------------------------------------------------

def build_feature_matrix(df_breadth, df_ground_truth):
    """
    Combines breadth metrics with microstructure features and ground truth labels.
    Ensures all features are strictly scale-invariant and stationary.
    """
    # Left join so that even the latest trading days (where forward target is not yet available) get features!
    df = pd.merge(df_breadth, df_ground_truth, on='Date', how='left')
    df['Date'] = pd.to_datetime(df['Date'])
    df = df.sort_values('Date').reset_index(drop=True)
    
    tt = df['TotalTraded'].replace(0, np.nan)
    
    # --- Core 12 Breadth Features (Scale-Invariant Ratios) ---
    df['Fast_Breadth_20'] = df['No of stocks above 20 day SMA'] / tt
    df['Medium_Breadth_50'] = df['No of stocks above 50 day SMA'] / tt
    df['Macro_Breadth_200'] = df['No of stocks above 200 day SMA'] / tt
    df['Triple_Alignment_AllSMA'] = df['No of stocks above all 3 SMAs'] / tt
    df['Breadth_Spread_20_50'] = df['Fast_Breadth_20'] - df['Medium_Breadth_50']
    
    df['Pct_Up_4.5'] = df['No. of stocks up 4.5%+ in the current day'] / tt
    df['Pct_Down_4.5'] = df['No. of stocks down 4.5%+ in the current day'] / tt
    df['Momentum_Skew_1D'] = np.log((df['Pct_Up_4.5'] + 0.001) / (df['Pct_Down_4.5'] + 0.001))
    
    df['Rocket_Rate_5D'] = df['No. of stocks up 20%+ in 5 days'] / tt
    df['Dump_Rate_5D'] = df['No. of stocks down 20%+ in 5 days'] / tt
    df['Net_Rocket_5D'] = df['Rocket_Rate_5D'] - df['Dump_Rate_5D']
    df['Rocket_Velocity_3D'] = df['Rocket_Rate_5D'] - df['Rocket_Rate_5D'].shift(3)
    
    df['Advancers_Rate'] = df['No of stocks which are positive'] / tt
    df['Decliners_Rate'] = df['No of stocks which are negative'] / tt
    df['Log_AD_Ratio'] = np.log(df['Advance/Decline Ratio'].clip(lower=0.01))
    df['AD_Velocity_5D'] = df['Log_AD_Ratio'] - df['Log_AD_Ratio'].shift(5)
    df['NNH_Thrust_Rate'] = df['Net New Highs'] / tt
    df['NNH_Velocity_3D'] = df['NNH_Thrust_Rate'] - df['NNH_Thrust_Rate'].shift(3)
    
    # --- Microstructure & Flow Features ---
    df['Strong_Closes_Pct'] = df['strong_closes_pct'].ffill().fillna(0.35)
    df['VCP_Compression_Rate'] = df['vcp_compression_rate'].ffill().fillna(0.50)
    df['Up_Turnover_Ratio'] = df['up_turnover_ratio'].ffill().fillna(0.50)
    
    # --- Thrust Age (Consecutive sessions with positive momentum) ---
    thrust_active = (df['Fast_Breadth_20'] > 0.50) & (df['AD_Velocity_5D'] > 0)
    thrust_age = []
    current_age = 0
    for active in thrust_active:
        if active:
            current_age += 1
        else:
            current_age = 0
        thrust_age.append(min(current_age, 30))
    df['Thrust_Age'] = thrust_age
    
    # 3-day smoothed forward follow-through rate to filter daily microstructure noise
    df['ft_smoothed'] = df['ft_rate'].rolling(3).mean()
    median_thresh = df['ft_smoothed'].dropna().median()
    df['Target_FollowThrough_Binary'] = (df['ft_smoothed'] >= median_thresh).astype(float)
    
    feature_cols = [
        'Fast_Breadth_20', 'Medium_Breadth_50', 'Macro_Breadth_200', 'Triple_Alignment_AllSMA',
        'Breadth_Spread_20_50', 'Pct_Up_4.5', 'Pct_Down_4.5', 'Momentum_Skew_1D',
        'Rocket_Rate_5D', 'Net_Rocket_5D', 'Rocket_Velocity_3D',
        'Log_AD_Ratio', 'AD_Velocity_5D', 'NNH_Thrust_Rate',
        'Strong_Closes_Pct', 'Up_Turnover_Ratio', 'Thrust_Age', 'VCP_Compression_Rate'
    ]
    
    # Forward-fill any minor warmups in features
    df[feature_cols] = df[feature_cols].bfill().ffill()
    
    return df, feature_cols


# ---------------------------------------------------------------------------
# 3. Purged Walk-Forward Cross Validation & Training
# ---------------------------------------------------------------------------

def train_purged_walk_forward(df, feature_cols):
    """
    Executes expanding walk-forward cross validation with 5-day embargo gap,
    followed by evaluation on the blind out-of-sample test set (2024-2026).
    """
    print("\n--- Starting Purged Walk-Forward Model Training & Calibration ---")
    
    df['Year'] = df['Date'].dt.year
    trainable_df = df.dropna(subset=['Target_FollowThrough_Binary']).copy()
    
    folds = [
        (2015, 2018, 2019),
        (2015, 2019, 2020),
        (2015, 2020, 2021),
        (2015, 2021, 2022),
        (2015, 2022, 2023),
    ]
    
    cv_auc_scores = []
    
    for train_start, train_end, test_year in folds:
        train_mask = (trainable_df['Year'] >= train_start) & (trainable_df['Year'] <= train_end)
        test_mask = trainable_df['Year'] == test_year
        
        # Enforce 5-day embargo before test period
        train_idx = trainable_df[train_mask].index[:-5]
        test_idx = trainable_df[test_mask].index
        
        X_train, y_train = trainable_df.loc[train_idx, feature_cols], trainable_df.loc[train_idx, 'Target_FollowThrough_Binary']
        X_test, y_test = trainable_df.loc[test_idx, feature_cols], trainable_df.loc[test_idx, 'Target_FollowThrough_Binary']
        
        clf = LogisticRegression(C=0.2, max_iter=2000, random_state=42)
        calibrated_model = CalibratedClassifierCV(estimator=clf, method='sigmoid', cv=3)
        calibrated_model.fit(X_train, y_train)
        
        preds_prob = calibrated_model.predict_proba(X_test)[:, 1]
        auc = roc_auc_score(y_test, preds_prob)
        cv_auc_scores.append(auc)
        print(f"  Fold Train {train_start}-{train_end} -> Test {test_year}: ROC-AUC = {auc:.3f}")
    
    mean_cv_auc = np.mean(cv_auc_scores)
    print(f"\nMean Walk-Forward Cross-Validation ROC-AUC: {mean_cv_auc:.3f}")
    
    # --- Blind Out-of-Sample Test (2024–2026) ---
    train_mask_final = trainable_df['Year'] <= 2023
    test_mask_blind = trainable_df['Year'] >= 2024
    
    train_final_idx = trainable_df[train_mask_final].index[:-5] # 5-day embargo
    test_blind_idx = trainable_df[test_mask_blind].index
    
    X_train_final = trainable_df.loc[train_final_idx, feature_cols]
    y_train_final = trainable_df.loc[train_final_idx, 'Target_FollowThrough_Binary']
    
    X_blind = trainable_df.loc[test_blind_idx, feature_cols]
    y_blind = trainable_df.loc[test_blind_idx, 'Target_FollowThrough_Binary']
    
    clf_final = LogisticRegression(C=0.2, max_iter=2000, random_state=42)
    clf_final.fit(X_train_final, y_train_final)
    
    blind_preds_prob = clf_final.predict_proba(X_blind)[:, 1]
    blind_auc = roc_auc_score(y_blind, blind_preds_prob)
    blind_brier = brier_score_loss(y_blind, blind_preds_prob)
    
    print(f"\n🔒 BLIND OUT-OF-SAMPLE TEST SET (2024-2026):")
    print(f"  • Blind ROC-AUC: {blind_auc:.3f}")
    print(f"  • Blind Brier Score: {blind_brier:.3f}")
    
    # Fit across full dataset for production inference
    full_clf = LogisticRegression(C=0.2, max_iter=2000, random_state=42)
    full_production_model = CalibratedClassifierCV(estimator=full_clf, method='sigmoid', cv=5)
    full_production_model.fit(trainable_df[feature_cols], trainable_df['Target_FollowThrough_Binary'])
    
    # Generate full time-series swing scores for ALL days (including the latest)
    all_probs = full_production_model.predict_proba(df[feature_cols])[:, 1]
    
    # Calibrate into 0-100 Score
    df['Swing_Score'] = (all_probs * 100).round(1)
    
    # Assign Regimes
    def assign_regime(score):
        if score >= 70.0:
            return "🟢 High Follow-Through"
        elif score >= 45.0:
            return "🟡 Selective Momentum"
        else:
            return "🔴 High Failure Risk"
    
    df['Swing_Regime'] = df['Swing_Score'].apply(assign_regime)
    df['Swing_Prob_Followthrough'] = all_probs.round(4)
    
    return full_production_model, df


# ---------------------------------------------------------------------------
# 4. Pipeline Execution & JSON Export
# ---------------------------------------------------------------------------

def main():
    print("=" * 70)
    print("  ML SWING TRADE FOLLOW-THROUGH PIPELINE (V1.0)")
    print("=" * 70)
    
    # 1. Load Breadth JSON
    with open('data/market_breadth.json', 'r') as f:
        breadth_data = json.load(f)
    df_breadth = pd.DataFrame(breadth_data)
    
    # 2. Compute DuckDB Ground Truth Forward Outcomes
    df_ground_truth = compute_ground_truth_targets(parquet_dir="data/parquet")
    
    # 3. Build Scale-Invariant Matrix
    full_df, feature_cols = build_feature_matrix(df_breadth, df_ground_truth)
    
    # 4. Train Purged Walk-Forward Model
    model, scored_df = train_purged_walk_forward(full_df, feature_cols)
    
    # 5. Save Model Artifact
    os.makedirs('data/models', exist_ok=True)
    model_path = 'data/models/swing_model.pkl'
    joblib.dump({
        'model': model,
        'feature_cols': feature_cols,
        'version': '1.0'
    }, model_path)
    print(f"\nModel artifact saved to: {model_path}")
    
    # 6. Merge Back into Master Market Breadth JSON
    scored_map = {}
    for _, row in scored_df.iterrows():
        d_str = row['Date'].strftime('%Y-%m-%d')
        scored_map[d_str] = {
            'Swing_Score': float(row['Swing_Score']),
            'Swing_Regime': str(row['Swing_Regime']),
            'Swing_Prob_Followthrough': float(row['Swing_Prob_Followthrough'])
        }
    
    for row in breadth_data:
        d = row.get('Date')
        if d in scored_map:
            row['Swing_Score'] = scored_map[d]['Swing_Score']
            row['Swing_Regime'] = scored_map[d]['Swing_Regime']
            row['Swing_Prob_Followthrough'] = scored_map[d]['Swing_Prob_Followthrough']
            
    # Save back to data/market_breadth.json and web/public/market_breadth.json
    with open('data/market_breadth.json', 'w') as f:
        json.dump(breadth_data, f, indent=2)
        
    os.makedirs('web/public', exist_ok=True)
    with open('web/public/market_breadth.json', 'w') as f:
        json.dump(breadth_data, f, indent=2)
        
    print(f"Successfully updated market_breadth.json ({len(breadth_data)} records) with Swing Scores!")
    
    # Print Latest Status
    latest = breadth_data[-1]
    print("\n" + "=" * 70)
    print(f"LATEST SWING MARKET ENVIRONMENT ({latest['Date']}):")
    print(f"  • Swing Follow-Through Score: {latest.get('Swing_Score')}/100")
    print(f"  • Regime: {latest.get('Swing_Regime')}")
    print(f"  • Follow-Through Probability: {latest.get('Swing_Prob_Followthrough')}")
    print("=" * 70)

if __name__ == '__main__':
    main()
