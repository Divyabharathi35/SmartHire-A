# SmartHire — AI-Powered Interview Platform

SmartHire is a full-stack AI-powered interview platform featuring a complete PyTorch Kaggle-dataset Emotion Detection training & real-time inference pipeline, speech-to-text integration, and candidate behavioral analytics.

**Frontend**: React 19 + Vite | **Backend**: FastAPI (Python) + PyTorch | **Database**: PostgreSQL

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 8, Recharts, Lucide React |
| Backend | FastAPI, Uvicorn, asyncpg, PyTorch 2.11, torchvision, scikit-learn, OpenCV |
| ML Pipeline | PyTorch (EmotionCNN / MobileNetV3), Kaggle API, PIL, NumPy, Pandas |
| Database | PostgreSQL 15+ |

---

## 🧠 Step 1 — Kaggle Emotion Model Training & Pipeline (Windows PowerShell)

Follow these exact steps in Windows PowerShell to validate, preprocess, train, and evaluate the facial emotion model on a real Kaggle dataset (e.g. FER-2013).

### 1.1 Dataset Setup

Option A — **Manual Download (Recommended)**:
1. Download a facial emotion recognition dataset zip from Kaggle (e.g. `msambare/fer2013` or `fer2013.csv`).
2. Extract the dataset into:
   `backend/ml/emotion/datasets/raw/`
   (Expected structure: `raw/train/<emotion_class>/image.jpg` or `raw/fer2013.csv`)

Option B — **Kaggle API Download**:
```powershell
$env:KAGGLE_USERNAME="your_username"
$env:KAGGLE_KEY="your_api_key"
python backend/ml/emotion/scripts/download_dataset.py --dataset msambare/fer2013
```

### 1.2 Validate Dataset
```powershell
python backend/ml/emotion/scripts/validate_dataset.py
```
*Verifies raw dataset readability, counts per-class image distribution, identifies invalid files, and saves `dataset_summary.json`.*

### 1.3 Preprocess & Split Dataset
```powershell
python backend/ml/emotion/scripts/prepare_dataset.py
```
*Resizes images to 48x48, normalizes pixel values, encodes emotion labels, applies reproducible train/val/test splits (seed 42), and saves `processed_dataset.npz`.*

### 1.4 Train PyTorch Emotion Model
```powershell
python backend/ml/emotion/scripts/train_emotion_model.py
```
*Trains the PyTorch model with Early Stopping, tracking real loss/accuracy metrics. Saves the best model checkpoint to `backend/ml/emotion/models/best_emotion_model.pt`.*

### 1.5 Evaluate Model on Held-Out Test Set
```powershell
python backend/ml/emotion/scripts/evaluate_emotion_model.py
```
*Evaluates saved model on the test split, generating overall accuracy, per-class precision/recall/F1, and confusion matrix saved to `evaluation_results.json`.*

### 1.6 Verify Exported Model Artifacts
```powershell
python backend/ml/emotion/scripts/export_model.py
```

---

## 🗄️ Step 2 — Database Setup

### 2.1 Create Database & Apply Migrations

```powershell
psql -U postgres -c "CREATE DATABASE smarthire;"
psql -U postgres -d smarthire -f Database/schema.sql
```
*On backend startup, `apply_migrations.py` automatically applies all pending migrations including migration `009_emotion_and_analytics_pipeline.sql`.*

---

## ⚙️ Step 3 — Start Backend API (FastAPI)

```powershell
cd backend
python main.py
```

You should see:
```
[SmartHire] API starting...
[SmartHire] PostgreSQL connected successfully
[SmartHire] PyTorch Emotion Service loaded successfully (EmotionCNN, device: cpu/cuda)
INFO: Uvicorn running on http://0.0.0.0:5000
```

> ⚠️ Note: If `best_emotion_model.pt` is missing, the backend will report `status: "unavailable"` for emotion analysis endpoints without returning fake fallback scores.

---

## 🖥️ Step 4 — Start Frontend (React + Vite)

Open a new terminal:
```powershell
cd frontend
npm install
npm run dev
```

Open your browser at `http://localhost:5173`.

---

## 🔒 Security & Git Policy

The following are automatically excluded via `.gitignore` and must NEVER be committed:
- Kaggle credentials (`kaggle.json`, `.env`)
- Raw dataset images (`backend/ml/emotion/datasets/`)
- PyTorch model checkpoints (`*.pt`, `*.pth`)
- Audio & video interview recordings (`backend/uploads/`)
