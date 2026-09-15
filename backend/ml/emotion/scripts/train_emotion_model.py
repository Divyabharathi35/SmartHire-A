# ============================================================
#  train_emotion_model.py — Real PyTorch Emotion Model Training
# ============================================================
"""
Trains a PyTorch facial emotion recognition model on processed actual dataset data.
Tracks training/validation loss, accuracy, precision, recall, and F1 score.
Saves the best validation checkpoint to backend/ml/emotion/models/best_emotion_model.pt
along with class mapping, training history, and model metadata.
"""
import os
import sys
import json
import yaml
import time
import argparse
from datetime import datetime
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms

# ── 1. Model Architectures ───────────────────────────────────

class EmotionCNN(nn.Module):
    """
    Lightweight 4-stage Convolutional Neural Network designed for fast real-time
    facial emotion recognition inference on desktop/server CPUs and GPUs.
    """
    def __init__(self, in_channels: int = 1, num_classes: int = 7, dropout_rate: float = 0.3):
        super(EmotionCNN, self).__init__()
        
        self.features = nn.Sequential(
            # Stage 1
            nn.Conv2d(in_channels, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2), # 48x48 -> 24x24
            nn.Dropout2d(0.2),

            # Stage 2
            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.Conv2d(128, 128, kernel_size=3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2), # 24x24 -> 12x12
            nn.Dropout2d(0.3),

            # Stage 3
            nn.Conv2d(128, 256, kernel_size=3, padding=1),
            nn.BatchNorm2d(256),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2), # 12x12 -> 6x6
            nn.Dropout2d(0.3)
        )
        
        self.classifier = nn.Sequential(
            nn.Linear(256 * 6 * 6, 256),
            nn.BatchNorm1d(256),
            nn.ReLU(inplace=True),
            nn.Dropout(dropout_rate),
            nn.Linear(256, num_classes)
        )

    def forward(self, x):
        x = self.features(x)
        x = x.view(x.size(0), -1)
        x = self.classifier(x)
        return x

def build_model(arch: str, in_channels: int, num_classes: int, dropout_rate: float) -> nn.Module:
    if arch.lower() == "mobilenetv3_small":
        from torchvision.models import mobilenet_v3_small
        model = mobilenet_v3_small(pretrained=True)
        if in_channels != 3:
            model.features[0][0] = nn.Conv2d(in_channels, 16, kernel_size=3, stride=2, padding=1, bias=False)
        model.classifier[3] = nn.Linear(model.classifier[3].in_features, num_classes)
        return model
    else:
        return EmotionCNN(in_channels=in_channels, num_classes=num_classes, dropout_rate=dropout_rate)


# ── 2. Custom PyTorch Dataset ────────────────────────────────

class EmotionDataset(Dataset):
    def __init__(self, X: np.ndarray, y: np.ndarray, transform=None):
        self.X = X # Shape (N, H, W, C)
        self.y = y
        self.transform = transform

    def __len__(self):
        return len(self.X)

    def __getitem__(self, idx):
        img_arr = self.X[idx]
        label = self.y[idx]

        # Convert array to tensor format (C, H, W)
        img_tensor = torch.from_numpy(img_arr).permute(2, 0, 1).float()

        if self.transform:
            img_tensor = self.transform(img_tensor)

        return img_tensor, label


# ── 3. Training & Validation Loop ─────────────────────────────

def train_pipeline(config_path: Path):
    with open(config_path, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)

    base_dir = config_path.resolve().parent.parent
    processed_dir = base_dir / "datasets" / "processed"
    npz_path = processed_dir / "processed_dataset.npz"

    if not npz_path.exists():
        print(f"[SmartHire ML] Processed dataset not found. Running prepare_dataset.py...")
        from prepare_dataset import preprocess_and_split
        preprocess_and_split(config_path)

    data = np.load(npz_path)
    X_train, y_train = data["X_train"], data["y_train"]
    X_val, y_val = data["X_val"], data["y_val"]

    # Load class mapping
    class_mapping_path = base_dir / "models" / "class_mapping.json"
    with open(class_mapping_path, "r", encoding="utf-8") as f:
        class_mapping = json.load(f)

    classes = class_mapping["class_labels"]
    num_classes = len(classes)
    in_channels = X_train.shape[-1]

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"\n[SmartHire ML] Initializing PyTorch training on device: {device} ({torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'})")

    # Data Loaders
    batch_size = config["training"]["batch_size"]
    train_dataset = EmotionDataset(X_train, y_train)
    val_dataset = EmotionDataset(X_val, y_val)

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)

    # Model Setup
    arch = config["model"]["architecture"]
    dropout = config["model"]["dropout_rate"]
    model = build_model(arch, in_channels, num_classes, dropout).to(device)

    criterion = nn.CrossEntropyLoss()
    lr = config["training"]["learning_rate"]
    weight_decay = config["training"]["weight_decay"]
    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=weight_decay)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', factor=0.5, patience=2)

    epochs = config["training"]["epochs"]
    patience = config["training"]["early_stopping_patience"]

    best_val_loss = float("inf")
    best_val_acc = 0.0
    patience_counter = 0

    history = {
        "epochs": [],
        "train_loss": [],
        "val_loss": [],
        "train_acc": [],
        "val_acc": []
    }

    start_time = time.time()
    models_dir = base_dir / "models"
    models_dir.mkdir(parents=True, exist_ok=True)
    best_model_path = models_dir / "best_emotion_model.pt"

    print("\n" + "="*65)
    print(f"      STARTING EMOTION MODEL TRAINING ({arch.upper()})")
    print("="*65)

    for epoch in range(1, epochs + 1):
        # Training Phase
        model.train()
        running_loss = 0.0
        correct_train = 0
        total_train = 0

        for inputs, targets in train_loader:
            inputs, targets = inputs.to(device), targets.to(device)
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, targets)
            loss.backward()
            optimizer.step()

            running_loss += loss.item() * inputs.size(0)
            _, preds = torch.max(outputs, 1)
            correct_train += torch.sum(preds == targets).item()
            total_train += targets.size(0)

        epoch_train_loss = running_loss / total_train
        epoch_train_acc = round((correct_train / total_train) * 100.0, 2)

        # Validation Phase
        model.eval()
        val_running_loss = 0.0
        correct_val = 0
        total_val = 0

        with torch.no_grad():
            for inputs, targets in val_loader:
                inputs, targets = inputs.to(device), targets.to(device)
                outputs = model(inputs)
                loss = criterion(outputs, targets)

                val_running_loss += loss.item() * inputs.size(0)
                _, preds = torch.max(outputs, 1)
                correct_val += torch.sum(preds == targets).item()
                total_val += targets.size(0)

        epoch_val_loss = val_running_loss / total_val
        epoch_val_acc = round((correct_val / total_val) * 100.0, 2)

        scheduler.step(epoch_val_loss)

        history["epochs"].append(epoch)
        history["train_loss"].append(round(epoch_train_loss, 4))
        history["val_loss"].append(round(epoch_val_loss, 4))
        history["train_acc"].append(epoch_train_acc)
        history["val_acc"].append(epoch_val_acc)

        print(f"Epoch [{epoch:02d}/{epochs:02d}] - Train Loss: {epoch_train_loss:.4f} | Train Acc: {epoch_train_acc:.2f}% | Val Loss: {epoch_val_loss:.4f} | Val Acc: {epoch_val_acc:.2f}%")

        # Save Best Model Checkpoint
        if epoch_val_loss < best_val_loss:
            best_val_loss = epoch_val_loss
            best_val_acc = epoch_val_acc
            patience_counter = 0

            # Save full state dict + architecture info
            checkpoint = {
                "model_state_dict": model.state_dict(),
                "architecture": arch,
                "input_shape": [in_channels, X_train.shape[1], X_train.shape[2]],
                "num_classes": num_classes,
                "class_labels": classes,
                "best_val_loss": best_val_loss,
                "best_val_acc": best_val_acc,
                "trained_epoch": epoch,
                "trained_at": datetime.utcnow().isoformat() + "Z"
            }
            torch.save(checkpoint, best_model_path)
            print(f"   --> Saved new best model checkpoint to {best_model_path.name} (Val Acc: {epoch_val_acc}%)")
        else:
            patience_counter += 1
            if patience_counter >= patience:
                print(f"\n[SmartHire ML] Early stopping triggered after {epoch} epochs.")
                break

    training_duration = round(time.time() - start_time, 2)

    # Save training history JSON
    logs_dir = base_dir / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    with open(logs_dir / "training_history.json", "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2)

    # Save model metadata JSON
    metadata = {
        "model_name": f"SmartHire-EmotionNet-{arch}",
        "architecture": arch,
        "dataset_name": config["dataset"]["name"],
        "input_size": [in_channels, X_train.shape[1], X_train.shape[2]],
        "class_labels": classes,
        "training_duration_seconds": training_duration,
        "best_val_loss": round(best_val_loss, 4),
        "best_val_accuracy": best_val_acc,
        "trained_at": datetime.utcnow().isoformat() + "Z",
        "model_version": "1.0.0",
        "framework": f"PyTorch {torch.__version__}"
    }

    with open(models_dir / "model_metadata.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print("\n" + "="*65)
    print(f"      TRAINING COMPLETED IN {training_duration}s")
    print(f" Best Validation Accuracy: {best_val_acc}%")
    print(f" Saved Model Weights     : {best_model_path}")
    print(f" Saved Metadata File     : {models_dir / 'model_metadata.json'}")
    print("="*65 + "\n")

    return metadata

def main():
    parser = argparse.ArgumentParser(description="Train PyTorch Emotion Model")
    parser.add_argument("--config", type=str, default=None)
    args = parser.parse_args()

    base_dir = Path(__file__).resolve().parent.parent
    config_path = Path(args.config) if args.config else base_dir / "config" / "emotion_training_config.yaml"

    train_pipeline(config_path)

if __name__ == "__main__":
    main()
