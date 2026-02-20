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

def generate_bullseye_signals(df):
    """
    Generates Bullseye Entry (Bottom) and Exit (Top) signals.
    
    V5 Architecture:
    - Two-path capitulation detection (Deep absolute OR Sustained + O-U stretch)
    - Zweig-style breadth thrust confirmation (AD > 3.0)
    - NNH momentum recovery slope (5d MA improving)
    - 20-day anti-clustering cooldown
    """
    print("Computing O-U Stretch and generating Bullseye Signals...")
    
    # Calculate O-U Stretch on Breadth Participation
    df['OU_Stretch_Pct50D'] = compute_ou_stretch(df, 'Pct_Above_50D', window=252)
    
    nnh_pct = df['Net New Highs'] / df['TotalTraded']
    nnh_5d_ma = nnh_pct.rolling(window=5).mean()
    
    # ============ BUY SIGNAL: Structural Bottom Detection ============
    # 
    # Two-path capitulation detection:
    # Path A (Deep): ANY single day below 15% in the last 12 trading days
    # Path B (Sustained): 5+ days below 25% in last 10 AND O-U stretch was < -1.5
    deep_cap = (df['Pct_Above_50D'] < 0.15).rolling(window=12).max() > 0
    sustained_cap = ((df['Pct_Above_50D'] < 0.25).rolling(window=10).sum() >= 5) & \
                    (df['OU_Stretch_Pct50D'].rolling(window=10).min() < -1.5)
    
    is_capitulated = deep_cap | sustained_cap
    
    # Zweig-style breadth thrust: AD > 3.0 (decisive institutional buying)
    buy_thrust = df['Advance/Decline Ratio'] > 3.0
    
    # NNH recovery slope: 5-day MA must be improving vs 3 days ago
    # This filters out dead-cat bounces where NNH stays deeply negative
    nnh_improving = nnh_5d_ma > nnh_5d_ma.shift(3)
    
    # HMM Bear context
    bear_context = df['Prob_Bear_Regime'] > 0.5
    
    raw_buy = bear_context & is_capitulated & buy_thrust & nnh_improving
    
    # Anti-clustering: 20 trading day cooldown between signals
    df['Bullseye_Buy_Signal'] = raw_buy & (raw_buy.shift(1).rolling(20).sum() == 0)
    
    # ============ SELL SIGNAL: Structural Top Detection ============
    # 
    # Two-path euphoria detection:
    # Path A (Deep): ANY single day above 75% in the last 12 trading days
    # Path B (Sustained): 5+ days above 65% in last 10 AND O-U stretch was > 1.5
    deep_euph = (df['Pct_Above_50D'] > 0.75).rolling(window=12).max() > 0
    sustained_euph = ((df['Pct_Above_50D'] > 0.65).rolling(window=10).sum() >= 5) & \
                     (df['OU_Stretch_Pct50D'].rolling(window=10).max() > 1.5)
    
    is_euphoric = deep_euph | sustained_euph
    
    # Negative thrust: AD < 0.40 (heavy institutional selling)
    sell_thrust = df['Advance/Decline Ratio'] < 0.40
    
    # NNH was recently high (proving euphoria was real, not just a technical rebound)
    nnh_was_high = nnh_pct.rolling(window=15).max() > 0.02
    
    # HMM Bull context
    bull_context = df['Prob_Bull_Regime'] > 0.5
    
    raw_sell = bull_context & is_euphoric & sell_thrust & nnh_was_high
    
    # Anti-clustering: 20 trading day cooldown
    df['Bullseye_Sell_Signal'] = raw_sell & (raw_sell.shift(1).rolling(20).sum() == 0)
    
    # ============ REVERSAL PROBABILITY CALCULATION ============
    stretch_prob = norm.cdf(df['OU_Stretch_Pct50D'].abs())
    df['Buy_Reversal_Prob'] = (df['Prob_Bear_Regime'] * stretch_prob * 100).clip(upper=99.9).round(1)
    df['Sell_Reversal_Prob'] = (df['Prob_Bull_Regime'] * stretch_prob * 100).clip(upper=99.9).round(1)
    
    return df

def main():
    print("--- Starting Bullseye Regime Model Training ---")
    df = load_data()
    if df is None:
        return
    
    df_features = extract_features(df)
    df_hmm = train_and_label_hmm(df_features)
    df_signals = generate_bullseye_signals(df_hmm)
    
    # Review performance
    buy_signals = df_signals[df_signals['Bullseye_Buy_Signal']]
    sell_signals = df_signals[df_signals['Bullseye_Sell_Signal']]
    
    print(f"Total days analyzed: {len(df_signals)}")
    print(f"Total Bullseye Buy Signals detected: {len(buy_signals)}")
    for _, row in buy_signals.iterrows():
         print(f"  [BUY] {row['Date'].strftime('%Y-%m-%d')} | ProbBear: {row['Prob_Bear_Regime']:.2f} | Stretch: {row['OU_Stretch_Pct50D']:.2f} | A/D: {row['Advance/Decline Ratio']:.2f}")

    print(f"\nTotal Bullseye Sell Signals detected: {len(sell_signals)}")
    for _, row in sell_signals.iterrows():
         print(f"  [SELL] {row['Date'].strftime('%Y-%m-%d')} | ProbBull: {row['Prob_Bull_Regime']:.2f} | Stretch: {row['OU_Stretch_Pct50D']:.2f} | A/D: {row['Advance/Decline Ratio']:.2f}")

    print("-----------------------------------------------")
    
    # Save the dataframe back to JSON
    # We parse Dates back to string format for the JSON 
    df_signals['Date'] = df_signals['Date'].dt.strftime('%Y-%m-%d')
    
    # Filter out NaN rows that were generated by scrolling windows (first 252 days will have NaN OU stretch)
    df_clean = df_signals.dropna(subset=['Prob_Bear_Regime', 'OU_Stretch_Pct50D']).copy()
    
    # Fill any remaining NaNs to prevent JSON serialization issues
    df_clean = df_clean.fillna(0)
    
    # Convert to dict and save
    records = df_clean.to_dict(orient='records')
    with open(JSON_FILE, "w") as f:
        json.dump(records, f)
        
    print(f"Appended Regime and Bullseye signals to {JSON_FILE}")

if __name__ == "__main__":
    main()
