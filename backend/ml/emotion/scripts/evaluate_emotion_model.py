# ============================================================
#  evaluate_emotion_model.py — Held-Out Test Set Evaluation
# ============================================================
"""
Evaluates trained PyTorch model exclusively on the real held-out test set.
Computes overall accuracy, per-class precision, recall, F1 score, and confusion matrix.
Saves results to backend/ml/emotion/models/evaluation_results.json.
"""
import os
import sys
import json
import yaml
import argparse
from datetime import datetime
from pathlib import Path

import numpy as np
import torch
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score

from train_emotion_model import EmotionDataset, build_model

def evaluate_model(config_path: Path):
    with open(config_path, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)

    base_dir = config_path.resolve().parent.parent
    models_dir = base_dir / "models"
    model_path = models_dir / "best_emotion_model.pt"

    if not model_path.exists():
        print(f"[ERROR] Trained model file not found at: {model_path}")
        print("Run train_emotion_model.py first!")
        sys.exit(1)

    npz_path = base_dir / "datasets" / "processed" / "processed_dataset.npz"
    if not npz_path.exists():
        print(f"[ERROR] Test dataset not found at: {npz_path}")
        sys.exit(1)

    data = np.load(npz_path)
    X_test, y_test = data["X_test"], data["y_test"]

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"\n[SmartHire ML] Loading checkpoint from: {model_path.name}")
    checkpoint = torch.load(model_path, map_location=device)

    classes = checkpoint["class_labels"]
    in_channels = checkpoint["input_shape"][0]
    num_classes = checkpoint["num_classes"]
    arch = checkpoint.get("architecture", "EmotionCNN")

    model = build_model(arch, in_channels, num_classes, 0.3).to(device)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    test_dataset = EmotionDataset(X_test, y_test)
    test_loader = torch.utils.data.DataLoader(test_dataset, batch_size=64, shuffle=False)

    all_preds = []
    all_targets = []

    with torch.no_grad():
        for inputs, targets in test_loader:
            inputs = inputs.to(device)
            outputs = model(inputs)
            _, preds = torch.max(outputs, 1)
            all_preds.extend(preds.cpu().numpy())
            all_targets.extend(targets.numpy())

    all_preds = np.array(all_preds)
    all_targets = np.array(all_targets)

    acc = round(accuracy_score(all_targets, all_preds) * 100.0, 2)
    report = classification_report(all_targets, all_preds, target_names=classes, output_dict=True, zero_division=0)
    cm = confusion_matrix(all_targets, all_preds).tolist()

    per_class_metrics = {}
    for cls_name in classes:
        if cls_name in report:
            per_class_metrics[cls_name] = {
                "precision": round(report[cls_name]["precision"], 4),
                "recall": round(report[cls_name]["recall"], 4),
                "f1_score": round(report[cls_name]["f1-score"], 4),
                "support": report[cls_name]["support"]
            }

    eval_summary = {
        "overall_accuracy": acc,
        "per_class_metrics": per_class_metrics,
        "confusion_matrix": cm,
        "test_samples": len(X_test),
        "class_labels": classes,
        "architecture": arch,
        "evaluation_timestamp": datetime.utcnow().isoformat() + "Z"
    }

    print("\n" + "="*60)
    print("      HELD-OUT TEST SET EVALUATION RESULTS")
    print("="*60)
    print(f" Test Accuracy    : {acc}%")
    print(f" Test Samples     : {len(X_test)}")
    print(f" Per-Class Metrics:\n{json.dumps(per_class_metrics, indent=2)}")
    print("="*60 + "\n")

    eval_out_path = models_dir / "evaluation_results.json"
    with open(eval_out_path, "w", encoding="utf-8") as f:
        json.dump(eval_summary, f, indent=2)

    # Also update model_metadata.json with test_metrics
    metadata_path = models_dir / "model_metadata.json"
    if metadata_path.exists():
        with open(metadata_path, "r", encoding="utf-8") as f:
            meta = json.load(f)
        meta["test_metrics"] = {
            "overall_accuracy": acc,
            "per_class_metrics": per_class_metrics,
            "test_samples": len(X_test)
        }
        with open(metadata_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2)

    print(f"[SmartHire ML] Saved evaluation summary to {eval_out_path}")
    return eval_summary

def main():
    parser = argparse.ArgumentParser(description="Evaluate Emotion Model on Test Set")
    parser.add_argument("--config", type=str, default=None)
    args = parser.parse_args()

    base_dir = Path(__file__).resolve().parent.parent
    config_path = Path(args.config) if args.config else base_dir / "config" / "emotion_training_config.yaml"

    evaluate_model(config_path)

if __name__ == "__main__":
    main()
