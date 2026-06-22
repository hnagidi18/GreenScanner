# Green-Scanner Python Backend

FastAPI service that serves the trained U-Net model used by the Lovable
website's `/dashboard` upload form.

## Layout

```
backend/
├── main.py            # FastAPI app (POST /predict, GET /health)
├── predict_unet.py    # Loads models/unet_crop_weed_soil.pth and runs inference
└── models/
    └── unet_crop_weed_soil.pth   # Place your trained weights here
```

Copy the weights you trained locally into `backend/models/`:

```bash
mkdir -p backend/models
cp /path/to/unet_crop_weed_soil.pth backend/models/
```

## Install

```bash
pip install -r requirements.txt
```

## Run

```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

The frontend reads `VITE_API_URL` (defaults to `http://localhost:8000`)
and uploads images to `POST {VITE_API_URL}/predict`.

## Response shape

```json
{
  "segmentedImage": "data:image/png;base64,...",
  "cropPct": 42.13,
  "weedPct": 7.55,
  "soilPct": 50.32,
  "density": 7.55,
  "dose": 0.76,
  "saved": 9.24,
  "grid": [true, false, ...],   // 64 booleans (8x8 row-major)
  "onCount": 12
}
```

If `backend/models/unet_crop_weed_soil.pth` is missing, `/predict`
returns HTTP 503 with the message:

> U-Net model not found. Please train the model first using
> `python train_unet.py`.