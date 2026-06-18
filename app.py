"""
Green-Scanner — app.py
======================

Standalone Python backend for the Green-Scanner dashboard.

Pipeline:

    Upload Image
        -> Image Processing
        -> Automatic Crop / Weed / Soil Segmentation
        -> Density Calculation
        -> Herbicide Required Calculation
        -> Chemical Saved Calculation
        -> Spray Grid Generation
        -> Display Output on Website

Run:
    streamlit run app.py
"""

import os
from io import BytesIO

import cv2
import numpy as np
import pandas as pd
import streamlit as st
from PIL import Image

# ---------------------------------------------------------------------------
# Page setup
# ---------------------------------------------------------------------------
st.set_page_config(page_title="Green-Scanner", page_icon="🌱", layout="wide")
st.title("🌱 Green-Scanner")
st.subheader("Crop, Weed and Soil Segmentation with Precision Spraying")
os.makedirs("outputs", exist_ok=True)

# Fixed agronomic constants (no manual tuning UI).
STANDARD_DOSE_L_PER_HA = 2.0
FIELD_AREA_HA = 1.0

# Overlay colors (RGB).
CROP_COLOR = np.array([34, 180, 70],  dtype=np.uint8)   # green
WEED_COLOR = np.array([220, 40, 40],  dtype=np.uint8)   # red
SOIL_COLOR = np.array([139, 90, 43],  dtype=np.uint8)   # brown


# ---------------------------------------------------------------------------
# Automatic segmentation
# ---------------------------------------------------------------------------
def segment_image(bgr: np.ndarray):
    """
    Fully automatic crop / weed / soil segmentation.

    Strategy:
      1. Convert to HSV + compute Excess Green (ExG) and Excess Red (ExR).
      2. Vegetation = pixels with strong green signal OR green-ish hue.
      3. Within vegetation, find healthy crop using Otsu on ExG so the
         crop/weed split adapts to the image's own brightness/contrast
         (works for no-weed, low-weed, and high-weed images alike).
      4. Weed candidates = vegetation that is NOT healthy crop, plus
         yellow / brown-tinged or desaturated vegetation patches.
      5. Morphological clean-up + connected-component filtering removes
         random red speckle so soil and crop are not misclassified.
      6. Soil = everything that is not vegetation.
    """
    h, w = bgr.shape[:2]
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB).astype(np.int32)
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)

    R, G, B = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    H, S, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]

    # Vegetation indices
    exg = (2 * G - R - B).astype(np.int32)              # green vigor
    exr = (1.4 * R - G).astype(np.int32)                # red/brown vigor

    # --- vegetation vs soil ------------------------------------------------
    veg_mask = (
        ((exg > 12) | ((H >= 25) & (H <= 95) & (S > 35)))
        & (V > 30)
        & (exg > exr - 10)
    )

    # Clean vegetation mask (close small holes, drop tiny specks).
    k3 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    veg_u8 = veg_mask.astype(np.uint8)
    veg_u8 = cv2.morphologyEx(veg_u8, cv2.MORPH_OPEN, k3, iterations=1)
    veg_u8 = cv2.morphologyEx(veg_u8, cv2.MORPH_CLOSE, k3, iterations=1)
    veg_mask = veg_u8.astype(bool)

    # --- adaptive crop vs weed split inside vegetation --------------------
    # Use Otsu on ExG of vegetation pixels — the threshold auto-adapts to
    # each image, so a uniformly healthy field stays mostly crop and a
    # heavily infested field surfaces large weed regions.
    crop_mask = np.zeros_like(veg_mask)
    weed_from_exg = np.zeros_like(veg_mask)

    if veg_mask.any():
        exg_veg = exg[veg_mask]
        # Normalize ExG of vegetation to 0..255 for Otsu.
        lo, hi = int(exg_veg.min()), int(exg_veg.max())
        if hi > lo:
            exg_norm_full = np.clip(
                ((exg - lo) * 255.0 / (hi - lo)), 0, 255
            ).astype(np.uint8)
            veg_vals = exg_norm_full[veg_mask]
            otsu_thr, _ = cv2.threshold(
                veg_vals, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU
            )
            # Healthy crop = vegetation with above-threshold ExG.
            crop_mask = veg_mask & (exg_norm_full >= otsu_thr)
            weed_from_exg = veg_mask & (exg_norm_full < otsu_thr)
        else:
            crop_mask = veg_mask.copy()

    # Color-based weed cues (work even when ExG split is weak).
    yellowish    = veg_mask & (H >= 18) & (H <= 38) & (S > 60)
    brownish_veg = veg_mask & (H < 22)  & (S > 35)
    dull_veg     = veg_mask & (S < 55)  & (exg < 25)

    weed_signal = weed_from_exg | yellowish | brownish_veg | dull_veg

    # --- safety net: if the whole field looks uniformly healthy, the     ---
    # --- Otsu split would still flag ~half as weed. Suppress that case   ---
    # --- by requiring weed pixels to actually look weedy (lower ExG OR   ---
    # --- weedy color). This keeps no-weed images near 0% weed.           ---
    healthy_floor = np.percentile(exg[veg_mask], 60) if veg_mask.any() else 0
    weed_signal = weed_signal & (
        (exg < healthy_floor) | yellowish | brownish_veg | dull_veg
    )

    # --- morphological clean-up + small-blob removal ----------------------
    weed_u8 = weed_signal.astype(np.uint8)
    weed_u8 = cv2.morphologyEx(weed_u8, cv2.MORPH_OPEN, k3, iterations=1)
    weed_u8 = cv2.morphologyEx(weed_u8, cv2.MORPH_CLOSE, k3, iterations=1)

    min_area = max(25, int(h * w * 0.0008))
    num, labels, stats, _ = cv2.connectedComponentsWithStats(weed_u8, connectivity=8)
    cleaned = np.zeros_like(weed_u8)
    for i in range(1, num):
        if stats[i, cv2.CC_STAT_AREA] >= min_area:
            cleaned[labels == i] = 1
    weed_mask = cleaned.astype(bool)

    # Final assignment: vegetation that isn't weed is crop; everything
    # non-vegetation is soil. Each pixel belongs to exactly one class.
    crop_mask = veg_mask & ~weed_mask
    soil_mask = ~veg_mask

    return crop_mask, weed_mask, soil_mask


def build_overlay(bgr: np.ndarray, crop_m, weed_m, soil_m, alpha: float = 0.55):
    """Semi-transparent crop/weed/soil overlay on top of the original image."""
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    overlay = rgb.copy()
    overlay[crop_m] = CROP_COLOR
    overlay[weed_m] = WEED_COLOR
    overlay[soil_m] = SOIL_COLOR
    return cv2.addWeighted(overlay, alpha, rgb, 1 - alpha, 0)


def spray_grid(weed_mask: np.ndarray, cells: int = 8, threshold: float = 0.08):
    """8x8 spray grid — a cell sprays if its weed fraction exceeds threshold."""
    h, w = weed_mask.shape
    grid = np.zeros((cells, cells), dtype=np.float32)
    ch, cw = h // cells, w // cells
    for r in range(cells):
        for c in range(cells):
            block = weed_mask[r * ch:(r + 1) * ch, c * cw:(c + 1) * cw]
            grid[r, c] = float(block.mean()) if block.size else 0.0
    spray = (grid >= threshold).astype(np.uint8)
    return grid, spray


# ---------------------------------------------------------------------------
# UI (no tuning controls — fully automatic)
# ---------------------------------------------------------------------------
uploaded_file = st.file_uploader(
    "Upload an aerial field image", type=["jpg", "jpeg", "png"]
)

if uploaded_file is None:
    st.info("Please upload an aerial field image to start analysis.")
    st.stop()

# ---- load image -----------------------------------------------------------
pil_img = Image.open(uploaded_file).convert("RGB")
bgr = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

# ---- segment --------------------------------------------------------------
crop_m, weed_m, soil_m = segment_image(bgr)
overlay = build_overlay(bgr, crop_m, weed_m, soil_m, alpha=0.55)

# ---- metrics --------------------------------------------------------------
total_px = bgr.shape[0] * bgr.shape[1]
crop_pct = 100.0 * crop_m.sum() / total_px
weed_pct = 100.0 * weed_m.sum() / total_px
soil_pct = 100.0 * soil_m.sum() / total_px

herbicide_required = STANDARD_DOSE_L_PER_HA * FIELD_AREA_HA * (weed_pct / 100.0)
chemical_saved_pct = max(0.0, 100.0 - weed_pct)
chemical_saved_l   = STANDARD_DOSE_L_PER_HA * FIELD_AREA_HA * (chemical_saved_pct / 100.0)

# ---- display --------------------------------------------------------------
c1, c2 = st.columns(2)
with c1:
    st.markdown("#### Uploaded image")
    st.image(pil_img, use_column_width=True)
with c2:
    st.markdown("#### Segmented overlay")
    st.image(overlay, use_column_width=True)

m1, m2, m3 = st.columns(3)
m1.metric("Crop Coverage",  f"{crop_pct:.1f}%")
m2.metric("Weed Density",   f"{weed_pct:.1f}%")
m3.metric("Soil Coverage",  f"{soil_pct:.1f}%")

h1, h2 = st.columns(2)
h1.metric("Herbicide Required", f"{herbicide_required:.2f} L")
h2.metric("Chemical Saved",     f"{chemical_saved_l:.2f} L ({chemical_saved_pct:.1f}%)")

# ---- spray grid -----------------------------------------------------------
st.markdown("## 🧴 Precision Spray Grid (8×8)")
grid, spray = spray_grid(weed_m, cells=8, threshold=0.08)
df = pd.DataFrame(spray, columns=[f"C{c+1}" for c in range(8)])
df.index = [f"R{r+1}" for r in range(8)]
st.dataframe(df.style.background_gradient(cmap="Reds"))

# ---- recommendation -------------------------------------------------------
st.markdown("## 💡 Recommendation")
if weed_pct < 5:
    st.success("Very low weed density. No spraying needed.")
elif weed_pct < 20:
    st.warning("Moderate weed density. Precision spraying recommended in weed zones.")
else:
    st.error("High weed density. Spraying recommended across multiple zones.")

st.markdown("## 🎨 Color Legend")
st.write("🟩 Green = Crop")
st.write("🟥 Red = Weed")
st.write("🟫 Brown = Soil")

# ---- save artefact --------------------------------------------------------
out_path = os.path.join("outputs", "segmented_overlay.png")
Image.fromarray(overlay).save(out_path)
buf = BytesIO()
Image.fromarray(overlay).save(buf, format="PNG")
st.download_button(
    "Download segmented overlay",
    data=buf.getvalue(),
    file_name="segmented_overlay.png",
    mime="image/png",
)
