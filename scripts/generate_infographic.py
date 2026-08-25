import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime
import numpy as np

def create_chart():
    # Load data
    df = pd.read_parquet('data/market_breadth_metrics.parquet')
    
    # Filter for the last 2 years for a clean view
    df['Date'] = pd.to_datetime(df['Date'])
    df = df.sort_values('Date')
    
    # Get the last 2 years of data
    last_date = df['Date'].max()
    start_date = last_date - pd.DateOffset(years=2)
    df = df[df['Date'] >= start_date].copy()
    
    # Set up the style for a beautiful Twitter post (Dark Mode)
    plt.style.use('dark_background')
    fig, ax = plt.subplots(figsize=(16, 9), dpi=300)
    fig.patch.set_facecolor('#0d1117') # GitHub Dark background
    ax.set_facecolor('#0d1117')
    
    # Colors
    color_pos = '#2ea043'  # Pleasant green
    color_neg = '#f85149'  # Pleasant red
    grid_color = '#30363d'
    text_color = '#c9d1d9'
    
    # Net New Highs = New Highs - New Lows. 
    df['Positive'] = df['Net New Highs'] >= 0
    
    # Use fill_between for a seamless area chart look which handles dense data beautifully
    # Or use bars with width less than 1 day so they don't overlap
    ax.bar(df['Date'][df['Positive']], df['Net New Highs'][df['Positive']], 
           color=color_pos, width=0.5, edgecolor='none', alpha=0.85, label='Net New Highs (>0)')
    ax.bar(df['Date'][~df['Positive']], df['Net New Highs'][~df['Positive']], 
           color=color_neg, width=0.5, edgecolor='none', alpha=0.85, label='Net New Lows (<0)')
    
    # Add a 10-day EMA for smoothing the trend
    df['EMA10'] = df['Net New Highs'].ewm(span=10, adjust=False).mean()
    ax.plot(df['Date'], df['EMA10'], color='#e3b341', linewidth=1.5, alpha=0.9, label='10-Day EMA')
    
    # Formatting X-axis
    ax.xaxis.set_major_locator(mdates.MonthLocator(interval=2))
    ax.xaxis.set_major_formatter(mdates.DateFormatter('%b %Y'))
    plt.xticks(rotation=45, color=text_color, fontsize=11)
    
    # Formatting Y-axis
    plt.yticks(color=text_color, fontsize=11)
    ax.grid(axis='y', color=grid_color, linestyle='-', alpha=0.5)
    
    # Removing spines
    for spine in ['top', 'right', 'left', 'bottom']:
        ax.spines[spine].set_visible(False)
    
    # Zero line
    ax.axhline(0, color='#8b949e', linewidth=1.2, alpha=0.8)
    
    # Titles and Labels - Adjusted positions to prevent overlap
    fig.text(0.04, 0.92, 'NSE Net New Highs / Lows', fontsize=28, color='#ffffff', fontweight='bold', ha='left')
    fig.text(0.04, 0.88, 'Daily count of stocks making new 52-week highs minus new 52-week lows (Last 2 Years)', 
             fontsize=14, color='#8b949e', ha='left')
    
    # Watermark / Attribution
    fig.text(0.96, 0.04, '@Antigravity | Market Breadth Data', 
             color='#484f58', fontsize=12, ha='right', va='bottom', style='italic')
    
    # Legend
    legend = ax.legend(loc='upper right', frameon=False, fontsize=12)
    for text in legend.get_texts():
        text.set_color(text_color)
        
    last_val = df['Net New Highs'].iloc[-1]
    last_date_str = last_date.strftime('%B %d, %Y')
    
    # Distinct Latest Value indicator directly on the chart
    ax.text(0.01, 0.95, f"Latest ({last_date_str}): {int(last_val)}", 
             transform=ax.transAxes, color=color_pos if last_val >= 0 else color_neg, 
             fontsize=14, fontweight='bold', ha='left', va='top', 
             bbox=dict(facecolor='#0d1117', edgecolor=color_pos if last_val >= 0 else color_neg, alpha=0.8, boxstyle='round,pad=0.5'))
    
    # Adjust layout to give room to titles
    plt.subplots_adjust(top=0.82, bottom=0.15, left=0.04, right=0.96)
    
    # Save the figure
    output_path = 'data/net_new_lows_infographic.png'
    plt.savefig(output_path, facecolor=fig.get_facecolor(), edgecolor='none', bbox_inches='tight')
    print(f"Infographic saved to {output_path}")

if __name__ == '__main__':
    create_chart()
