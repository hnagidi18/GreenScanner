"""
train_unet.py
=============

Train a 3-class U-Net (soil / crop / weed) for Green-Scanner.

Dataset layout:
    dataset/images/<name>.jpg
    dataset/masks/<name>.png       # either class-id mask (0/1/2) or RGB mask

RGB mask colors are auto-converted to class IDs:
    Brown  -> 0 (soil)
    Green  -> 1 (crop)
    Red    -> 2 (weed)

Run:
    python train_unet.py
"""

import os
import glob

import numpy as np
import cv2
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from torch.optim import Adam


IMG_DIR    = "dataset/images"
MASK_DIR   = "dataset/masks"
MODEL_PATH = "models/unet_crop_weed_soil.pth"
IMG_SIZE   = 256
NUM_CLASSES = 3
BATCH_SIZE = 4
EPOCHS     = 30
LR         = 1e-3

os.makedirs("models", exist_ok=True)


# ---------------------------------------------------------------------------
# RGB-mask -> class-id conversion
# ---------------------------------------------------------------------------
def rgb_mask_to_class(mask_rgb: np.ndarray) -> np.ndarray:
    """Map RGB mask colors to class IDs (0=soil, 1=crop, 2=weed)."""
    R, G, B = mask_rgb[..., 0].astype(np.int32), mask_rgb[..., 1].astype(np.int32), mask_rgb[..., 2].astype(np.int32)
    cls = np.zeros(mask_rgb.shape[:2], dtype=np.uint8)  # default soil
    crop = (G > R) & (G > B) & (G > 60)
    weed = (R > G) & (R > B) & (R > 80)
    cls[crop] = 1
    cls[weed] = 2
    return cls


def load_mask(path: str) -> np.ndarray:
    """Load a mask and return a 2D class-id array."""
    raw = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if raw is None:
        raise FileNotFoundError(path)
    if raw.ndim == 2:
        # Already class IDs
        cls = raw.astype(np.uint8)
    else:
        if raw.shape[2] == 4:
            raw = raw[..., :3]
        rgb = cv2.cvtColor(raw, cv2.COLOR_BGR2RGB)
        uniq = np.unique(rgb.reshape(-1, 3), axis=0)
        # If the mask only contains low integer values, treat as class IDs.
        if uniq.max() <= NUM_CLASSES:
            cls = rgb[..., 0].astype(np.uint8)
        else:
            cls = rgb_mask_to_class(rgb)
    cls[cls >= NUM_CLASSES] = 0
    return cls


# ---------------------------------------------------------------------------
# Dataset
# ---------------------------------------------------------------------------
class SegDataset(Dataset):
    def __init__(self, img_dir: str, mask_dir: str, size: int = IMG_SIZE):
        self.size = size
        self.pairs = []
        for img_path in sorted(glob.glob(os.path.join(img_dir, "*"))):
            name = os.path.splitext(os.path.basename(img_path))[0]
            for ext in (".png", ".jpg", ".jpeg"):
                m = os.path.join(mask_dir, name + ext)
                if os.path.exists(m):
                    self.pairs.append((img_path, m))
                    break
        if not self.pairs:
            raise RuntimeError(
                f"No image/mask pairs found in {img_dir} & {mask_dir}. "
                "Place matching files (same basename) into the dataset folders."
            )

    def __len__(self):
        return len(self.pairs)

    def __getitem__(self, i):
        img_path, mask_path = self.pairs[i]
        bgr = cv2.imread(img_path, cv2.IMREAD_COLOR)
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        rgb = cv2.resize(rgb, (self.size, self.size), interpolation=cv2.INTER_LINEAR)
        img = rgb.astype(np.float32) / 255.0
        img = np.transpose(img, (2, 0, 1))  # CHW

        cls = load_mask(mask_path)
        cls = cv2.resize(cls, (self.size, self.size), interpolation=cv2.INTER_NEAREST)

        return torch.from_numpy(img).float(), torch.from_numpy(cls).long()


# ---------------------------------------------------------------------------
# U-Net
# ---------------------------------------------------------------------------
def conv_block(in_c, out_c):
    return nn.Sequential(
        nn.Conv2d(in_c, out_c, 3, padding=1), nn.BatchNorm2d(out_c), nn.ReLU(inplace=True),
        nn.Conv2d(out_c, out_c, 3, padding=1), nn.BatchNorm2d(out_c), nn.ReLU(inplace=True),
    )


class UNet(nn.Module):
    def __init__(self, n_classes: int = NUM_CLASSES):
        super().__init__()
        self.e1 = conv_block(3,  64)
        self.e2 = conv_block(64, 128)
        self.e3 = conv_block(128, 256)
        self.e4 = conv_block(256, 512)
        self.pool = nn.MaxPool2d(2)

        self.b  = conv_block(512, 1024)

        self.u4 = nn.ConvTranspose2d(1024, 512, 2, stride=2)
        self.d4 = conv_block(1024, 512)
        self.u3 = nn.ConvTranspose2d(512, 256, 2, stride=2)
        self.d3 = conv_block(512, 256)
        self.u2 = nn.ConvTranspose2d(256, 128, 2, stride=2)
        self.d2 = conv_block(256, 128)
        self.u1 = nn.ConvTranspose2d(128, 64, 2, stride=2)
        self.d1 = conv_block(128, 64)

        self.out = nn.Conv2d(64, n_classes, 1)

    def forward(self, x):
        e1 = self.e1(x)
        e2 = self.e2(self.pool(e1))
        e3 = self.e3(self.pool(e2))
        e4 = self.e4(self.pool(e3))
        b  = self.b(self.pool(e4))
        d4 = self.d4(torch.cat([self.u4(b),  e4], dim=1))
        d3 = self.d3(torch.cat([self.u3(d4), e3], dim=1))
        d2 = self.d2(torch.cat([self.u2(d3), e2], dim=1))
        d1 = self.d1(torch.cat([self.u1(d2), e1], dim=1))
        return self.out(d1)


# ---------------------------------------------------------------------------
# Train
# ---------------------------------------------------------------------------
def main():
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[train_unet] device = {device}")

    ds = SegDataset(IMG_DIR, MASK_DIR)
    dl = DataLoader(ds, batch_size=BATCH_SIZE, shuffle=True, num_workers=0)
    print(f"[train_unet] samples = {len(ds)}")

    model = UNet(NUM_CLASSES).to(device)
    loss_fn = nn.CrossEntropyLoss()
    opt = Adam(model.parameters(), lr=LR)

    for epoch in range(1, EPOCHS + 1):
        model.train()
        running = 0.0
        for imgs, masks in dl:
            imgs, masks = imgs.to(device), masks.to(device)
            opt.zero_grad()
            logits = model(imgs)
            loss = loss_fn(logits, masks)
            loss.backward()
            opt.step()
            running += loss.item() * imgs.size(0)
        print(f"epoch {epoch:3d}/{EPOCHS}  loss={running / len(ds):.4f}")

    torch.save(model.state_dict(), MODEL_PATH)
    print(f"[train_unet] saved -> {MODEL_PATH}")


if __name__ == "__main__":
    main()