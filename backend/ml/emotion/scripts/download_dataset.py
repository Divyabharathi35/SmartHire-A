# ============================================================
#  download_dataset.py — Kaggle Emotion Dataset Downloader
# ============================================================
"""
Downloads a facial emotion recognition dataset from Kaggle securely.

Supported methods:
Method A (Manual): Place dataset folder/csv into backend/ml/emotion/datasets/raw/
Method B (Kaggle API): Run this script with KAGGLE_USERNAME and KAGGLE_KEY environment variables set.
"""
import os
import sys
import zipfile
import argparse
from pathlib import Path

def download_from_kaggle(dataset_handle: str, target_dir: str):
    print(f"[SmartHire ML] Preparing to download Kaggle dataset: '{dataset_handle}'...")
    
    # Check credentials
    username = os.environ.get("KAGGLE_USERNAME")
    key = os.environ.get("KAGGLE_KEY")
    kaggle_json_home = Path.home() / ".kaggle" / "kaggle.json"
    
    if not (username and key) and not kaggle_json_home.exists():
        print("\n[ERROR] Kaggle credentials not found!")
        print("To download via Kaggle API, either:")
        print(" 1. Set environment variables KAGGLE_USERNAME and KAGGLE_KEY")
        print(" 2. Place kaggle.json in ~/.kaggle/kaggle.json")
        print("\nAlternatively, use MANUAL DOWNLOAD:")
        print(f"   Download dataset zip directly from https://www.kaggle.com/datasets/{dataset_handle}")
        print(f"   Extract contents into: {os.path.abspath(target_dir)}")
        sys.exit(1)
        
    try:
        from kaggle.api.kaggle_api_extended import KaggleApi
        api = KaggleApi()
        api.authenticate()
        
        target_path = Path(target_dir)
        target_path.mkdir(parents=True, exist_ok=True)
        
        print(f"[SmartHire ML] Downloading '{dataset_handle}' to {target_path}...")
        api.dataset_download_files(dataset_handle, path=str(target_path), unzip=True)
        print(f"[SmartHire ML] Dataset successfully downloaded and extracted to {target_path}")
        
    except Exception as e:
        print(f"\n[ERROR] Kaggle API Download failed: {e}")
        print("Please check your internet connection or Kaggle credentials, or download manually.")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Download Kaggle Emotion Dataset")
    parser.add_argument("--dataset", type=str, default="msambare/fer2013", help="Kaggle dataset handle (e.g. msambare/fer2013)")
    parser.add_argument("--target-dir", type=str, default=None, help="Directory to extract dataset into")
    args = parser.parse_args()

    base_dir = Path(__file__).resolve().parent.parent
    target_dir = args.target_dir or str(base_dir / "datasets" / "raw")

    download_from_kaggle(args.dataset, target_dir)

if __name__ == "__main__":
    main()
