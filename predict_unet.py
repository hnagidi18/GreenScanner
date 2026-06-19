"""
predict_unet.py
===============

Load the trained U-Net and produce 3-class (soil/crop/weed) masks
plus a colored overlay.
"""

import os

import cv2
import numpy as np
import torch

from train_unet import UNet, IMG_SIZE, NUM_CLASSES

MODEL_PATH = "models/unet_crop_weed_soil.pth"

# Overlay colors (RGB)
SOIL_COLOR = np.array([139,  90,  43], dtype=np.uint8)   # brown
CROP_COLOR = np.array([ 34, 180,  70], dtype=np.uint8)   # green
WEED_COLOR = np.array([220,  40,  40], dtype=np.uint8)   # red

_model = None
_device = None


class ModelNotFoundError(FileNotFoundError):
    pass


def _load_model():
    global _model, _device
    if _model is not None:
        return _model, _device
    if not os.path.exists(MODEL_PATH):
        raise ModelNotFoundError(
            "U-Net model not found. Please train the model first using "
            "`python train_unet.py`."
        )
    _device = "cuda" if torch.cuda.is_available() else "cpu"
    m = UNet(NUM_CLASSES).to(_device)
    m.load_state_dict(torch.load(MODEL_PATH, map_location=_device))
    m.eval()
    _model = m
    return _model, _device


def predict(bgr: np.ndarray, alpha: float = 0.55):
    """
    Run U-Net on a BGR image.

    Returns:
        crop_mask, weed_mask, soil_mask : 2D bool arrays (same HxW as input)
        overlay                         : RGB uint8 image with colored classes
    """
    model, device = _load_model()

    h, w = bgr.shape[:2]
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    resized = cv2.resize(rgb, (IMG_SIZE, IMG_SIZE), interpolation=cv2.INTER_LINEAR)
    x = resized.astype(np.float32) / 255.0
    x = np.transpose(x, (2, 0, 1))[None, ...]
    x = torch.from_numpy(x).float().to(device)

    with torch.no_grad():
        logits = model(x)
        pred = torch.argmax(logits, dim=1)[0].cpu().numpy().astype(np.uint8)

    # Resize prediction back to original resolution
    pred_full = cv2.resize(pred, (w, h), interpolation=cv2.INTER_NEAREST)

    soil_mask = pred_full == 0
    crop_mask = pred_full == 1
    weed_mask = pred_full == 2

    overlay = rgb.copy()
    overlay[soil_mask] = SOIL_COLOR
    overlay[crop_mask] = CROP_COLOR
    overlay[weed_mask] = WEED_COLOR
    overlay = cv2.addWeighted(overlay, alpha, rgb, 1 - alpha, 0)

    return crop_mask, weed_mask, soil_mask, overlay