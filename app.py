import streamlit as st
import polars as pl
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, timedelta

# Page Config
st.set_page_config(
    page_title="NSE Market Breadth",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for "Wow" factor
st.markdown("""
<style>
    .block-container {
        padding-top: 2rem;
        padding-bottom: 2rem;
    }
    h1 {
        font-family: 'Inter', sans-serif;
        font-weight: 700;
        color: #f0f2f6; 
    }
    .stMetric {
        background-color: #1e2129;
        padding: 15px;
        border-radius: 10px;
        border: 1px solid #2e323b;
    }
</style>
""", unsafe_allow_html=True)

@st.cache_data(ttl=60)
def load_data():
    try:
        df = pl.read_parquet("data/market_breadth_metrics.parquet")
        # Convert to pandas for easy Streamlit/Plotly usage
        return df.to_pandas()
    except FileNotFoundError:
        return None

def main():
    st.title("🇮🇳 NSE Market Breadth Dashboard")
    st.caption("Tracking internal market strength across all NSE stocks (2023-Present)")

    df = load_data()

    if df is None:
        st.error("Data not found. Please ensure the pipeline has run successfully.")
        return

    # Sidebar
    st.sidebar.header("Configuration")
    
    # Date Filter
    min_date = df['Date'].min()
    max_date = df['Date'].max()
    
    # Default to last 30 days view
    start_date = st.sidebar.date_input("Start Date", value=max_date - timedelta(days=90), min_value=min_date, max_value=max_date)
    end_date = st.sidebar.date_input("End Date", value=max_date, min_value=min_date, max_value=max_date)
    
    # Filter Data
    mask = (df['Date'].dt.date >= start_date) & (df['Date'].dt.date <= end_date)
    filtered_df = df.loc[mask].copy()

    # Latest Values
    # st.metric removed as per request for plain table view
    
    # ----------------------------------
    # Tabular Heatmap
    # ----------------------------------
    st.subheader(f"🗓️ Market Breadth Data ({start_date} to {end_date})")
    
    # Heatmap Metrics Selection - EXACT ORDER Requested by User
    metrics_cols = [
        "No. of stocks up 4.5%+ in the current day",
        "No. of stocs down 4.5%+ in the current day",
        "No. of stocks up 20%+ in 5 days",
        "No. of stocks down 20%+ in 5 days",
        "No of stocks above 200 day simple moving average",
        "No of stocks above 50 day simple moving average",
        "No of stocks above 20 day simple moving average",
        "No of stocks which are positive",
        "No of stocks which are negative",
        "Advance/Decline Ratio",
        "Net New Highs",
        "Net New 52-Week Highs as % of Total Stocks"
    ]
    
    # Prepare Dataframe for Display
    # Ensure all columns exist (calculate_metrics.py must have been run)
    available = filtered_df.columns.tolist()
    missing = [m for m in metrics_cols if m not in available]
    if missing:
        st.warning(f"Missing metrics in data: {missing}. Please re-run calculation script.")
        # Fallback to display whatever is available
        display_df = filtered_df.sort_values(by="Date", ascending=False).set_index("Date")
    else:
        display_df = filtered_df.sort_values(by="Date", ascending=False).set_index("Date")[metrics_cols]
    
    # Apply Gradient Styling
    # Green gradients for "Good" things
    good_cols = [
        "No. of stocks up 4.5%+ in the current day", 
        "No. of stocks up 20%+ in 5 days",
        "No of stocks above 200 day simple moving average",
        "No of stocks above 50 day simple moving average",
        "No of stocks above 20 day simple moving average",
        "No of stocks which are positive"
    ]
    
    # Red gradients for "Bad" things
    bad_cols = [
        "No. of stocs down 4.5%+ in the current day",
        "No. of stocks down 20%+ in 5 days",
        "No of stocks which are negative"
    ]
    
    # Diverging for Ratios/Net
    diverging_cols = [
        "Advance/Decline Ratio",
        "Net New Highs",
        "Net New 52-Week Highs as % of Total Stocks"
    ]

    # Dynamically select valid columns for styling to avoid KeyError
    valid_cols = display_df.columns.tolist()
    style_diverging = [c for c in diverging_cols if c in valid_cols]
    style_good = [c for c in good_cols if c in valid_cols]
    style_bad = [c for c in bad_cols if c in valid_cols]
    
    # Formatting subsets
    fmt_2f = ["Advance/Decline Ratio", "Net New 52-Week Highs as % of Total Stocks"]
    fmt_2f_valid = [c for c in fmt_2f if c in valid_cols]
    fmt_0f_valid = [c for c in valid_cols if c not in fmt_2f]

    # Dynamically select valid columns for styling to avoid KeyError
    valid_cols = display_df.columns.tolist()
    
    # "Good" metrics: High value = Green, Low value = Red (RdYlGn)
    # Includes: Up counts, SMA counts, Net Highs, AD Ratio
    sentiment_positive_cols = style_good + style_diverging
    sentiment_positive_valid = [c for c in sentiment_positive_cols if c in valid_cols]
    
    # "Bad" metrics: High value = Red, Low value = Green (RdYlGn_r)
    # Includes: Down counts, Negative counts
    sentiment_negative_valid = [c for c in style_bad if c in valid_cols]

    # Formatting subsets
    fmt_2f = ["Advance/Decline Ratio", "Net New 52-Week Highs as % of Total Stocks"]
    fmt_2f_valid = [c for c in fmt_2f if c in valid_cols]
    fmt_0f_valid = [c for c in valid_cols if c not in fmt_2f]

    st_style = display_df.style\
        .background_gradient(cmap="RdYlGn", subset=sentiment_positive_valid, axis=0)\
        .background_gradient(cmap="RdYlGn_r", subset=sentiment_negative_valid, axis=0)\
        .format("{:.2f}", subset=fmt_2f_valid)\
        .format("{:,.0f}", subset=fmt_0f_valid)
    
    st.dataframe(
        st_style,
        use_container_width=True,
        height=800
    )

if __name__ == "__main__":
    main()
