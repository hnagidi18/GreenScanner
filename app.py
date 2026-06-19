"""
Green-Scanner — app.py
======================

Streamlit backend that runs the trained U-Net segmentation model on
uploaded aerial field images.

Pipeline:
    Upload Image
        -> U-Net prediction (predict_unet.py)
        -> Crop / Weed / Soil masks
        -> Density + herbicide metrics
        -> 8x8 spray grid
        -> Display results + save overlay to outputs/

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

from predict_unet import predict, ModelNotFoundError

# ---------------------------------------------------------------------------
# Page setup
# ---------------------------------------------------------------------------
st.set_page_config(page_title="Green-Scanner", page_icon="🌱", layout="wide")
st.title("🌱 Green-Scanner")
st.subheader("Crop, Weed and Soil Segmentation with Precision Spraying")
os.makedirs("outputs", exist_ok=True)

STANDARD_DOSE_L_PER_HA = 2.0
FIELD_AREA_HA = 1.0


def spray_grid(weed_mask: np.ndarray, cells: int = 8, threshold: float = 0.08):
    h, w = weed_mask.shape
    grid = np.zeros((cells, cells), dtype=np.float32)
    ch, cw = h // cells, w // cells
    for r in range(cells):
        for c in range(cells):
            block = weed_mask[r * ch:(r + 1) * ch, c * cw:(c + 1) * cw]
            grid[r, c] = float(block.mean()) if block.size else 0.0
    return grid, (grid >= threshold).astype(np.uint8)


# ---------------------------------------------------------------------------
# UI
# ---------------------------------------------------------------------------
uploaded_file = st.file_uploader(
    "Upload an aerial field image", type=["jpg", "jpeg", "png"]
)

if uploaded_file is None:
    st.info("Please upload an aerial field image to start analysis.")
    st.stop()

pil_img = Image.open(uploaded_file).convert("RGB")
bgr = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

# ---- segment via trained U-Net -------------------------------------------
try:
    crop_m, weed_m, soil_m, overlay = predict(bgr, alpha=0.55)
except ModelNotFoundError as e:
    st.error(str(e))
    st.stop()

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
_, spray = spray_grid(weed_m, cells=8, threshold=0.08)
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