import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import numpy as np

def create_header():
    # Load data
    df = pd.read_parquet('data/market_breadth_metrics.parquet')
    
    # Filter for the last 1 year to show detail in a small height
    df['Date'] = pd.to_datetime(df['Date'])
    df = df.sort_values('Date')
    
    start_date = df['Date'].max() - pd.DateOffset(years=1)
    df = df[df['Date'] >= start_date].copy()
    
    # Calculate Percentages
    # Assuming TotalTraded is available for denominator
    if 'TotalTraded' in df.columns:
        df['Pct_Above_200MA'] = (df['No of stocks above 200 day SMA'] / df['TotalTraded']) * 100
        df['Pct_Above_All_MAs'] = (df['No of stocks above all 3 SMAs'] / df['TotalTraded']) * 100
    else:
        # Fallback if TotalTraded is missing (though it shouldn't be based on the parquet contents)
        total_estimate = 2500 
        df['Pct_Above_200MA'] = (df['No of stocks above 200 day SMA'] / total_estimate) * 100
        df['Pct_Above_All_MAs'] = (df['No of stocks above all 3 SMAs'] / total_estimate) * 100

    # Twitter Header Aspect Ratio is 3:1 (1500x500 pixels exactly)
    plt.style.use('dark_background')
    # 15 inches * 100 dpi = 1500 px. 5 inches * 100 dpi = 500 px.
    fig, axes = plt.subplots(1, 4, figsize=(15, 5), dpi=100)
    fig.patch.set_facecolor('#0d1117')
    
    metrics = [
        {'col': 'Pct_Above_200MA', 'title': '% Above 200 SMA', 'color': '#bc8cff', 'fill': '#bc8cff', 'is_pct': True},
        {'col': 'Pct_Above_All_MAs', 'title': '% Above ALL MAs', 'color': '#00ffcc', 'fill': '#00ffcc', 'is_pct': True},
        {'col': 'Net New Highs', 'title': 'Net New Highs', 'color': '#ffb86c', 'fill': '#ffb86c', 'is_pct': False},
        {'col': 'No. of stocks up 20%+ in 5 days', 'title': 'Up 20% in 5D', 'color': '#ff5555', 'fill': '#ff5555', 'is_pct': False}
    ]
    
    for i, ax in enumerate(axes):
        ax.set_facecolor('#0d1117')
        m = metrics[i]
        
        # Plot the line
        ax.plot(df['Date'], df[m['col']], color=m['color'], linewidth=2)
        # Fill area under curve
        if m['col'] == 'Net New Highs':
            # Fill positive and negative separately
            ax.fill_between(df['Date'], 0, df[m['col']], where=df[m['col']]>=0, 
                            color='#2ea043', alpha=0.3)
            ax.fill_between(df['Date'], 0, df[m['col']], where=df[m['col']]<0, 
                            color='#f85149', alpha=0.3)
            ax.axhline(0, color='#8b949e', linewidth=1, alpha=0.5)
            # Make the line itself match
            positive = df[m['col']] >= 0
            ax.plot(df['Date'][positive], df[m['col']][positive], color='#2ea043', linewidth=2)
            ax.plot(df['Date'][~positive], df[m['col']][~positive], color='#f85149', linewidth=2)

        else:
            ax.fill_between(df['Date'], df[m['col']].min(), df[m['col']], color=m['fill'], alpha=0.2)
        
        # Formatting
        ax.set_title(m['title'], color='#ffffff', fontsize=16, fontweight='bold', pad=15)
        
        # X-axis
        ax.xaxis.set_major_locator(mdates.MonthLocator(interval=4)) # Show fewer dates
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%b'))
        ax.tick_params(axis='x', colors='#8b949e', labelsize=10, rotation=0)
        
        # Y-axis
        ax.tick_params(axis='y', colors='#8b949e', labelsize=10)
        ax.grid(axis='y', color='#30363d', linestyle='-', alpha=0.5)
        ax.grid(axis='x', color='#30363d', linestyle='-', alpha=0.2)
        
        # Removing spines
        for spine in ['top', 'right', 'left', 'bottom']:
            ax.spines[spine].set_visible(False)
            
        # Add Latest Value Text
        last_val = df[m['col']].iloc[-1]
        val_str = f"{last_val:.1f}%" if m['is_pct'] else f"{int(last_val)}"
        ax.text(0.05, 0.90, val_str, transform=ax.transAxes, 
                color=m['color'] if m['col'] != 'Net New Highs' else ('#2ea043' if last_val >= 0 else '#f85149'),
                fontsize=20, fontweight='bold')

    plt.tight_layout(pad=3.0)
    

             
    output_path = 'data/twitter_header_base.png'
    # Do not use bbox_inches='tight' because it changes the exact 1500x500 dimension
    plt.savefig(output_path, facecolor=fig.get_facecolor(), edgecolor='none')
    print(f"Header image saved to {output_path}")

if __name__ == '__main__':
    create_header()
