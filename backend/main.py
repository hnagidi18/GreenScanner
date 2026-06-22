"""
backend/main.py
===============

FastAPI service that wraps the trained U-Net for Green-Scanner.

Run:
    uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

Endpoints:
    GET  /health   -> {"ok": true, "model_loaded": bool}
    POST /predict  -> multipart/form-data with field "file" (image)
                      returns JSON with base64 overlay + metrics + 8x8 grid.
"""

import base64
import io

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from backend.predict_unet import MODEL_PATH, ModelNotFoundError, predict

BASE_DOSE = 10.0  # L / acre at 100% weed density
GRID = 8          # 8x8 spray grid
WEED_CELL_THRESHOLD = 2.0  # % weed coverage in a cell to switch sprayer ON

app = FastAPI(title="Green-Scanner U-Net API", version="1.0.0")

# The Lovable preview origin is not fixed, so allow all during local use.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    import os
    return {"ok": True, "model_present": os.path.exists(MODEL_PATH)}


def _decode_image(raw: bytes) -> np.ndarray:
    arr = np.frombuffer(raw, dtype=np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is None:
        raise HTTPException(status_code=400, detail="Could not decode image. Please upload a valid JPG/PNG.")
    return bgr


def _encode_png_base64(rgb: np.ndarray) -> str:
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    ok, buf = cv2.imencode(".png", bgr)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to encode overlay PNG.")
    return "data:image/png;base64," + base64.b64encode(buf.tobytes()).decode("ascii")


def _spray_grid(weed_mask: np.ndarray):
    h, w = weed_mask.shape
    ch, cw = h / GRID, w / GRID
    grid = []
    on = 0
    for gy in range(GRID):
        for gx in range(GRID):
            y0, y1 = int(round(gy * ch)), int(round((gy + 1) * ch))
            x0, x1 = int(round(gx * cw)), int(round((gx + 1) * cw))
            cell = weed_mask[y0:y1, x0:x1]
            total = cell.size
            cov = (float(cell.sum()) / total * 100.0) if total else 0.0
            is_on = cov > WEED_CELL_THRESHOLD
            if is_on:
                on += 1
            grid.append(bool(is_on))
    return grid, on


@app.post("/predict")
async def predict_endpoint(file: UploadFile = File(...)):
    raw = await file.read()
    bgr = _decode_image(raw)

    try:
        crop_mask, weed_mask, soil_mask, overlay = predict(bgr)
    except ModelNotFoundError as e:
        # 503 = service unavailable; the API is up but the model isn't trained.
        raise HTTPException(status_code=503, detail=str(e))

    total = float(crop_mask.size)
    crop_pct = float(crop_mask.sum()) / total * 100.0
    weed_pct = float(weed_mask.sum()) / total * 100.0
    soil_pct = float(soil_mask.sum()) / total * 100.0

    density = weed_pct
    dose = round(BASE_DOSE * (weed_pct / 100.0), 2)
    saved = round(BASE_DOSE - dose, 2)

    grid, on_count = _spray_grid(weed_mask)

    return {
        "segmentedImage": _encode_png_base64(overlay),
        "cropPct": round(crop_pct, 2),
        "weedPct": round(weed_pct, 2),
        "soilPct": round(soil_pct, 2),
        "density": round(density, 2),
        "dose": dose,
        "saved": saved,
        "grid": grid,
        "onCount": on_count,
    }