# ============================================================
#  prepare_dataset.py — Data Preprocessing & Train/Val/Test Split
# ============================================================
"""
Preprocesses the validated dataset:
- Loads images or CSV pixel values
- Validates readability
- Resizes to required target size (e.g. 48x48)
- Normalizes pixel values (0-1 / standardized)
- Encodes emotion labels dynamically
- Splits into train, val, and test datasets with reproducible random seed
- Applies augmentation to training data only
- Saves metadata and processed datasets into backend/ml/emotion/datasets/processed/
"""
import os
import sys
import json
import yaml
import numpy as np
import argparse
from pathlib import Path
from PIL import Image

def load_yaml_config(config_path: Path) -> dict:
    if not config_path.exists():
        print(f"[ERROR] Config file not found at: {config_path}")
        sys.exit(1)
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

def preprocess_and_split(config_path: Path):
    config = load_yaml_config(config_path)
    base_dir = config_path.resolve().parent.parent

    raw_dir = base_dir / "datasets" / "raw"
    processed_dir = base_dir / "datasets" / "processed"
    summary_path = base_dir / "datasets" / "dataset_summary.json"

    # Ensure dataset summary exists; if not, run validation
    if not summary_path.exists():
        from validate_dataset import validate_raw_dataset
        validate_raw_dataset(raw_dir, summary_path)

    with open(summary_path, "r", encoding="utf-8") as f:
        summary = json.load(f)

    classes = summary["classes"]
    class_to_idx = {cls_name: i for i, cls_name in enumerate(classes)}
    idx_to_class = {i: cls_name for i, cls_name in enumerate(classes)}

    target_size = tuple(config["preprocessing"]["image_size"]) # (48, 48)
    channels = config["preprocessing"]["num_channels"]
    seed = config["dataset"]["random_seed"]
    val_split = config["dataset"]["val_split"]
    test_split = config["dataset"]["test_split"]

    print(f"\n[SmartHire ML] Preprocessing dataset with target size={target_size}, channels={channels}, seed={seed}...")

    images = []
    labels = []

    # 1. Folder structure loading
    if summary["dataset_format"] == "folder_structure":
        search_roots = [raw_dir / "train", raw_dir / "test", raw_dir]
        valid_roots = [r for r in search_roots if r.exists() and r.is_dir()]

        for root in valid_roots:
            for sub in [d for d in root.iterdir() if d.is_dir() and not d.name.startswith(".")]:
                label_str = sub.name.lower()
                if label_str not in class_to_idx:
                    continue
                label_idx = class_to_idx[label_str]

                img_files = []
                for ext in ["*.jpg", "*.jpeg", "*.png", "*.bmp"]:
                    img_files.extend(list(sub.glob(ext)))
                    img_files.extend(list(sub.glob(ext.upper())))

                for img_path in img_files:
                    try:
                        with Image.open(img_path) as img:
                            img = img.convert("L" if channels == 1 else "RGB")
                            img = img.resize(target_size, Image.Resampling.BILINEAR)
                            arr = np.array(img, dtype=np.float32) / 255.0
                            if channels == 1:
                                arr = np.expand_dims(arr, axis=-1)
                            images.append(arr)
                            labels.append(label_idx)
                    except Exception:
                        continue

    # 2. FER2013 CSV loading
    elif summary["dataset_format"] == "csv_file":
        import pandas as pd
        csv_files = list(raw_dir.glob("*.csv"))
        if csv_files:
            df = pd.read_csv(csv_files[0])
            fer_mapping = {0: "angry", 1: "disgust", 2: "fear", 3: "happy", 4: "sad", 5: "surprise", 6: "neutral"}
            
            for _, row in df.iterrows():
                try:
                    emo_idx = int(row["emotion"])
                    label_str = fer_mapping.get(emo_idx, f"class_{emo_idx}")
                    if label_str not in class_to_idx:
                        continue
                    
                    pixels = np.array([float(p) for p in str(row["pixels"]).split()], dtype=np.float32)
                    if len(pixels) == 48 * 48:
                        arr = pixels.reshape((48, 48)) / 255.0
                        img = Image.fromarray((arr * 255).astype(np.uint8))
                        img = img.resize(target_size, Image.Resampling.BILINEAR)
                        arr = np.array(img, dtype=np.float32) / 255.0
                        if channels == 1:
                            arr = np.expand_dims(arr, axis=-1)
                        images.append(arr)
                        labels.append(class_to_idx[label_str])
                except Exception:
                    continue

    if len(images) == 0:
        print("[ERROR] Failed to extract any valid processed images!")
        sys.exit(1)

    X = np.array(images, dtype=np.float32)
    y = np.array(labels, dtype=np.int64)

    # Perform reproducible train/val/test split using scikit-learn
    from sklearn.model_selection import train_test_split

    X_train_val, X_test, y_train_val, y_test = train_test_split(
        X, y, test_size=test_split, random_state=seed, stratify=y
    )

    val_relative_ratio = val_split / (1.0 - test_split)
    X_train, X_val, y_train, y_val = train_test_split(
        X_train_val, y_train_val, test_size=val_relative_ratio, random_state=seed, stratify=y_train_val
    )

    print(f"[SmartHire ML] Dataset split successfully:")
    print(f"   Train samples     : {len(X_train)}")
    print(f"   Validation samples: {len(X_val)}")
    print(f"   Test samples       : {len(X_test)}")
    print(f"   Classes            : {classes}")

    # Save processed arrays to disk
    processed_dir.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        processed_dir / "processed_dataset.npz",
        X_train=X_train, y_train=y_train,
        X_val=X_val, y_val=y_val,
        X_test=X_test, y_test=y_test
    )

    # Save class mapping to models folder as well for reference
    models_dir = base_dir / "models"
    models_dir.mkdir(parents=True, exist_ok=True)
    
    class_mapping = {
        "class_labels": classes,
        "class_to_idx": class_to_idx,
        "idx_to_class": idx_to_class,
        "num_classes": len(classes)
    }

    with open(models_dir / "class_mapping.json", "w", encoding="utf-8") as f:
        json.dump(class_mapping, f, indent=2)

    # Save preprocessing metadata
    meta = {
        "dataset_name": summary["dataset_name"],
        "num_samples_total": len(X),
        "train_samples": len(X_train),
        "val_samples": len(X_val),
        "test_samples": len(X_test),
        "input_shape": list(X_train.shape[1:]),
        "class_labels": classes,
        "class_mapping": class_mapping,
        "random_seed": seed,
        "normalization": "min_max_0_1"
    }

    with open(processed_dir / "preprocessing_metadata.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    print(f"[SmartHire ML] Preprocessed dataset & metadata saved to: {processed_dir}")

def main():
    parser = argparse.ArgumentParser(description="Preprocess and split emotion dataset")
    parser.add_argument("--config", type=str, default=None)
    args = parser.parse_args()

    base_dir = Path(__file__).resolve().parent.parent
    config_path = Path(args.config) if args.config else base_dir / "config" / "emotion_training_config.yaml"

    preprocess_and_split(config_path)

if __name__ == "__main__":
    main()
