import fitz, os, glob, shutil

SOURCE_DIR = 'backend/storage/app/spike/icons/charcoal'
PUBLIC_ICONS_DIR = 'backend/public/pdf-assets/icons'
PUBLIC_ROOT_DIR = 'backend/public/pdf-assets'

THEMES = {
    'slate_blue': (37, 99, 235),
    'charcoal_grey': (63, 70, 80),
    'charcoal': (63, 70, 80),
    'dusty_plum': (122, 74, 106),
    'plum': (122, 74, 106),
    'mocha_brown': (108, 74, 56),
    'deep_teal': (15, 118, 110),
    'antique_gold': (197, 155, 39),
}

BASE_RGB = (56, 62, 71)

def recolor_badge_icon(src_path, dst_path, target_rgb):
    doc = fitz.open(src_path)
    pix = doc[0].get_pixmap(alpha=True)
    samples = bytearray(pix.samples)
    
    tr, tg, tb = target_rgb
    br, bg, bb = BASE_RGB
    base_lum = 0.299 * br + 0.587 * bg + 0.114 * bb
    
    for i in range(0, len(samples), 4):
        r, g, b, a = samples[i:i+4]
        if a == 0:
            continue
        
        # Unmultiply
        ur = (r * 255.0) / a
        ug = (g * 255.0) / a
        ub = (b * 255.0) / a
        
        lum = 0.299 * ur + 0.587 * ug + 0.114 * ub
        
        if lum <= base_lum:
            t = 0.0
        else:
            t = min(1.0, max(0.0, (lum - base_lum) / (255.0 - base_lum)))
            t = t ** 1.15
        
        nur = (1.0 - t) * tr + t * 255.0
        nug = (1.0 - t) * tg + t * 255.0
        nub = (1.0 - t) * tb + t * 255.0
        
        # Premultiply
        samples[i] = round((nur * a) / 255.0)
        samples[i+1] = round((nug * a) / 255.0)
        samples[i+2] = round((nub * a) / 255.0)
        
    new_pix = fitz.Pixmap(pix.colorspace, pix.width, pix.height, samples, True)
    os.makedirs(os.path.dirname(dst_path), exist_ok=True)
    new_pix.save(dst_path)

for theme_name, rgb in THEMES.items():
    print(f"Generating theme: {theme_name} {rgb}...")
    target_dir = os.path.join(PUBLIC_ICONS_DIR, theme_name)
    os.makedirs(target_dir, exist_ok=True)
    
    for src_file in glob.glob(os.path.join(SOURCE_DIR, '*.png')):
        fname = os.path.basename(src_file)
        dst_file = os.path.join(target_dir, fname)
        if fname == 'icon-terms.png':
            shutil.copy2(src_file, dst_file)
        else:
            recolor_badge_icon(src_file, dst_file, rgb)

# Also update root fallback icons in public/pdf-assets
for src_file in glob.glob(os.path.join(SOURCE_DIR, '*.png')):
    fname = os.path.basename(src_file)
    dst_file = os.path.join(PUBLIC_ROOT_DIR, fname)
    if fname == 'icon-terms.png':
        shutil.copy2(src_file, dst_file)
    else:
        recolor_badge_icon(src_file, dst_file, (37, 99, 235))

print("All icons successfully generated in color_type=6 Truecolor RGBA format!")
