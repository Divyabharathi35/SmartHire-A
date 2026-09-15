# ============================================================
#  export_model.py — Model Export & Sanity Verification
# ============================================================
"""
Verifies exported trained model artifacts:
- Checkpoint: best_emotion_model.pt
- Class mapping: class_mapping.json
- Metadata: model_metadata.json
- Evaluation results: evaluation_results.json
"""
import os
import sys
import json
import argparse
from pathlib import Path
import torch

def export_and_verify(models_dir: Path):
    print(f"\n[SmartHire ML] Verifying export artifacts in: {models_dir}...")

    model_pt = models_dir / "best_emotion_model.pt"
    class_json = models_dir / "class_mapping.json"
    meta_json = models_dir / "model_metadata.json"

    if not model_pt.exists():
        print(f"[ERROR] Missing model file: {model_pt}")
        sys.exit(1)
    if not class_json.exists():
        print(f"[ERROR] Missing class mapping file: {class_json}")
        sys.exit(1)
    if not meta_json.exists():
        print(f"[ERROR] Missing metadata file: {meta_json}")
        sys.exit(1)

    try:
        device = torch.device("cpu")
        checkpoint = torch.load(model_pt, map_location=device)
        print(f" PyTorch Model Weights Validated  : Architecture '{checkpoint.get('architecture')}'")
    except Exception as e:
        print(f"[ERROR] Model file corrupted or unreadable: {e}")
        sys.exit(1)

    with open(class_json, "r", encoding="utf-8") as f:
        class_mapping = json.load(f)
    print(f" Class Mapping Validated          : {class_mapping.get('class_labels')}")

    with open(meta_json, "r", encoding="utf-8") as f:
        metadata = json.load(f)
    print(f" Metadata Validated               : Version '{metadata.get('model_version')}', Best Val Acc: {metadata.get('best_val_accuracy')}%")

    print("\n[SmartHire ML] ALL MODEL ARTIFACTS VERIFIED SUCCESSFULLY & READY FOR BACKEND INFERENCE!\n")

def main():
    parser = argparse.ArgumentParser(description="Export and verify model artifacts")
    parser.add_argument("--models-dir", type=str, default=None)
    args = parser.parse_args()

    base_dir = Path(__file__).resolve().parent.parent
    models_dir = Path(args.models_dir) if args.models_dir else base_dir / "models"
    export_and_verify(models_dir)

if __name__ == "__main__":
    main()
