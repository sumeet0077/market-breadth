import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np
import os

# Data
dates = ["15 Apr 2026", "13 Apr 2026", "10 Apr 2026", "09 Apr 2026", "08 Apr 2026", "07 Apr 2026", "06 Apr 2026", "02 Apr 2026", "01 Apr 2026"]
fii = [923.34, -1983.18, 672.09, -1711.19, -2811.97, -8692.11, -8167.17, -9229.52, -8072.00]
dii = [-755.46, 2432.30, 410.05, 955.90, 4168.17, 7979.50, 8088.70, 6709.74, 7019.00]
net = [167.88, 449.12, 1082.14, -755.29, 1356.20, -712.61, -78.47, -2519.78, -1053.00]

def fmt(val):
    return f"+{val:,.2f}" if val > 0 else f"{val:,.2f}"

def add_header(ax, title, bg_color, title_color, text_color):
    ax.set_facecolor(bg_color)
    ax.text(0.5, 0.92, title, ha='center', va='center', fontsize=28, color=title_color, transform=ax.transAxes, fontweight='bold')
    ax.text(0.5, 0.05, "QuantBreadth | Market Intelligence", ha='center', va='center', fontsize=14, color=text_color, transform=ax.transAxes, alpha=0.6, style='italic')
    ax.axis('off')

# Style 1: The Modern Dashboard Bar (Horizontal Bars)
def render_style_1(ax):
    bg_color, text_color, pos_color, neg_color, title_color = "#ffffff", "#111827", "#10b981", "#ef4444", "#111827"
    add_header(ax, "FII & DII Net Flows (₹ Cr)", bg_color, title_color, text_color)
    
    height = 0.35
    ax.set_ylim(-1, len(dates)+1)
    max_val = max(max(np.abs(fii)), max(np.abs(dii))) * 1.5
    ax.set_xlim(-max_val, max_val)
    
    for i in range(len(dates)):
        y = len(dates) - 1 - i
        
        # Bars
        ax.barh(y + height/2, fii[i], height, color=pos_color if fii[i]>0 else neg_color, alpha=0.8)
        ax.barh(y - height/2, dii[i], height, color=pos_color if dii[i]>0 else neg_color, alpha=0.5)
        
        # Date Text
        ax.text(0.03, (y+1.2)/(len(dates)+1), dates[i], ha='left', va='center', fontsize=16, color=text_color, transform=ax.transAxes, fontweight='bold')
        
        # Data Text
        f_ha, f_offset = ('left', 300) if fii[i]>0 else ('right', -300)
        d_ha, d_offset = ('left', 300) if dii[i]>0 else ('right', -300)
        
        ax.text(fii[i] + f_offset, y + height/2, f"FII: {fmt(fii[i])}", ha=f_ha, va='center', fontsize=14, color=text_color, fontweight='bold')
        ax.text(dii[i] + d_offset, y - height/2, f"DII: {fmt(dii[i])}", ha=d_ha, va='center', fontsize=14, color=title_color, alpha=0.9)
        
        # Net Bubble on far right
        n_col = pos_color if net[i]>0 else neg_color
        ax.text(0.95, (y+1)/(len(dates)+1), f"NET\n{fmt(net[i])}", ha='right', va='center', fontsize=14, color='white', transform=ax.transAxes, fontweight='bold',
                bbox=dict(boxstyle="circle,pad=0.3", fc=n_col, ec="none", alpha=0.9))
        
        ax.axhline(y - 0.5, color='#e5e7eb', lw=1, alpha=0.4)
        
    ax.plot([0,0], [-1, len(dates)], color='#e5e7eb', lw=2)

# Style 2: The Timeline Flow (Center Axis)
def render_style_2(ax):
    bg_color, text_color, pos_color, neg_color, title_color = "#0d1117", "#c9d1d9", "#2ea043", "#f85149", "#ffffff"
    add_header(ax, "FII vs DII: The Tug of War", bg_color, title_color, text_color)
    
    ax.plot([0.5, 0.5], [0.1, 0.85], color='#30363d', lw=4, transform=ax.transAxes)
    
    start_y = 0.82
    step_y = 0.72 / len(dates)
    
    for i in range(len(dates)):
        y = start_y - i * step_y
        
        # Center Date
        ax.text(0.5, y, dates[i], ha='center', va='center', fontsize=16, color=title_color, transform=ax.transAxes, fontweight='bold',
                bbox=dict(boxstyle="round,pad=0.4", fc='#21262d', ec='#30363d', lw=2))
        
        # FII (Left)
        fc = pos_color if fii[i] > 0 else neg_color
        ax.text(0.35, y, f"FII\n{fmt(fii[i])}", ha='right', va='center', fontsize=18, color=fc, transform=ax.transAxes, fontweight='bold')
        ax.plot([0.37, 0.43], [y, y], color=fc, lw=2, transform=ax.transAxes, alpha=0.5) 
        
        # DII (Right)
        dc = pos_color if dii[i] > 0 else neg_color
        ax.text(0.65, y, f"DII\n{fmt(dii[i])}", ha='left', va='center', fontsize=18, color=dc, transform=ax.transAxes, fontweight='bold')
        ax.plot([0.57, 0.63], [y, y], color=dc, lw=2, transform=ax.transAxes, alpha=0.5) 
        
        # Net Indicator
        nc = pos_color if net[i] > 0 else neg_color
        ax.text(0.5, y - 0.04, f"Net: {fmt(net[i])}", ha='center', va='center', fontsize=14, color=nc, transform=ax.transAxes, fontweight='bold')

# Style 3: The Split Canvas Card Matrix
def render_style_3(ax):
    bg_color, text_color, pos_color, neg_color, title_color = "#1e1e2f", "#e0e0e0", "#00e676", "#ff1744", "#ffffff"
    add_header(ax, "Institutional Net Flows Matrix", bg_color, title_color, text_color)
    
    y_h = 0.82
    ax.text(0.12, y_h, "DATE", ha='center', fontsize=16, color=text_color, transform=ax.transAxes, alpha=0.5)
    ax.text(0.35, y_h, "FII FLOW", ha='center', fontsize=16, color=text_color, transform=ax.transAxes, alpha=0.5)
    ax.text(0.65, y_h, "DII FLOW", ha='center', fontsize=16, color=text_color, transform=ax.transAxes, alpha=0.5)
    ax.text(0.88, y_h, "NET IMPULSE", ha='center', fontsize=16, color=text_color, transform=ax.transAxes, alpha=0.5)
    
    start_y = 0.74
    step_y = 0.65 / len(dates)
    
    for i in range(len(dates)):
        y = start_y - i * step_y
        
        # Card
        ax.add_patch(patches.Rectangle((0.05, y-0.025), 0.9, 0.05, transform=ax.transAxes, facecolor='#2c2c40', edgecolor='none', alpha=0.6, zorder=0))
        
        # Date
        ax.text(0.12, y, dates[i], ha='center', va='center', fontsize=16, color=title_color, transform=ax.transAxes, fontweight='bold')
        
        fc = pos_color if fii[i] > 0 else neg_color
        ax.text(0.35, y, fmt(fii[i]), ha='center', va='center', fontsize=20, color=fc, transform=ax.transAxes, fontweight='bold')
        
        dc = pos_color if dii[i] > 0 else neg_color
        ax.text(0.65, y, fmt(dii[i]), ha='center', va='center', fontsize=20, color=dc, transform=ax.transAxes, fontweight='bold')
        
        nc = pos_color if net[i] > 0 else neg_color
        fill_w = min(abs(net[i]) / 3000 * 0.12, 0.12)
        
        # Visual Impulse Bar
        if net[i] > 0:
            ax.add_patch(patches.Rectangle((0.75, y-0.025), fill_w, 0.05, transform=ax.transAxes, facecolor=nc, alpha=0.3))
        else:
            ax.add_patch(patches.Rectangle((1.0 - fill_w, y-0.025), fill_w, 0.05, transform=ax.transAxes, facecolor=nc, alpha=0.3))
            
        ax.text(0.88, y, fmt(net[i]), ha='center', va='center', fontsize=20, color=nc, transform=ax.transAxes, fontweight='bold')

# Style 4: Sleek Corporate (Net Waterfall Base)
def render_style_4(ax):
    bg_color, text_color, pos_color, neg_color, title_color = "#081021", "#dbeafe", "#34d399", "#fb7185", "#bfdbfe"
    add_header(ax, "Market Breadth: Net Waterfall", bg_color, title_color, text_color)
    
    start_y = 0.8
    step_y = 0.7 / len(dates)
    scale = 0.3 / 3000
    
    ax.plot([0.5, 0.5], [0.1, 0.85], color='#1e3a8a', lw=1, transform=ax.transAxes, alpha=0.5)
    
    for i in range(len(dates)):
        y = start_y - i * step_y
        
        # Left Info
        ax.text(0.05, y+0.015, dates[i], ha='left', va='center', fontsize=18, color=title_color, transform=ax.transAxes, fontweight='bold')
        ax.text(0.05, y-0.015, f"FII: {fmt(fii[i])}  |  DII: {fmt(dii[i])}", ha='left', va='center', fontsize=14, color=text_color, transform=ax.transAxes, alpha=0.7)
        
        w = net[i] * scale
        nc = pos_color if net[i] > 0 else neg_color
        
        if w > 0:
            ax.add_patch(patches.Rectangle((0.5, y-0.02), w, 0.04, transform=ax.transAxes, facecolor=nc, alpha=0.9))
            ax.text(0.5 + w + 0.02, y, fmt(net[i]), ha='left', va='center', fontsize=18, color=nc, transform=ax.transAxes, fontweight='bold')
        else:
            ax.add_patch(patches.Rectangle((0.5 + w, y-0.02), -w, 0.04, transform=ax.transAxes, facecolor=nc, alpha=0.9))
            ax.text(0.5 + w - 0.02, y, fmt(net[i]), ha='right', va='center', fontsize=18, color=nc, transform=ax.transAxes, fontweight='bold')

# Style 5: Spaces Terminal Grid
def render_style_5(ax):
    bg_color, text_color, pos_color, neg_color, title_color = "#111111", "#f3f4f6", "#3fef46", "#ff3b3b", "#facc15"
    add_header(ax, "Institutional Pulse", bg_color, title_color, text_color)
    
    y_h = 0.80
    # Defined column x-positions to ensure equal breathing room
    x_date = 0.08
    x_fii = 0.42
    x_dii = 0.68
    x_net = 0.92

    ax.text(x_date, y_h, "DATE", ha='left', fontsize=18, color=text_color, transform=ax.transAxes, fontweight='bold')
    ax.text(x_fii, y_h, "FII FLOW", ha='right', fontsize=18, color=text_color, transform=ax.transAxes, fontweight='bold')
    ax.text(x_dii, y_h, "DII FLOW", ha='right', fontsize=18, color=text_color, transform=ax.transAxes, fontweight='bold')
    ax.text(x_net, y_h, "NET FLOW", ha='right', fontsize=18, color=text_color, transform=ax.transAxes, fontweight='bold')
    
    ax.plot([0.05, 0.95], [0.77, 0.77], color='#333333', lw=3, transform=ax.transAxes)
    
    start_y = 0.72
    step_y = 0.6 / len(dates)
    
    for i in range(len(dates)):
        y = start_y - i * step_y
        
        if i % 2 == 0:
            # zebra stripe rectangle
            ax.add_patch(patches.Rectangle((0.05, y-0.025), 0.9, 0.05, transform=ax.transAxes, facecolor='#222222', edgecolor='none'))
            
        ax.text(x_date, y, dates[i], ha='left', va='center', fontsize=17, color=text_color, transform=ax.transAxes)
        
        fc = pos_color if fii[i] > 0 else neg_color
        ax.text(x_fii, y, fmt(fii[i]), ha='right', va='center', fontsize=19, color=fc, transform=ax.transAxes, fontweight='bold')
        
        dc = pos_color if dii[i] > 0 else neg_color
        ax.text(x_dii, y, fmt(dii[i]), ha='right', va='center', fontsize=19, color=dc, transform=ax.transAxes, fontweight='bold')
        
        nc = pos_color if net[i] > 0 else neg_color
        ax.text(x_net, y, fmt(net[i]), ha='right', va='center', fontsize=19, color=bg_color, transform=ax.transAxes, fontweight='bold',
                bbox=dict(boxstyle="square,pad=0.3", fc=nc, ec="none"))

styles = [render_style_1, render_style_2, render_style_3, render_style_4, render_style_5]
names = ["1_Dashboard_Bars", "2_Timeline_Tug_Of_War", "3_Split_Canvas_Matrix", "4_Net_Waterfall", "5_Spaced_Terminal"]

output_dir = os.path.expanduser("~/Downloads/FII_DII_Infographics")
os.makedirs(output_dir, exist_ok=True)

for i, renderer in enumerate(styles):
    fig, ax = plt.subplots(figsize=(10.24, 10.24), dpi=100) # 1024x1024 exact
    plt.subplots_adjust(left=0, right=1, top=1, bottom=0)
    
    renderer(ax)
    
    out_path = os.path.join(output_dir, f"{names[i]}.png")
    plt.savefig(out_path, facecolor=fig.get_facecolor(), edgecolor='none')
    plt.close(fig)

print(f"✅ Generated 5 entirely new layouts inside: {output_dir}")
