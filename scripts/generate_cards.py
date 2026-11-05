import os
import subprocess
from PIL import Image, ImageDraw, ImageFont

cards_dir = os.path.join(os.path.dirname(__file__), '..', 'cards')
os.makedirs(cards_dir, exist_ok=True)

# Card Definitions
cards_data = [
    {
        'name': 'deleted',
        'title': 'Deleted from Local Disk',
        'subtitle': 'The selected media file has been permanently removed.',
        'details': 'Your local storage and media library have been updated.',
        'color': (248, 113, 113),  # Red / Coral
    },
    {
        'name': 'confirm-delete',
        'title': 'Confirm Deletion Required',
        'subtitle': 'Press Back (Esc) and click the Delete button AGAIN within 3 minutes to confirm.',
        'details': 'If you do nothing, no files will be deleted (3-minute safety lock).',
        'color': (251, 191, 36),  # Amber
    },
    {
        'name': 'cancelled',
        'title': 'Download Cancelled',
        'subtitle': 'The active background download was stopped and temporary files were removed.',
        'details': 'You can restart the download at any time from Stremio or the dashboard.',
        'color': (167, 139, 250),  # Purple
    },
    {
        'name': 'download-started',
        'title': 'Download Started',
        'subtitle': 'The background download has started.',
        'details': 'Track live transfer progress and manage media in your server dashboard.',
        'color': (52, 211, 153),  # Emerald / Green
    },
    {
        'name': 'select-source',
        'title': 'Choose Download Source',
        'subtitle': 'Select your preferred release & quality in the Source Picker window.',
        'details': 'Once chosen, your server will fetch and verify the stream automatically.',
        'color': (56, 189, 248),  # Sky / Blue
    }
]

# Fonts
font_title = ImageFont.truetype('C:\\Windows\\Fonts\\segoeui.ttf', 40)
font_sub = ImageFont.truetype('C:\\Windows\\Fonts\\segoeui.ttf', 23)
font_det = ImageFont.truetype('C:\\Windows\\Fonts\\segoeui.ttf', 17)

WIDTH = 1280
HEIGHT = 720
BG_COLOR = (15, 17, 26)  # Dark navy

for card in cards_data:
    img = Image.new('RGB', (WIDTH, HEIGHT), color=BG_COLOR)
    draw = ImageDraw.Draw(img)
    
    # Outer box
    box_x0 = 108
    box_y0 = 180
    box_x1 = 1172
    box_y1 = 540
    
    # Draw outline box with theme color
    draw.rectangle([box_x0, box_y0, box_x1, box_y1], outline=card['color'], width=2)
    
    # Text positions
    text_x = box_x0 + 60
    
    # Title
    draw.text((text_x, box_y0 + 70), card['title'], font=font_title, fill=card['color'])
    
    # Subtitle
    draw.text((text_x, box_y0 + 160), card['subtitle'], font=font_sub, fill=(255, 255, 255))
    
    # Details
    draw.text((text_x, box_y0 + 235), card['details'], font=font_det, fill=(148, 163, 184))
    
    out_png = os.path.join(cards_dir, f"{card['name']}.png")
    img.save(out_png, 'PNG')
    print(f"Generated {out_png}")

    out_mp4 = os.path.join(cards_dir, f"{card['name']}.mp4")
    cmd = [
        'ffmpeg', '-y',
        '-loop', '1', '-i', out_png,
        '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
        '-c:v', 'libx264', '-t', '3',
        '-pix_fmt', 'yuv420p',
        '-r', '5',
        '-c:a', 'aac',
        '-shortest',
        out_mp4
    ]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if res.returncode == 0:
        print(f"Encoded {out_mp4} ({os.path.getsize(out_mp4)} bytes)")
    else:
        print(f"Failed to encode {out_mp4}: {res.stderr.decode('utf-8')[:200]}")

