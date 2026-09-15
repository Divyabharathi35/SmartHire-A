# ============================================================
#  validate_dataset.py — Dataset Validation & Sanity Inspection
# ============================================================
"""
Validates raw dataset files placed in backend/ml/emotion/datasets/raw.
Verifies format, counts images per class, checks for invalid/corrupted files,
calculates class imbalance ratio, prints detected class labels, and saves dataset_summary.json.
"""
import os
import sys
import json
import glob
import argparse
from datetime import datetime
from pathlib import Path
from PIL import Image

def validate_raw_dataset(raw_dir: Path, output_summary_path: Path) -> dict:
    print(f"\n[SmartHire ML] Inspecting dataset in: {raw_dir}...")

    if not raw_dir.exists():
        print(f"[ERROR] Raw dataset directory does not exist: {raw_dir}")
        sys.exit(1)

    classes = []
    class_distribution = {}
    invalid_images = 0
    total_images = 0
    image_formats = set()
    dataset_format = "unknown"
    dataset_name = "Kaggle-Emotion-Dataset"

    # 1. Check for folder-based format (e.g., raw/train/angry or raw/angry)
    train_dir = raw_dir / "train"
    search_root = train_dir if train_dir.exists() else raw_dir

    subdirs = [d for d in search_root.iterdir() if d.is_dir() and not d.name.startswith(".")]

    if subdirs:
        dataset_format = "folder_structure"
        print(f"[SmartHire ML] Detected folder-based dataset structure at: {search_root}")
        
        for sub in sorted(subdirs):
            label = sub.name.lower()
            classes.append(label)
            class_count = 0
            
            # Find image files recursively in subfolder
            img_files = []
            for ext in ["*.jpg", "*.jpeg", "*.png", "*.bmp"]:
                img_files.extend(list(sub.glob(ext)))
                img_files.extend(list(sub.glob(ext.upper())))

            for img_path in img_files:
                try:
                    with Image.open(img_path) as img:
                        img.verify() # Verify file integrity
                        image_formats.add(img.format)
                        class_count += 1
                        total_images += 1
                except Exception as e:
                    print(f" [WARNING] Corrupted/Invalid image detected: {img_path} ({e})")
                    invalid_images += 1

            class_distribution[label] = class_count

        # Also inspect test/val folder if present to add counts
        test_dir = raw_dir / "test"
        if test_dir.exists():
            for sub in [d for d in test_dir.iterdir() if d.is_dir() and not d.name.startswith(".")]:
                label = sub.name.lower()
                img_files = []
                for ext in ["*.jpg", "*.jpeg", "*.png", "*.bmp"]:
                    img_files.extend(list(sub.glob(ext)))
                    img_files.extend(list(sub.glob(ext.upper())))

                for img_path in img_files:
                    try:
                        with Image.open(img_path) as img:
                            img.verify()
                            image_formats.add(img.format)
                            class_distribution[label] = class_distribution.get(label, 0) + 1
                            total_images += 1
                    except Exception:
                        invalid_images += 1

    else:
        # 2. Check for FER2013 CSV format
        csv_files = list(raw_dir.glob("*.csv"))
        if csv_files:
            dataset_format = "csv_file"
            csv_path = csv_files[0]
            print(f"[SmartHire ML] Detected FER2013 CSV dataset format: {csv_path.name}")
            try:
                import pandas as pd
                df = pd.read_csv(csv_path)
                if "emotion" in df.columns:
                    fer_mapping = {0: "angry", 1: "disgust", 2: "fear", 3: "happy", 4: "sad", 5: "surprise", 6: "neutral"}
                    counts = df["emotion"].value_counts().to_dict()
                    for k, v in counts.items():
                        label = fer_mapping.get(int(k), f"class_{k}")
                        class_distribution[label] = int(v)
                        if label not in classes:
                            classes.append(label)
                    total_images = len(df)
                    image_formats.add("CSV_PIXELS")
            except Exception as e:
                print(f"[ERROR] Failed to parse CSV dataset: {e}")

    if total_images == 0:
        print(f"\n[ERROR] No valid images found in {raw_dir}!")
        print("Expected dataset structure:")
        print("  Option A: backend/ml/emotion/datasets/raw/train/<emotion_class>/image.jpg")
        print("  Option B: backend/ml/emotion/datasets/raw/fer2013.csv")
        sys.exit(1)

    classes = sorted(list(set(classes)))
    
    # Calculate imbalance ratio (max / min count)
    counts = [v for v in class_distribution.values() if v > 0]
    imbalance_ratio = round(max(counts) / max(1, min(counts)), 2) if counts else 1.0

    summary = {
        "dataset_name": dataset_name,
        "dataset_format": dataset_format,
        "total_images": total_images,
        "classes": classes,
        "num_classes": len(classes),
        "class_distribution": class_distribution,
        "invalid_images": invalid_images,
        "image_formats": list(image_formats),
        "class_imbalance_ratio": imbalance_ratio,
        "validation_timestamp": datetime.utcnow().isoformat() + "Z"
    }

    # Print summary results to console
    print("\n" + "="*50)
    print("      DATASET VALIDATION SUMMARY RESULTS")
    print("="*50)
    print(f" Format Detected   : {dataset_format}")
    print(f" Total Images Found: {total_images}")
    print(f" Invalid Images    : {invalid_images}")
    print(f" Detected Classes  : {classes}")
    print(f" Class Counts      : {json.dumps(class_distribution, indent=2)}")
    print(f" Imbalance Ratio   : {imbalance_ratio}x")
    print("="*50 + "\n")

    # Save output summary file
    output_summary_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print(f"[SmartHire ML] Saved dataset summary JSON to: {output_summary_path}")
    return summary

def main():
    parser = argparse.ArgumentParser(description="Validate raw Kaggle emotion dataset")
    parser.add_argument("--raw-dir", type=str, default=None)
    parser.add_argument("--output-summary", type=str, default=None)
    args = parser.parse_args()

    base_dir = Path(__file__).resolve().parent.parent
    raw_dir = Path(args.raw_dir) if args.raw_dir else base_dir / "datasets" / "raw"
    summary_path = Path(args.output_summary) if args.output_summary else base_dir / "datasets" / "dataset_summary.json"

    validate_raw_dataset(raw_dir, summary_path)

if __name__ == "__main__":
    main()
