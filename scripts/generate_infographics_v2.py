import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# Resolution
WIDTH, HEIGHT = 1200, 1200
PAD = 60
TIMELINE_X = 220
BAR_START_X = 280
BAR_MAX_WIDTH = 750

# Data
DATA = [
    {"date": "15 Apr", "fii": 923.34, "dii": -755.46, "net": 167.88},
    {"date": "13 Apr", "fii": -1983.18, "dii": 2432.30, "net": 449.12},
    {"date": "10 Apr", "fii": 672.09, "dii": 410.05, "net": 1082.14},
    {"date": "09 Apr", "fii": -1711.19, "dii": 955.90, "net": -755.29},
    {"date": "08 Apr", "fii": -2811.97, "dii": 4168.17, "net": 1356.20},
    {"date": "07 Apr", "fii": -8692.11, "dii": 7979.50, "net": -712.61},
    {"date": "06 Apr", "fii": -8167.17, "dii": 8088.70, "net": -78.47},
    {"date": "02 Apr", "fii": -9229.52, "dii": 6709.74, "net": -2519.78},
    {"date": "01 Apr", "fii": -8072.00, "dii": 7019.00, "net": -1053.00},
]

TOTALS = {
    "fii": -39071.71,
    "dii": 37007.90,
    "net": -2063.81
}

# Colors
C_BG_START = (15, 23, 42)    # #0F172A
C_BG_END = (30, 41, 55)      # #1E2937
C_FII_POS = (0, 200, 83)     # #00C853
C_FII_NEG = (255, 23, 68)    # #FF1744
C_DII_POS = (41, 121, 255)   # #2979FF
C_DII_NEG = (255, 87, 34)    # #FF5722
C_NET_POS = (16, 185, 129)   # Emerald
C_NET_NEG = (220, 38, 38)    # Crimson
C_WHITE = (255, 255, 255)
C_OFF_WHITE = (226, 232, 240)
C_GOLD = (234, 179, 8)       # Gold for Style 4

# Fonts
FONT_PATH = "/System/Library/Fonts/HelveticaNeue.ttc"

def get_font(size, bold=False):
    idx = 1 if bold else 0
    return ImageFont.truetype(FONT_PATH, size, index=idx)

def draw_gradient(draw, width, height, start_color, end_color):
    for y in range(height):
        r = start_color[0] + (end_color[0] - start_color[0]) * y / height
        g = start_color[1] + (end_color[1] - start_color[1]) * y / height
        b = start_color[2] + (end_color[2] - start_color[2]) * y / height
        draw.line([(0, y), (width, y)], fill=(int(r), int(g), int(b)))

def format_val(val):
    sign = "+" if val >= 0 else ""
    return f"{sign}{val:,.2f}"

def draw_arrow(draw, x, y, size, direction, color):
    # direction: 'up' or 'down'
    if direction == 'up':
        points = [(x, y + size), (x + size, y + size), (x + size/2, y)]
    else:
        points = [(x, y), (x + size, y), (x + size/2, y + size)]
    draw.polygon(points, fill=color)

class BaseInfographic:
    def __init__(self, title):
        self.img = Image.new("RGB", (WIDTH, HEIGHT), C_BG_START)
        self.draw = ImageDraw.Draw(self.img, "RGBA") # Enable transparency
        self.title = title
        
    def draw_base_elements(self):
        draw_gradient(self.draw, WIDTH, HEIGHT, C_BG_START, C_BG_END)
        
        # Title
        font_title = get_font(54, bold=True)
        self.draw.text((PAD, 50), self.title, fill=C_WHITE, font=font_title)
        self.draw.line([(PAD, 120), (WIDTH-PAD, 120)], fill=C_WHITE, width=2)
        
        # Legend
        f_leg = get_font(28, bold=True)
        leg_items = [("FII", C_FII_POS), ("DII", C_DII_POS), ("Net", C_NET_POS)]
        x_off = WIDTH - PAD
        for text, color in reversed(leg_items):
            tw = self.draw.textlength(text, font=f_leg)
            self.draw.text((x_off - tw, 65), text, fill=color, font=f_leg)
            self.draw.ellipse([x_off - tw - 25, 75, x_off - tw - 10, 90], fill=color)
            x_off -= (tw + 60)

        # Footnote
        f_foot = get_font(22)
        foot_text = "QuantBreadth | Market Intelligence"
        tw = self.draw.textlength(foot_text, font=f_foot)
        self.draw.text(((WIDTH - tw)//2, HEIGHT - 40), foot_text, fill=C_OFF_WHITE, font=f_foot)

    def draw_summary(self):
        box_y = HEIGHT - 230
        box_h = 175
        # Semi-transparent background for box
        overlay = Image.new('RGBA', (WIDTH, HEIGHT), (0,0,0,0))
        d_ol = ImageDraw.Draw(overlay)
        d_ol.rectangle([PAD, box_y, WIDTH - PAD, box_y + box_h], fill=(30, 41, 55, 200), outline=(255, 255, 255, 100), width=2)
        self.img.paste(overlay, (0,0), overlay)

        f_sum_title = get_font(32, bold=True)
        self.draw.text((PAD + 30, box_y + 15), "1–15 Apr 2026 Totals", fill=C_WHITE, font=f_sum_title)
        
        f_val = get_font(40, bold=True)
        items = [
            (f"Total FII: {format_val(TOTALS['fii'])}", C_FII_NEG if TOTALS['fii'] < 0 else C_FII_POS, TOTALS['fii']),
            (f"Total DII: {format_val(TOTALS['dii'])}", C_DII_POS if TOTALS['dii'] > 0 else C_DII_NEG, TOTALS['dii']),
            (f"Total Net: {format_val(TOTALS['net'])}", C_NET_NEG if TOTALS['net'] < 0 else C_NET_POS, TOTALS['net'])
        ]
        
        for i, (text, color, val) in enumerate(items):
            self.draw.text((PAD + 30, box_y + 65 + i*40), text, fill=color, font=f_val)
            draw_arrow(self.draw, WIDTH - PAD - 80, box_y + 75 + i*40, 20, 'up' if val >= 0 else 'down', color)

    def draw_data_row(self, i, row, y_pos, bar_height=20, spacing=15):
        f_date = get_font(38, bold=True)
        f_val = get_font(28, bold=True)
        
        # Date
        self.draw.text((PAD, y_pos - 10), row['date'], fill=C_WHITE, font=f_date)
        
        # Bars scaling
        max_abs = 10000 
        def scale(val): return (abs(val) / max_abs) * BAR_MAX_WIDTH
        
        # FII Bar
        fii_w = scale(row['fii'])
        fii_col = C_FII_POS if row['fii'] >= 0 else C_FII_NEG
        self.draw.rectangle([BAR_START_X, y_pos, BAR_START_X + fii_w, y_pos + bar_height], fill=fii_col)
        draw_arrow(self.draw, BAR_START_X + fii_w + 15, y_pos - 2, 18, 'up' if row['fii'] >= 0 else 'down', fii_col)
        self.draw.text((BAR_START_X + fii_w + 40, y_pos - 5), format_val(row['fii']), fill=fii_col, font=f_val)
        
        # DII Bar
        y_dii = y_pos + bar_height + spacing
        dii_w = scale(row['dii'])
        dii_col = C_DII_POS if row['dii'] >= 0 else C_DII_NEG
        self.draw.rectangle([BAR_START_X, y_dii, BAR_START_X + dii_w, y_dii + bar_height], fill=dii_col)
        draw_arrow(self.draw, BAR_START_X + dii_w + 15, y_dii - 2, 18, 'up' if row['dii'] >= 0 else 'down', dii_col)
        self.draw.text((BAR_START_X + dii_w + 40, y_dii - 5), format_val(row['dii']), fill=dii_col, font=f_val)
        
        # Net Bar
        y_net = y_dii + bar_height + spacing + 5
        net_w = scale(row['net'])
        net_col = C_NET_POS if row['net'] >= 0 else C_NET_NEG
        self.draw.rectangle([BAR_START_X, y_net, BAR_START_X + net_w, y_net + bar_height], fill=net_col)
        
        # Net value box
        net_val_str = format_val(row['net'])
        tw = self.draw.textlength(net_val_str, font=f_val)
        box_x = BAR_START_X + net_w + 20
        box_rect = [box_x - 5, y_net - 5, box_x + tw + 45, y_net + bar_height + 5]
        self.draw.rectangle(box_rect, fill=net_col)
        draw_arrow(self.draw, box_x + 5, y_net-1, 18, 'up' if row['net'] >= 0 else 'down', C_WHITE)
        self.draw.text((box_x + 30, y_net - 3), net_val_str, fill=C_WHITE, font=f_val)

# Styles
def style_1_minimalist():
    # Modern Minimalist
    gen = BaseInfographic("FII & DII Net Flows – April 2026")
    gen.draw_base_elements()
    start_y = 150
    row_step = 90 
    for i, row in enumerate(DATA):
        y = start_y + i * row_step
        gen.draw_data_row(i, row, y, bar_height=10, spacing=12)
    gen.draw_summary()
    return gen.img

def style_2_bold():
    # Bold Financial Dashboard
    gen = BaseInfographic("FII & DII Net Flows – April 2026")
    gen.draw_base_elements()
    start_y = 150
    row_step = 90
    for i, row in enumerate(DATA):
        y = start_y + i * row_step
        # Draw glow for positive bars
        if row['fii'] > 0:
            w = (abs(row['fii']) / 10000) * BAR_MAX_WIDTH
            gen.draw.rectangle([BAR_START_X-2, y-2, BAR_START_X + w + 2, y + 14 + 2], fill=(0, 200, 83, 40))
        if row['dii'] > 0:
            w = (abs(row['dii']) / 10000) * BAR_MAX_WIDTH
            gen.draw.rectangle([BAR_START_X-2, y+14+10-2, BAR_START_X + w + 2, y+28+10+2], fill=(41, 121, 255, 40))
        
        gen.draw_data_row(i, row, y, bar_height=14, spacing=10)
    gen.draw_summary()
    return gen.img

def style_3_timeline():
    # Sleek Corporate Timeline
    gen = BaseInfographic("FII & DII Net Flows – April 2026")
    gen.draw_base_elements()
    gen.draw.line([(PAD + 80, 150), (PAD + 80, HEIGHT - 230)], fill=C_OFF_WHITE, width=2) 
    start_y = 150
    row_step = 90
    for i, row in enumerate(DATA):
        y = start_y + i * row_step
        gen.draw.ellipse([PAD + 70, y, PAD + 90, y + 20], fill=C_WHITE, outline=C_BG_START, width=2)
        gen.draw_data_row(i, row, y, bar_height=11, spacing=11)
    gen.draw_summary()
    return gen.img

def style_4_premium():
    # Premium Dark Mode
    gen = BaseInfographic("FII & DII Net Flows – April 2026")
    gen.draw_base_elements()
    gen.draw.line([(PAD, 125), (WIDTH-PAD, 125)], fill=C_GOLD, width=1)
    start_y = 150
    row_step = 90
    for i, row in enumerate(DATA):
        y = start_y + i * row_step
        gen.draw_data_row(i, row, y, bar_height=11, spacing=11)
    gen.draw_summary()
    gen.draw.rectangle([PAD, HEIGHT-230, WIDTH-PAD, HEIGHT-55], outline=C_GOLD, width=3)
    return gen.img

def style_5_dynamic():
    # Dynamic Market Pulse
    gen = BaseInfographic("FII & DII Net Flows – April 2026")
    gen.draw_base_elements()
    for x in range(-WIDTH, WIDTH*2, 100):
        gen.draw.line([(x, 0), (x - 600, HEIGHT)], fill=(255, 255, 255, 25), width=2)
    
    start_y = 150
    row_step = 90
    for i, row in enumerate(DATA):
        y = start_y + i * row_step
        gen.draw_data_row(i, row, y, bar_height=11, spacing=11)
    gen.draw_summary()
    return gen.img

if __name__ == "__main__":
    output_dir = "infographics_output"
    os.makedirs(output_dir, exist_ok=True)
    
    styles = [
        ("style_1_minimalist", style_1_minimalist),
        ("style_2_bold", style_2_bold),
        ("style_3_timeline", style_3_timeline),
        ("style_4_premium", style_4_premium),
        ("style_5_dynamic", style_5_dynamic)
    ]
    
    for name, func in styles:
        print(f"Generating {name}...")
        img = func()
        img.save(os.path.join(output_dir, f"{name}.png"))
    
    print(f"Done! 5 infographics saved in {output_dir}/")
