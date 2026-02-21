import os
import json
import joblib
import pandas as pd
import numpy as np
from datetime import datetime
from hmmlearn import hmm
from scipy.stats import norm

DATA_DIR = "data"
JSON_FILE = os.path.join(DATA_DIR, "market_breadth.json")
MODEL_DIR = os.path.join(DATA_DIR, "models")
MODEL_PATH = os.path.join(MODEL_DIR, "regime_hmm.pkl")

def load_data():
    """Loads the aggregate market breadth JSON and converts to DataFrame."""
    if not os.path.exists(JSON_FILE):
        print(f"Error: Could not find {JSON_FILE}")
        return None
    
    with open(JSON_FILE, "r") as f:
        data = json.load(f)
        
    df = pd.DataFrame(data)
    df['Date'] = pd.to_datetime(df['Date'])
    df = df.sort_values("Date").reset_index(drop=True)
    return df

def extract_features(df):
    """
    Extracts velocity, stretch, and momentum features required for the HMM and O-U process.
    """
    # Defensive copy
    features_df = df.copy()
    
    # --- Feature 1: Advance/Decline Ratio (Log-scaled) ---
    # Log scale standardizes ratio so that 2.0 (2:1) is same distance from 0 as 0.5 (1:2)
    features_df['Log_AD_Ratio'] = np.log(features_df['Advance/Decline Ratio'].clip(lower=0.01))
    
    # Velocity of A/D Ratio (5-day slope approximation)
    features_df['AD_Velocity'] = features_df['Log_AD_Ratio'] - features_df['Log_AD_Ratio'].shift(5)
    
    # --- Feature 2: Breadth Participation (% Stocks above 50D SMA) ---
    features_df['Pct_Above_50D'] = features_df['No of stocks above 50 day SMA'] / features_df['TotalTraded']
    
    # --- Feature 3: Net New Highs Thrust ---
    # Normalizing by TotalTraded to account for growing universe size
    features_df['Net_New_Highs_Pct'] = features_df['Net New Highs'] / features_df['TotalTraded']
    features_df['NNH_Thrust_2D'] = features_df['Net_New_Highs_Pct'] - features_df['Net_New_Highs_Pct'].shift(2)
    
    # Forward fill or drop NAs safely for modeling
    features_df = features_df.dropna(subset=['AD_Velocity', 'Pct_Above_50D', 'NNH_Thrust_2D']).reset_index(drop=True)
    
    return features_df

def compute_ou_stretch(df, column, window=252):
    """
    Calculates the Ornstein-Uhlenbeck stretch (Z-score) of a metric relative to its rolling mean.
    """
    rolling_mean = df[column].rolling(window=window, min_periods=window//2).mean()
    rolling_std = df[column].rolling(window=window, min_periods=window//2).std()
    
    stretch = (df[column] - rolling_mean) / rolling_std
    return stretch

def train_and_label_hmm(df):
    """
    Trains a Gaussian HMM on the historical features to classify market regimes.
    """
    print("Training Hidden Markov Model for Regime Detection...")
    
    # Features selected for HMM Training
    X_train = df[['AD_Velocity', 'Pct_Above_50D']].values
    
    # Initialize 3-state HMM (Bull, Bear, Transition/Chop)
    # Using 'full' covariance to capture correlations between Velocity and Absolute Participation
    model = hmm.GaussianHMM(n_components=3, covariance_type="full", n_iter=1000, random_state=42)
    
    # Fit the model
    model.fit(X_train)
    
    # Persist the model
    if not os.path.exists(MODEL_DIR):
        os.makedirs(MODEL_DIR)
    joblib.dump(model, MODEL_PATH)
    print(f"Model saved to {MODEL_PATH}")
    
    # Predict the hidden states
    hidden_states = model.predict(X_train)
    
    # Re-map states based on fundamental reality so State indices are consistent
    # We want State 0 = Bear (Lowest Mean Pct_Above_50D), State 2 = Bull (Highest Mean Pct_Above_50D)
    mean_pct_50d_by_state = {i: df['Pct_Above_50D'][hidden_states == i].mean() for i in range(3)}
    
    # Sort states by their mean participation rate
    sorted_states = sorted(mean_pct_50d_by_state, key=mean_pct_50d_by_state.get)
    mapping = {sorted_states[0]: 0, sorted_states[1]: 1, sorted_states[2]: 2}
    
    mapped_states = [mapping[state] for state in hidden_states]
    
    # Extract prediction probabilities
    state_probs = model.predict_proba(X_train)
    
    df['Regime_State'] = mapped_states
    
    # Re-mapped probabilities
    df['Prob_Bear_Regime'] = [props[sorted_states[0]] for props in state_probs]
    df['Prob_Chop_Regime'] = [props[sorted_states[1]] for props in state_probs]
    df['Prob_Bull_Regime'] = [props[sorted_states[2]] for props in state_probs]
    
    return df

def _apply_cooldown(signal_series, cooldown_days=20):
    """Applies an anti-clustering cooldown: only 1 signal per N trading days."""
    return signal_series & (signal_series.shift(1).rolling(cooldown_days).sum() == 0)


def _generate_metric_signals(df, metric_pct, ou_stretch, prefix,
                              cap_deep, cap_sustained_thresh, cap_sustained_count,
                              euph_deep, euph_sustained_thresh, euph_sustained_count,
                              nnh_5d_ma, nnh_pct):
    """
    Generates buy/sell signals for a single metric chart.
    
    Common architecture per metric:
    - Two-path capitulation/euphoria detection (deep absolute OR sustained + O-U)
    - Zweig breadth thrust (AD > 3.0 for buy, AD < 0.4 for sell)
    - NNH recovery/deterioration slope
    - HMM regime context
    - 20-day anti-clustering cooldown
    """
    # --- Capitulation (Buy Zone) ---
    deep_cap = (metric_pct < cap_deep).rolling(window=12).max() > 0
    sustained_cap = ((metric_pct < cap_sustained_thresh).rolling(window=10).sum() >= cap_sustained_count) & \
                    (ou_stretch.rolling(window=10).min() < -1.5)
    is_capitulated = deep_cap | sustained_cap
    
    buy_thrust = df['Advance/Decline Ratio'] > 3.0
    nnh_improving = nnh_5d_ma > nnh_5d_ma.shift(3)
    bear_context = df['Prob_Bear_Regime'] > 0.5
    
    raw_buy = bear_context & is_capitulated & buy_thrust & nnh_improving
    df[f'{prefix}_Buy'] = _apply_cooldown(raw_buy)
    
    # --- Euphoria (Sell Zone) ---
    deep_euph = (metric_pct > euph_deep).rolling(window=12).max() > 0
    sustained_euph = ((metric_pct > euph_sustained_thresh).rolling(window=10).sum() >= euph_sustained_count) & \
                     (ou_stretch.rolling(window=10).max() > 1.5)
    is_euphoric = deep_euph | sustained_euph
    
    sell_thrust = df['Advance/Decline Ratio'] < 0.40
    nnh_was_high = nnh_pct.rolling(window=15).max() > 0.02
    bull_context = df['Prob_Bull_Regime'] > 0.5
    
    raw_sell = bull_context & is_euphoric & sell_thrust & nnh_was_high
    df[f'{prefix}_Sell'] = _apply_cooldown(raw_sell)
    
    # --- Reversal Probability ---
    stretch_prob = norm.cdf(ou_stretch.abs())
    df[f'{prefix}_Prob'] = (df['Prob_Bear_Regime'] * stretch_prob * 100).clip(upper=99.9).round(1)
    
    return df


def generate_bullseye_signals(df):
    """
    V6 Architecture: Per-Chart Optimized Signals.
    
    Each metric gets its own capitulation/euphoria thresholds derived from
    10-year percentile analysis, with a common thrust + NNH recovery + HMM 
    context + cooldown pattern.
    """
    print("Computing per-chart optimized Bullseye Signals...")
    
    # --- Shared infrastructure ---
    nnh_pct = df['Net New Highs'] / df['TotalTraded']
    nnh_5d_ma = nnh_pct.rolling(window=5).mean()
    
    # ============================================================
    # 1. 50D SMA Chart (existing — Bullseye_Buy_Signal / Bullseye_Sell_Signal)
    # ============================================================
    df['Pct_Above_50D'] = df['No of stocks above 50 day SMA'] / df['TotalTraded']
    df['OU_Stretch_Pct50D'] = compute_ou_stretch(df, 'Pct_Above_50D', window=252)
    
    df = _generate_metric_signals(
        df, metric_pct=df['Pct_Above_50D'], ou_stretch=df['OU_Stretch_Pct50D'],
        prefix='Bullseye',
        cap_deep=0.15, cap_sustained_thresh=0.25, cap_sustained_count=5,
        euph_deep=0.75, euph_sustained_thresh=0.65, euph_sustained_count=5,
        nnh_5d_ma=nnh_5d_ma, nnh_pct=nnh_pct
    )
    # Rename to match existing frontend columns
    df['Bullseye_Buy_Signal'] = df['Bullseye_Buy']
    df['Bullseye_Sell_Signal'] = df['Bullseye_Sell']
    df['Buy_Reversal_Prob'] = df['Bullseye_Prob']
    df['Sell_Reversal_Prob'] = (df['Prob_Bull_Regime'] * norm.cdf(df['OU_Stretch_Pct50D'].abs()) * 100).clip(upper=99.9).round(1)
    
    # ============================================================
    # 2. Net New Highs Chart
    #    NNH is diverging (centered on 0). Extremes: P2 = -17.3%, P98 = 8.9%
    # ============================================================
    df['NNH_Pct'] = nnh_pct
    df['OU_Stretch_NNH'] = compute_ou_stretch(df, 'NNH_Pct', window=252)
    
    # NNH capitulation: sustained NNH% < -15% (P2)
    nnh_cap_deep = (nnh_pct < -0.15).rolling(window=5).sum() >= 2  # 2+ days of extreme NNH selling
    nnh_cap_sustained = (nnh_pct < -0.08).rolling(window=10).sum() >= 5  # 5+ days of heavy selling
    nnh_is_cap = (nnh_cap_deep | nnh_cap_sustained).rolling(window=5).max() > 0
    
    nnh_euph_deep = (nnh_pct > 0.08).rolling(window=5).sum() >= 2
    nnh_euph_sustained = (nnh_pct > 0.05).rolling(window=10).sum() >= 5
    nnh_is_euph = (nnh_euph_deep | nnh_euph_sustained).rolling(window=10).max() > 0
    
    # NNH-specific thrust + recovery
    buy_thrust = df['Advance/Decline Ratio'] > 3.0
    sell_thrust = df['Advance/Decline Ratio'] < 0.40
    nnh_improving = nnh_5d_ma > nnh_5d_ma.shift(3)
    nnh_was_high = nnh_pct.rolling(window=15).max() > 0.02
    bear_ctx = df['Prob_Bear_Regime'] > 0.5
    bull_ctx = df['Prob_Bull_Regime'] > 0.5
    
    raw_nnh_buy = bear_ctx & nnh_is_cap & buy_thrust & nnh_improving
    raw_nnh_sell = bull_ctx & nnh_is_euph & sell_thrust & nnh_was_high
    
    df['Bull_NNH_Buy'] = _apply_cooldown(raw_nnh_buy)
    df['Bull_NNH_Sell'] = _apply_cooldown(raw_nnh_sell)
    df['Bull_NNH_Prob'] = (df['Prob_Bear_Regime'] * norm.cdf(df['OU_Stretch_NNH'].abs()) * 100).clip(upper=99.9).round(1)
    
    # ============================================================
    # 3. 200 SMA Chart
    #    Bounded 0-100%. Extremes: P2 = 14.1%, P98 = 81.4%
    # ============================================================
    pct_200d = df['No of stocks above 200 day SMA'] / df['TotalTraded']
    df['Pct_Above_200D'] = pct_200d
    df['OU_Stretch_200D'] = compute_ou_stretch(df, 'Pct_Above_200D', window=252)
    
    df = _generate_metric_signals(
        df, metric_pct=pct_200d, ou_stretch=df['OU_Stretch_200D'],
        prefix='Bull_200SMA',
        cap_deep=0.15, cap_sustained_thresh=0.25, cap_sustained_count=5,
        euph_deep=0.80, euph_sustained_thresh=0.70, euph_sustained_count=5,
        nnh_5d_ma=nnh_5d_ma, nnh_pct=nnh_pct
    )
    
    # ============================================================
    # 4. All SMAs Chart
    #    Bounded 0-100%. Extremes: P2 = 6.9%, P98 = 61.9%
    # ============================================================
    pct_all = df['No of stocks above all 3 SMAs'] / df['TotalTraded']
    df['Pct_Above_AllSMA'] = pct_all
    df['OU_Stretch_AllSMA'] = compute_ou_stretch(df, 'Pct_Above_AllSMA', window=252)
    
    df = _generate_metric_signals(
        df, metric_pct=pct_all, ou_stretch=df['OU_Stretch_AllSMA'],
        prefix='Bull_AllSMA',
        cap_deep=0.08, cap_sustained_thresh=0.15, cap_sustained_count=5,
        euph_deep=0.55, euph_sustained_thresh=0.45, euph_sustained_count=5,
        nnh_5d_ma=nnh_5d_ma, nnh_pct=nnh_pct
    )
    
    return df

def main():
    print("--- Starting Bullseye Regime Model Training (V6: Per-Chart) ---")
    df = load_data()
    if df is None:
        return
    
    df_features = extract_features(df)
    df_hmm = train_and_label_hmm(df_features)
    df_signals = generate_bullseye_signals(df_hmm)
    
    # Report per-chart signals
    signal_sets = [
        ("50D SMA", "Bullseye_Buy_Signal", "Bullseye_Sell_Signal"),
        ("Net New Highs", "Bull_NNH_Buy", "Bull_NNH_Sell"),
        ("200D SMA", "Bull_200SMA_Buy", "Bull_200SMA_Sell"),
        ("All SMAs", "Bull_AllSMA_Buy", "Bull_AllSMA_Sell"),
    ]
    
    print(f"\nTotal days analyzed: {len(df_signals)}")
    for chart_name, buy_col, sell_col in signal_sets:
        buys = df_signals[df_signals[buy_col]]
        sells = df_signals[df_signals[sell_col]]
        print(f"\n=== {chart_name} Chart ===")
        print(f"  Buy Signals: {len(buys)}")
        for _, row in buys.iterrows():
            print(f"    [BUY] {row['Date'].strftime('%Y-%m-%d')} | AD: {row['Advance/Decline Ratio']:.2f}")
        print(f"  Sell Signals: {len(sells)}")
        for _, row in sells.iterrows():
            print(f"    [SELL] {row['Date'].strftime('%Y-%m-%d')} | AD: {row['Advance/Decline Ratio']:.2f}")
    
    print("\n-----------------------------------------------")
    
    # Save the dataframe back to JSON
    df_signals['Date'] = df_signals['Date'].dt.strftime('%Y-%m-%d')
    
    # Filter out NaN rows
    df_clean = df_signals.dropna(subset=['Prob_Bear_Regime']).copy()
    df_clean = df_clean.fillna(0)
    
    records = df_clean.to_dict(orient='records')
    with open(JSON_FILE, "w") as f:
        json.dump(records, f)
        
    print(f"Saved per-chart regime signals to {JSON_FILE}")

if __name__ == "__main__":
    main()
