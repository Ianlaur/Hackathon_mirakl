"""Generate self-contained HTML files by inlining images as base64.

Runs on pitch-leia.html (EN) and pitch-leia-fr.html (FR),
producing pitch-leia-standalone.html and pitch-leia-fr-standalone.html.
"""

import base64
import sys
from pathlib import Path

pitch_dir = Path(__file__).parent
images = ["jean-charles.png", "jean-charles-pro-max.png", "dashboard.png"]

# Pre-compute data URIs once
data_uris = {}
for img_name in images:
    img_path = pitch_dir / img_name
    if not img_path.exists():
        print(f"[skip] {img_name} not found", file=sys.stderr)
        continue
    b64 = base64.b64encode(img_path.read_bytes()).decode("ascii")
    data_uris[img_name] = f"data:image/png;base64,{b64}"
    print(f"[ok] loaded {img_name} ({img_path.stat().st_size/1024:.0f} KB)")

def inline(source_name: str, target_name: str):
    src = pitch_dir / source_name
    tgt = pitch_dir / target_name
    if not src.exists():
        print(f"\n[skip] {source_name} not found", file=sys.stderr)
        return
    html = src.read_text(encoding="utf-8")
    replaced = 0
    for img_name, data_uri in data_uris.items():
        marker = f'src="{img_name}"'
        if marker in html:
            html = html.replace(marker, f'src="{data_uri}"')
            replaced += 1
    tgt.write_text(html, encoding="utf-8")
    size_mb = len(html.encode("utf-8")) / 1024 / 1024
    print(f"\n[build] {source_name} -> {target_name}")
    print(f"        {size_mb:.1f} MB · {replaced} images inlined")

inline("pitch-leia.html", "pitch-leia-standalone.html")
inline("pitch-leia-fr.html", "pitch-leia-fr-standalone.html")
