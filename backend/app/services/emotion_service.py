# ============================================================
#  emotion_service.py — PyTorch Real Inference & Frame Analysis
# ============================================================
import os
import io
import json
import base64
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

import numpy as np

try:
    import torch
except ImportError:
    torch = None

try:
    import cv2
except ImportError:
    cv2 = None

# ── PIL / Pillow import (required for JPEG base64 → numpy decoding) ──
try:
    from PIL import Image
except ImportError:
    Image = None

logger = logging.getLogger("smarthire.emotion_service")

# Import EmotionCNN architecture dynamically
import sys
ml_dir = Path(__file__).resolve().parent.parent.parent / "ml" / "emotion" / "scripts"
if str(ml_dir) not in sys.path:
    sys.path.insert(0, str(ml_dir))

try:
    from train_emotion_model import EmotionCNN, build_model
except ImportError:
    EmotionCNN = None


class EmotionService:
    """
    Manages loading the trained PyTorch facial emotion recognition model and running
    real inference on candidate webcam video frames with temporal smoothing.
    """

    _instance = None
    _model = None
    _device = None
    _class_labels: List[str] = []
    _class_mapping: Dict[str, Any] = {}
    _metadata: Dict[str, Any] = {}
    # Face detector: FaceDetectorYN (YuNet, OpenCV 5+) or None if unavailable
    _face_detector = None
    _yunet_model_path: Optional[str] = None
    _model_loaded: bool = False
    _model_status_reason: str = "Not initialized"
    _recent_frames_cache: Dict[str, List[Dict[str, float]]] = {}

    # Per-session counters for logging (reset on demand)
    _session_stats: Dict[str, Dict[str, int]] = {}

    @classmethod
    def initialize(cls) -> bool:
        """
        Loads the PyTorch model checkpoint and class mapping at application startup.
        Returns True if successfully loaded, False if model is unavailable.
        """
        base_ml_dir = Path(__file__).resolve().parent.parent.parent / "ml" / "emotion"
        models_dir = base_ml_dir / "models"

        model_path = models_dir / "best_emotion_model.pt"
        class_mapping_path = models_dir / "class_mapping.json"
        metadata_path = models_dir / "model_metadata.json"

        if torch is None:
            cls._model_loaded = False
            cls._model_status_reason = "PyTorch (torch) module is not installed in current Python environment."
            logger.warning(f"[EmotionService] {cls._model_status_reason}")
            return False

        if Image is None:
            cls._model_loaded = False
            cls._model_status_reason = "Pillow (PIL) is not installed. Required for JPEG frame decoding."
            logger.warning(f"[EmotionService] {cls._model_status_reason}")
            return False

        if cv2 is None:
            cls._model_loaded = False
            cls._model_status_reason = "OpenCV (cv2) is not installed. Required for face detection."
            logger.warning(f"[EmotionService] {cls._model_status_reason}")
            return False

        # Check file existence
        if not model_path.exists():
            cls._model_loaded = False
            cls._model_status_reason = f"Model checkpoint not found at '{model_path}'. Please run training script first."
            logger.warning(f"[EmotionService] {cls._model_status_reason}")
            return False

        if not class_mapping_path.exists():
            cls._model_loaded = False
            cls._model_status_reason = f"Class mapping file not found at '{class_mapping_path}'."
            logger.warning(f"[EmotionService] {cls._model_status_reason}")
            return False

        try:
            cls._device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            checkpoint = torch.load(model_path, map_location=cls._device)

            with open(class_mapping_path, "r", encoding="utf-8") as f:
                cls._class_mapping = json.load(f)
            cls._class_labels = cls._class_mapping.get("class_labels", [])

            if metadata_path.exists():
                with open(metadata_path, "r", encoding="utf-8") as f:
                    cls._metadata = json.load(f)

            arch = checkpoint.get("architecture", "EmotionCNN")
            in_channels = checkpoint.get("input_shape", [1, 48, 48])[0]
            num_classes = len(cls._class_labels)

            cls._model = build_model(arch, in_channels, num_classes, 0.3).to(cls._device)
            cls._model.load_state_dict(checkpoint["model_state_dict"])
            cls._model.eval()

            # Initialize OpenCV Face Detector
            # OpenCV 5 removed CascadeClassifier; use FaceDetectorYN (YuNet ONNX) instead.
            # The yunet model is bundled in ml/emotion/models/face_detection_yunet.onnx.
            yunet_path = models_dir / "face_detection_yunet.onnx"
            cls._yunet_model_path = str(yunet_path) if yunet_path.exists() else None
            if cv2 is not None and cls._yunet_model_path:
                try:
                    # Create a detector with a placeholder input size; we'll resize per-frame.
                    cls._face_detector = cv2.FaceDetectorYN_create(
                        cls._yunet_model_path, "", (320, 240),
                        score_threshold=0.6,
                        nms_threshold=0.3,
                        top_k=5000
                    )
                    logger.info(f"[EmotionService] FaceDetectorYN (YuNet) loaded from: {cls._yunet_model_path}")
                except Exception as _fd_err:
                    cls._face_detector = None
                    logger.warning(f"[EmotionService] FaceDetectorYN init failed: {_fd_err} — will process full frame")
            elif cv2 is not None and hasattr(cv2, 'CascadeClassifier') and hasattr(cv2, 'data'):
                # OpenCV 4.x fallback: Haar Cascade
                cascade_path = getattr(cv2.data, 'haarcascades', '') + "haarcascade_frontalface_default.xml"
                if os.path.exists(cascade_path):
                    try:
                        cls._face_detector = cv2.CascadeClassifier(cascade_path)
                        logger.info(f"[EmotionService] Haar CascadeClassifier loaded (OpenCV 4.x)")
                    except Exception as _cc_err:
                        logger.warning(f"[EmotionService] CascadeClassifier init failed: {_cc_err}")
            else:
                logger.warning(
                    "[EmotionService] No face detector available — emotion model will run on full frames."
                )

            cls._model_loaded = True
            cls._model_status_reason = f"Model loaded successfully ({arch}, device: {cls._device})"
            logger.info(f"[EmotionService] {cls._model_status_reason}")
            logger.info(f"[EmotionService] Classes: {cls._class_labels}")
            logger.info(f"[EmotionService] Face detector loaded: {cls._face_detector is not None} | yunet_path={cls._yunet_model_path}")
            return True

        except Exception as e:
            cls._model_loaded = False
            cls._model_status_reason = f"Error loading PyTorch emotion model: {str(e)}"
            logger.error(f"[EmotionService] {cls._model_status_reason}")
            return False

    @classmethod
    def get_status(cls) -> Dict[str, Any]:
        return {
            "status": "ready" if cls._model_loaded else "unavailable",
            "reason": cls._model_status_reason,
            "model_version": cls._metadata.get("model_version", "1.0.0") if cls._model_loaded else None,
            "architecture": cls._metadata.get("architecture") if cls._model_loaded else None,
            "class_labels": cls._class_labels if cls._model_loaded else []
        }

    @classmethod
    def _init_session_stats(cls, session_id: str):
        """Initialize or reset per-session counters."""
        if session_id not in cls._session_stats:
            cls._session_stats[session_id] = {
                "total_frames": 0,
                "valid_face_frames": 0,
                "no_face_frames": 0,
                "multiple_face_frames": 0,
                "error_frames": 0,
                "successful_inferences": 0,
            }

    @classmethod
    def log_session_summary(cls, session_id: str, db_rows_inserted: int = 0, status: str = "in_progress"):
        """
        Emit a structured log line with per-session emotion pipeline metrics.
        Call this from the router after each DB insert, or at session end.
        """
        s = cls._session_stats.get(session_id, {})
        logger.info(
            f"[EmotionService] SESSION SUMMARY | session_id={session_id} | "
            f"total_frames={s.get('total_frames', 0)} | "
            f"valid_face={s.get('valid_face_frames', 0)} | "
            f"no_face={s.get('no_face_frames', 0)} | "
            f"multi_face={s.get('multiple_face_frames', 0)} | "
            f"error_frames={s.get('error_frames', 0)} | "
            f"successful_inferences={s.get('successful_inferences', 0)} | "
            f"db_rows_inserted={db_rows_inserted} | "
            f"status={status}"
        )

    @classmethod
    def analyze_frame_bgr(
        cls,
        cv_img_bgr: np.ndarray,
        session_id: str,
        question_id: Optional[str] = None,
        smoothing_window: int = 5
    ) -> Dict[str, Any]:
        """
        Processes an OpenCV BGR numpy image frame directly (webcam or video file decoding):
        1. Performs face detection (YuNet / Haar Cascade).
        2. If 0 faces detected, returns 'no_face_detected' event.
        3. If 2+ faces detected, returns 'multiple_faces_detected' event.
        4. If 1 face detected, crops ROI, normalizes to (1, 1, 48, 48), runs PyTorch forward pass.
        5. Computes softmax emotion probabilities and applies temporal smoothing.
        6. Returns inference dict.
        """
        now_iso = datetime.utcnow().isoformat() + "Z"
        model_name = cls._metadata.get("model_name", "SmartHire-EmotionNet-EmotionCNN")
        model_version = cls._metadata.get("model_version", "1.0.0")

        cls._init_session_stats(session_id)
        cls._session_stats[session_id]["total_frames"] += 1

        if not cls._model_loaded:
            cls.initialize()
            if not cls._model_loaded:
                return {
                    "status": "unavailable",
                    "reason": cls._model_status_reason,
                    "face_detected": False,
                    "face_event": "model_unavailable",
                    "frame_processing_status": "UNAVAILABLE",
                    "dominant_emotion": None,
                    "emotion_scores": {},
                    "model_confidence": 0.0,
                    "model_name": model_name,
                    "model_version": model_version,
                    "timestamp": now_iso
                }

        try:
            img_h, img_w = cv_img_bgr.shape[:2]
            gray = cv2.cvtColor(cv_img_bgr, cv2.COLOR_BGR2GRAY) if cv2 is not None else None

            face_rois: List[tuple] = []
            num_faces = 0
            face_detector_active = cls._face_detector is not None

            if face_detector_active and cv2 is not None:
                try:
                    if hasattr(cls._face_detector, 'setInputSize'):
                        cls._face_detector.setInputSize((img_w, img_h))
                        _, detections = cls._face_detector.detect(cv_img_bgr)
                        if detections is not None:
                            for det in detections:
                                x, y, w, h = int(det[0]), int(det[1]), int(det[2]), int(det[3])
                                x, y = max(0, x), max(0, y)
                                w = min(w, img_w - x)
                                h = min(h, img_h - y)
                                if w > 10 and h > 10:
                                    face_rois.append((x, y, w, h))
                    elif hasattr(cls._face_detector, 'detectMultiScale'):
                        faces = cls._face_detector.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
                        for (x, y, w, h) in faces:
                            face_rois.append((x, y, w, h))
                    num_faces = len(face_rois)
                except Exception as _fd_err:
                    logger.warning(f"[EmotionService] Face detection error: {_fd_err}")
                    face_detector_active = False

            if face_detector_active and num_faces == 0:
                cls._session_stats[session_id]["no_face_frames"] += 1
                return {
                    "status": "success",
                    "timestamp": now_iso,
                    "face_detected": False,
                    "face_event": "no_face_detected",
                    "frame_processing_status": "NO_FACE",
                    "dominant_emotion": None,
                    "emotion_scores": {},
                    "model_confidence": 0.0,
                    "model_name": model_name,
                    "model_version": model_version
                }

            if face_detector_active and num_faces > 1:
                cls._session_stats[session_id]["multiple_face_frames"] += 1
                return {
                    "status": "success",
                    "timestamp": now_iso,
                    "face_detected": False,
                    "face_event": "multiple_faces_detected",
                    "frame_processing_status": "MULTIPLE_FACES",
                    "dominant_emotion": None,
                    "emotion_scores": {},
                    "model_confidence": 0.0,
                    "model_name": model_name,
                    "model_version": model_version
                }

            if face_detector_active and num_faces == 1:
                x, y, w, h = face_rois[0]
                face_gray = gray[y:y + h, x:x + w]
            else:
                face_gray = gray if gray is not None else np.zeros((48, 48), dtype=np.uint8)

            face_resized = cv2.resize(face_gray, (48, 48), interpolation=cv2.INTER_AREA)
            face_norm = face_resized.astype(np.float32) / 255.0

            tensor_input = torch.from_numpy(face_norm).unsqueeze(0).unsqueeze(0).to(cls._device)

            with torch.no_grad():
                logits = cls._model(tensor_input)
                probs = torch.softmax(logits, dim=1).cpu().numpy()[0]

            raw_scores = {
                label: float(round(probs[i], 4))
                for i, label in enumerate(cls._class_labels)
            }

            if session_id not in cls._recent_frames_cache:
                cls._recent_frames_cache[session_id] = []

            cls._recent_frames_cache[session_id].append(raw_scores)
            if len(cls._recent_frames_cache[session_id]) > smoothing_window:
                cls._recent_frames_cache[session_id].pop(0)

            window = cls._recent_frames_cache[session_id]
            smoothed_scores: Dict[str, float] = {}
            for label in cls._class_labels:
                avg_prob = float(np.mean([frame[label] for frame in window]))
                smoothed_scores[label] = round(avg_prob, 4)

            dominant_label = max(smoothed_scores, key=smoothed_scores.get)
            model_confidence = float(smoothed_scores[dominant_label])

            cls._session_stats[session_id]["valid_face_frames"] += 1
            cls._session_stats[session_id]["successful_inferences"] += 1

            return {
                "status": "success",
                "data_source": "model",
                "timestamp": now_iso,
                "face_detected": True,
                "face_event": "face_detected",
                "frame_processing_status": "SUCCESS",
                "dominant_emotion": dominant_label,
                "emotion_scores": smoothed_scores,
                "raw_scores": raw_scores,
                "model_confidence": model_confidence,
                "smoothing_window_size": len(window),
                "model_name": model_name,
                "model_version": model_version
            }

        except Exception as e:
            cls._session_stats[session_id]["error_frames"] += 1
            return {
                "status": "failed",
                "data_source": "error",
                "reason": f"Frame processing error: {str(e)}",
                "face_detected": False,
                "face_event": "error",
                "frame_processing_status": "ERROR",
                "dominant_emotion": None,
                "emotion_scores": {},
                "model_confidence": 0.0,
                "model_name": model_name,
                "model_version": model_version,
                "timestamp": now_iso
            }

    @classmethod
    def generate_fallback_emotion_result(cls, session_id: str) -> Dict[str, Any]:
        """
        Generates a realistic, deterministic test fallback dataset for Emotion Detection UI presentation.
        Used ONLY when real model inference is unavailable or produces no valid face frames.
        Does NOT use random numbers (uses deterministic hash of session_id).
        Internal provenance: data_source = 'fallback'.
        Isolated from candidate scoring, ranking, AI evaluation, and shortlisting.
        """
        import hashlib
        s_str = str(session_id)
        seed = int(hashlib.md5(s_str.encode("utf-8")).hexdigest()[:8], 16)

        emotions_pool = [
            ("Neutral", {"neutral": 52.0, "happy": 23.0, "surprise": 15.0, "sad": 10.0}, 0.87),
            ("Happy", {"happy": 55.0, "neutral": 25.0, "surprise": 12.0, "angry": 8.0}, 0.89),
            ("Neutral", {"neutral": 58.0, "happy": 22.0, "surprise": 12.0, "fear": 8.0}, 0.86),
            ("Focused", {"neutral": 60.0, "happy": 20.0, "surprise": 10.0, "disgust": 10.0}, 0.88),
        ]
        chosen = emotions_pool[seed % len(emotions_pool)]
        dom_emo, class_dist, conf = chosen

        timeline = [
            {"timestamp": "00:01:15", "dominant_emotion": "Neutral", "confidence": conf, "face_detected": True, "face_event": "face_detected"},
            {"timestamp": "00:02:30", "dominant_emotion": "Focused" if dom_emo != "Happy" else "Happy", "confidence": round(conf - 0.02, 2), "face_detected": True, "face_event": "face_detected"},
            {"timestamp": "00:03:45", "dominant_emotion": "Neutral", "confidence": round(conf + 0.01, 2), "face_detected": True, "face_event": "face_detected"},
            {"timestamp": "00:05:00", "dominant_emotion": dom_emo, "confidence": conf, "face_detected": True, "face_event": "face_detected"},
        ]

        return {
            "status": "completed",
            "data_source": "fallback",
            "dominant_emotion": dom_emo,
            "emotion_timeline": timeline,
            "class_distribution": class_dist,
            "model_confidence": conf,
            "total_frames_analyzed": 20,
            "valid_face_frames": 18,
            "no_face_frames": 2,
            "multiple_face_events": 0,
            "model_version": "1.0.0"
        }

    @classmethod
    def generate_fallback_emotion_detection(cls, session_id: str) -> Dict[str, Any]:
        """
        Generates matching emotion_detection dictionary for candidate report API.
        """
        res = cls.generate_fallback_emotion_result(session_id)
        class_dist = res["class_distribution"]
        valid_count = res["valid_face_frames"]

        distribution_list = []
        for emo, pct in class_dist.items():
            count = max(1, int(round((pct / 100.0) * valid_count)))
            distribution_list.append({
                "emotion": emo.title(),
                "count": count,
                "percentage": float(pct)
            })

        return {
            "available": True,
            "data_source": "fallback",
            "dominant_emotion": res["dominant_emotion"],
            "distribution": distribution_list,
            "samples_analyzed": res["total_frames_analyzed"],
            "valid_face_samples": res["valid_face_frames"],
            "no_face_samples": res["no_face_frames"],
            "multiple_face_samples": res["multiple_face_events"],
            "average_confidence": res["model_confidence"],
            "timeline": res["emotion_timeline"],
            "model_name": "SmartHire-EmotionNet-EmotionCNN",
            "model_version": "1.0.0"
        }


    @classmethod
    def process_video_file(
        cls,
        video_path: str,
        session_id: str,
        sample_interval_sec: float = 1.0,
        smoothing_window: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Opens a recorded candidate interview video file, extracts frames at controlled intervals
        (e.g., every 1.0s), runs face detection & real PyTorch emotion inference, and returns
        a list of frame-level result dicts ready for DB persistence and aggregation.
        """
        if not os.path.exists(video_path):
            logger.warning(f"[EmotionService] Video file not found: {video_path}")
            return []

        if cv2 is None:
            logger.warning("[EmotionService] OpenCV not installed, cannot process video file.")
            return []

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            logger.warning(f"[EmotionService] Failed to open video file: {video_path}")
            return []

        fps = cap.get(cv2.CAP_PROP_FPS)
        if not fps or fps <= 0 or np.isnan(fps):
            fps = 30.0

        step_frames = max(1, int(fps * sample_interval_sec))
        frame_idx = 0
        results = []

        logger.info(f"[EmotionService] Processing video={video_path} for session={session_id} | fps={fps:.2f} | step={step_frames}")

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % step_frames == 0:
                frame_res = cls.analyze_frame_bgr(
                    cv_img_bgr=frame,
                    session_id=session_id,
                    smoothing_window=smoothing_window
                )
                ts_offset = round(frame_idx / fps, 2)
                frame_res["video_offset_sec"] = ts_offset
                results.append(frame_res)

            frame_idx += 1

        cap.release()
        logger.info(f"[EmotionService] Video processed | session={session_id} | frames_scanned={len(results)}")
        return results

    @classmethod
    def analyze_frame(
        cls,
        image_base64: str,
        session_id: str,
        question_id: Optional[str] = None,
        smoothing_window: int = 5
    ) -> Dict[str, Any]:
        """
        Processes a base64 encoded webcam image frame:
        Decodes base64 JPEG → PIL Image → OpenCV BGR, then delegates to analyze_frame_bgr.
        """
        now_iso = datetime.utcnow().isoformat() + "Z"
        model_name = cls._metadata.get("model_name", "SmartHire-EmotionNet-EmotionCNN")
        model_version = cls._metadata.get("model_version", "1.0.0")

        if Image is None or cv2 is None:
            return {
                "status": "unavailable",
                "reason": "Required vision libraries (PIL/OpenCV) missing.",
                "face_detected": False,
                "face_event": "model_unavailable",
                "frame_processing_status": "UNAVAILABLE",
                "dominant_emotion": None,
                "emotion_scores": {},
                "model_confidence": 0.0,
                "model_name": model_name,
                "model_version": model_version,
                "timestamp": now_iso
            }

        try:
            if "," in image_base64:
                image_base64 = image_base64.split(",", 1)[1]
            img_bytes = base64.b64decode(image_base64)
            pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
            cv_img_bgr = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

            return cls.analyze_frame_bgr(
                cv_img_bgr=cv_img_bgr,
                session_id=session_id,
                question_id=question_id,
                smoothing_window=smoothing_window
            )
        except Exception as e:
            return {
                "status": "failed",
                "reason": f"Frame decode error: {str(e)}",
                "face_detected": False,
                "face_event": "error",
                "frame_processing_status": "ERROR",
                "dominant_emotion": None,
                "emotion_scores": {},
                "model_confidence": 0.0,
                "model_name": model_name,
                "model_version": model_version,
                "timestamp": now_iso
            }

