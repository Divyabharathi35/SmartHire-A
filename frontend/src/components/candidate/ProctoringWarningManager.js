// ============================================================
//  ProctoringWarningManager.js — Central Real-Time AI Proctoring Engine
// ============================================================
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';

export const PROCTORING_CONFIG = {
  LOOKING_AWAY_THRESHOLD_MS: 3000,
  MULTIPLE_FACE_THRESHOLD_MS: 1500,
  FACE_NOT_VISIBLE_THRESHOLD_MS: 3000,
  PHONE_CONFIDENCE_THRESHOLD: 0.40, // 0.40 threshold as required for debugging & real-world angles
  PHONE_REQUIRED_CONSECUTIVE_DETECTIONS: 3, // 3 consecutive detections required
  LOOKING_AWAY_WARNING_COOLDOWN_MS: 30000,
  MULTIPLE_FACE_WARNING_COOLDOWN_MS: 30000,
  SYNC_INTERVAL_MS: 6000,
};

export class ProctoringWarningManager {
  constructor(options = {}) {
    this.sessionId = options.sessionId || null;
    this.apiBase = options.apiBase || 'http://localhost:5000';
    this.onWarning = options.onWarning || null;
    this.onStatusChange = options.onStatusChange || null;
    this.onEventRecorded = options.onEventRecorded || null;

    // AI Models & Status
    this.objectModel = null;
    this.faceModel = null;
    this.isModelsLoading = false;
    this.modelStatus = 'LOADING'; // 'LOADING', 'READY', 'ERROR'
    
    // Live Camera & Debugging Pipeline Tracking
    this.videoRefConnected = false;
    this.videoReadyState = 0;
    this.streamTrackState = 'missing';
    this.cameraResolution = 'Waiting for live webcam...';
    this.detectionCycles = 0;
    this.rawPredictions = [];

    // Rolling Detection Buffer for Mobile Phone
    this.consecutivePhoneFrames = 0;
    this.phoneMissingFrames = 0;

    // Active continuous incident trackers
    this.activeIncidents = {
      LOOKING_AWAY: null,
      MOBILE_DEVICE_DETECTED: null,
      MULTIPLE_FACES: null,
      FACE_NOT_VISIBLE: null,
    };

    // Frame Persistence Trackers
    this.persistenceState = {
      lookingAway: { startTime: null, frames: 0, direction: null, confidence: 0 },
      multipleFaces: { startTime: null, frames: 0, count: 0 },
      faceNotVisible: { startTime: null, frames: 0 },
    };

    // Detailed Developer Debug Panel State
    this.statusPanel = {
      modelStatus: 'LOADING',
      videoRefConnected: false,
      videoReadyState: 0,
      cameraResolution: 'Waiting for live webcam...',
      streamTrackState: 'missing',
      detectionCycles: 0,
      rawPredictions: [],
      phoneDetectionCount: '0 / 3',
      phoneStatus: 'CLEAR',
      cameraActive: true,
      micActive: true,
      faceDetected: true,
      attentionStatus: 'NORMAL',
      environmentStatus: 'CLEAR',
    };

    // Batch event queue for PostgreSQL backend sync
    this.eventQueue = [];
    this.syncTimer = null;
    this.isProcessingFrame = false;
  }

  /**
   * Load TensorFlow.js engine & COCO-SSD object detection model
   */
  async initializeModels(onProgress = null) {
    if (this.modelStatus === 'READY' || this.isModelsLoading) return;
    this.isModelsLoading = true;
    this.modelStatus = 'LOADING';
    this.updateStatusPanel();

    try {
      if (onProgress) onProgress('AI Device Detection: LOADING...');
      await tf.ready();

      if (onProgress) onProgress('Loading COCO-SSD Object Detector...');
      
      try {
        this.objectModel = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
      } catch (_e) {
        this.objectModel = await cocoSsd.load();
      }

      // Load Face Landmarks model optional
      try {
        const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
        const detectorConfig = { runtime: 'tfjs', refineLandmarks: true, maxFaces: 4 };
        this.faceModel = await faceLandmarksDetection.createDetector(model, detectorConfig);
      } catch (fErr) {
        console.warn('[SmartHire Proctoring] FaceLandmarks detector optional load note:', fErr);
      }

      if (!this.objectModel) {
        throw new Error('COCO-SSD model failed to load');
      }

      this.modelStatus = 'READY';
      this.isModelsLoading = false;
      if (onProgress) onProgress('AI Device Detection: READY');
      console.log('[SmartHire Proctoring] COCO-SSD Object Detection Model successfully loaded & READY.');
    } catch (err) {
      console.error('[SmartHire Proctoring] ERROR loading COCO-SSD model:', err);
      this.modelStatus = 'ERROR';
      this.isModelsLoading = false;
      if (onProgress) onProgress('AI Device Detection: ERROR');
    } finally {
      this.updateStatusPanel();
    }
  }

  /**
   * Start periodic batch synchronization with PostgreSQL backend
   */
  startBackendSync() {
    if (this.syncTimer) clearInterval(this.syncTimer);
    this.syncTimer = setInterval(() => {
      this.flushQueueToBackend();
    }, PROCTORING_CONFIG.SYNC_INTERVAL_MS);
  }

  stopBackendSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    this.flushQueueToBackend();
  }

  /**
   * Helper to wait for video metadata & non-zero frame dimensions
   */
  async waitForVideoReady(videoElement) {
    if (!videoElement) return false;

    if (
      videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      videoElement.videoWidth > 0 &&
      videoElement.videoHeight > 0
    ) {
      return true;
    }

    return new Promise((resolve) => {
      let resolved = false;
      const check = () => {
        if (resolved) return;
        if (
          videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
          videoElement.videoWidth > 0 &&
          videoElement.videoHeight > 0
        ) {
          resolved = true;
          resolve(true);
        }
      };

      videoElement.onloadedmetadata = check;
      videoElement.oncanplay = check;
      videoElement.onloadeddata = check;

      const interval = setInterval(() => {
        check();
        if (resolved) clearInterval(interval);
      }, 100);

      setTimeout(() => {
        if (!resolved) {
          clearInterval(interval);
          resolve(
            videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
            videoElement.videoWidth > 0 &&
            videoElement.videoHeight > 0
          );
        }
      }, 2500);
    });
  }

  /**
   * Main Frame Processing Pipeline with Camera Frame Validation & Bounding Box Drawing
   */
  async processFrame(videoElement, canvasOverlayElement) {
    // 1. Verify Video Element Attachment & Ready State
    if (!videoElement) {
      this.videoRefConnected = false;
      this.videoReadyState = 0;
      this.streamTrackState = 'missing';
      this.cameraResolution = 'Waiting for live webcam...';
      this.updateStatusPanel();
      return;
    }

    this.videoRefConnected = true;
    this.videoReadyState = videoElement.readyState;
    
    const streamTrack = videoElement.srcObject?.getVideoTracks?.()?.[0];
    this.streamTrackState = streamTrack ? (streamTrack.readyState || 'live') : (videoElement.srcObject ? 'live' : 'missing');

    // 2. DO NOT RUN DETECTION UNTIL CAMERA RESOLUTION IS NON-ZERO (videoWidth > 0 & videoHeight > 0)
    if (
      videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      !videoElement.videoWidth ||
      !videoElement.videoHeight ||
      videoElement.paused ||
      videoElement.ended
    ) {
      this.cameraResolution = 'Waiting for live webcam...';
      this.updateStatusPanel();
      return;
    }

    if (this.isProcessingFrame) return;
    this.isProcessingFrame = true;

    try {
      const now = Date.now();
      const videoWidth = videoElement.videoWidth;
      const videoHeight = videoElement.videoHeight;
      this.cameraResolution = `${videoWidth} × ${videoHeight}`;
      this.detectionCycles++;

      let phoneDetected = false;
      let phoneScore = 0;
      let phoneBbox = null;
      let predictions = [];

      // 3. Run Real Object Detection on Live Video Element
      if (this.objectModel && this.modelStatus === 'READY') {
        predictions = await this.objectModel.detect(videoElement);

        // MANDATORY DETAILED DEBUG LOGGING REQUIREMENT:
        console.log("[SmartHire Object Detection]", {
          videoWidth,
          videoHeight,
          readyState: videoElement.readyState,
          predictions
        });

        // Store ALL raw predictions for the debug panel (Do NOT filter out non-phone objects)
        this.rawPredictions = predictions.map(p => ({
          class: p.class,
          score: Math.round(p.score * 100),
          rawScore: p.score,
          bbox: p.bbox,
        }));

        // Filter exact class "cell phone" with score >= 0.40
        const phonePreds = predictions.filter(
          p => p.class === 'cell phone' && p.score >= PROCTORING_CONFIG.PHONE_CONFIDENCE_THRESHOLD
        );

        if (phonePreds.length > 0) {
          phoneDetected = true;
          phoneScore = phonePreds[0].score;
          phoneBbox = phonePreds[0].bbox; // [x, y, width, height]
        }
      }

      // 4. Draw Real Bounding Box on Overlay Canvas
      if (canvasOverlayElement) {
        const ctx = canvasOverlayElement.getContext('2d');
        if (ctx) {
          const displayWidth = canvasOverlayElement.clientWidth || videoWidth;
          const displayHeight = canvasOverlayElement.clientHeight || videoHeight;

          if (canvasOverlayElement.width !== displayWidth || canvasOverlayElement.height !== displayHeight) {
            canvasOverlayElement.width = displayWidth;
            canvasOverlayElement.height = displayHeight;
          }

          ctx.clearRect(0, 0, canvasOverlayElement.width, canvasOverlayElement.height);

          // Draw bounding boxes for detected cell phone or all raw objects
          const itemsToDraw = phoneDetected && phoneBbox
            ? [{ class: 'cell phone', score: phoneScore, bbox: phoneBbox }]
            : (this.rawPredictions || []).slice(0, 2);

          for (const item of itemsToDraw) {
            if (!item.bbox) continue;
            const scaleX = displayWidth / videoWidth;
            const scaleY = displayHeight / videoHeight;

            const boxX = item.bbox[0] * scaleX;
            const boxY = item.bbox[1] * scaleY;
            const boxW = item.bbox[2] * scaleX;
            const boxH = item.bbox[3] * scaleY;

            const isPhone = item.class === 'cell phone';
            const strokeColor = isPhone ? '#ef4444' : '#3b82f6';
            const scorePct = typeof item.score === 'number' ? (item.score > 1 ? item.score : Math.round(item.score * 100)) : 0;

            // Draw rectangle
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = isPhone ? 3 : 2;
            ctx.strokeRect(boxX, boxY, boxW, boxH);

            // Draw label box & text
            const label = `[ ${item.class} ${scorePct}% ]`;
            ctx.font = 'bold 12px system-ui, sans-serif';
            const labelWidth = ctx.measureText(label).width + 10;
            const labelHeight = 20;
            const labelY = Math.max(0, boxY - labelHeight);

            ctx.fillStyle = strokeColor;
            ctx.fillRect(boxX, labelY, labelWidth, labelHeight);

            ctx.fillStyle = '#ffffff';
            ctx.fillText(label, boxX + 5, labelY + 14);
          }
        }
      }

      // 5. Face Detection & Attention Analysis
      let faceCount = 1;
      let gazeDirection = 'CENTER';
      let faceConfidence = 90;

      if (this.faceModel) {
        try {
          const faces = await this.faceModel.estimateFaces(videoElement);
          faceCount = faces.length;
          if (faceCount > 0 && faces[0].keypoints) {
            gazeDirection = this.analyzeHeadAndGazeDirection(faces[0].keypoints, videoWidth, videoHeight);
            faceConfidence = Math.round((faces[0].box?.score || 0.9) * 100);
          }
        } catch (_fErr) {}
      }

      // 6. Rolling Validation Buffer & Continuous Incident
      this.evaluateMobilePhone(phoneDetected, phoneScore, phoneBbox, now);

      this.evaluateFaceVisibility(faceCount, now);
      this.evaluateMultipleFaces(faceCount, now);
      this.evaluateLookingAway(faceCount, gazeDirection, faceConfidence, now);

      // 7. Update Detailed Debug Status Panel
      this.updateStatusPanel();

    } catch (err) {
      console.warn('[SmartHire Proctoring] Frame processing note:', err);
    } finally {
      this.isProcessingFrame = false;
    }
  }

  /**
   * Rolling Buffer (3 consecutive detections) & Continuous Incident Tracking
   */
  evaluateMobilePhone(phoneDetected, phoneScore, phoneBbox, now) {
    if (phoneDetected) {
      this.consecutivePhoneFrames++;
      this.phoneMissingFrames = 0;

      // Require 3 consecutive positive detections
      if (this.consecutivePhoneFrames >= PROCTORING_CONFIG.PHONE_REQUIRED_CONSECUTIVE_DETECTIONS) {
        const scorePct = Math.round(phoneScore * 100);

        if (!this.activeIncidents.MOBILE_DEVICE_DETECTED) {
          // Create active incident & trigger Warning
          const incident = {
            id: `MOBILE_DEVICE_DETECTED_${now}`,
            eventType: 'MOBILE_DEVICE_DETECTED',
            severity: 'HIGH',
            title: '🚨 MOBILE DEVICE DETECTED',
            message: 'A mobile phone has been detected in the camera view. Please remove the device from the interview area.',
            recommendation: 'Please remove all mobile phones and electronic devices from the camera view.',
            startTime: new Date(now).toISOString(),
            latestDetectionTime: new Date(now).toISOString(),
            duration: 0,
            detectionCount: this.consecutivePhoneFrames,
            maxConfidence: scorePct,
            averageConfidence: scorePct,
            sumConfidence: scorePct * this.consecutivePhoneFrames,
            metadata: {
              confidence: scorePct,
              maxConfidence: scorePct,
              averageConfidence: scorePct,
              detectionCount: this.consecutivePhoneFrames,
              bbox: phoneBbox,
              cameraResolution: this.cameraResolution,
            }
          };

          this.activeIncidents.MOBILE_DEVICE_DETECTED = incident;

          this.enqueueEvent({
            event_type: 'MOBILE_DEVICE_DETECTED',
            severity: 'HIGH',
            message: incident.message,
            timestamp: incident.startTime,
            duration: 0,
            metadata: incident.metadata,
          });

          if (this.onWarning) {
            this.onWarning(incident);
          }
        } else {
          // Update active incident
          const active = this.activeIncidents.MOBILE_DEVICE_DETECTED;
          active.latestDetectionTime = new Date(now).toISOString();
          active.detectionCount++;
          active.maxConfidence = Math.max(active.maxConfidence, scorePct);
          active.sumConfidence += scorePct;
          active.averageConfidence = Math.round(active.sumConfidence / active.detectionCount);
          
          const durSec = parseFloat(((now - new Date(active.startTime).getTime()) / 1000).toFixed(1));
          active.duration = durSec;

          active.metadata.confidence = active.averageConfidence;
          active.metadata.maxConfidence = active.maxConfidence;
          active.metadata.averageConfidence = active.averageConfidence;
          active.metadata.detectionCount = active.detectionCount;
          active.metadata.duration = durSec;
          active.metadata.bbox = phoneBbox;
        }
      }
    } else {
      if (this.activeIncidents.MOBILE_DEVICE_DETECTED) {
        this.phoneMissingFrames++;

        // Disappeared for > 1 sec (~5 frames)
        if (this.phoneMissingFrames >= 5) {
          const active = this.activeIncidents.MOBILE_DEVICE_DETECTED;
          const finalDuration = parseFloat(((new Date(active.latestDetectionTime).getTime() - new Date(active.startTime).getTime()) / 1000).toFixed(1));
          active.duration = finalDuration;

          this.enqueueEvent({
            event_type: 'MOBILE_DEVICE_DETECTED',
            severity: 'HIGH',
            message: `Mobile Phone Detected (Duration: ${finalDuration}s, Max Confidence: ${active.maxConfidence}%, Count: ${active.detectionCount})`,
            timestamp: active.startTime,
            duration: Math.round(finalDuration),
            metadata: {
              ...active.metadata,
              finalDuration,
              endTime: active.latestDetectionTime,
            }
          });

          this.activeIncidents.MOBILE_DEVICE_DETECTED = null;
          this.consecutivePhoneFrames = 0;
          this.phoneMissingFrames = 0;
        }
      } else {
        this.consecutivePhoneFrames = 0;
      }
    }
  }

  evaluateLookingAway(faceCount, gazeDirection, confidence, now) {
    const isAway = faceCount === 1 && gazeDirection !== 'CENTER';
    const state = this.persistenceState.lookingAway;

    if (isAway) {
      if (!state.startTime) {
        state.startTime = now;
        state.direction = gazeDirection;
        state.confidence = confidence;
      }
      state.frames++;
      const durationMs = now - state.startTime;
      if (durationMs >= PROCTORING_CONFIG.LOOKING_AWAY_THRESHOLD_MS) {
        this.triggerValidatedWarning({
          eventType: 'LOOKING_AWAY',
          severity: 'MEDIUM',
          title: '⚠ ATTENTION WARNING',
          message: 'Please keep your attention on the interview and look towards the camera.',
          recommendation: 'Look towards the camera to maintain interview focus.',
          durationSec: Math.round(durationMs / 1000),
          metadata: { direction: state.direction, confidence: state.confidence },
          cooldownMs: PROCTORING_CONFIG.LOOKING_AWAY_WARNING_COOLDOWN_MS,
          now
        });
      }
    } else {
      if (this.activeIncidents.LOOKING_AWAY) {
        this.closeActiveIncident('LOOKING_AWAY', now);
      }
      state.startTime = null;
      state.frames = 0;
    }
  }

  evaluateMultipleFaces(faceCount, now) {
    const isMultiple = faceCount >= 2;
    const state = this.persistenceState.multipleFaces;

    if (isMultiple) {
      if (!state.startTime) {
        state.startTime = now;
        state.count = faceCount;
      }
      state.frames++;
      const durationMs = now - state.startTime;
      if (durationMs >= PROCTORING_CONFIG.MULTIPLE_FACE_THRESHOLD_MS) {
        this.triggerValidatedWarning({
          eventType: 'MULTIPLE_FACES',
          severity: 'HIGH',
          title: '🚨 SECURITY WARNING',
          message: 'Multiple people detected. Only the candidate should be visible during the interview.',
          recommendation: 'Please ensure you are alone in your interview environment.',
          durationSec: Math.round(durationMs / 1000),
          metadata: { detected_faces: faceCount },
          cooldownMs: PROCTORING_CONFIG.MULTIPLE_FACE_WARNING_COOLDOWN_MS,
          now
        });
      }
    } else {
      if (this.activeIncidents.MULTIPLE_FACES) {
        this.closeActiveIncident('MULTIPLE_FACES', now);
      }
      state.startTime = null;
      state.frames = 0;
    }
  }

  evaluateFaceVisibility(faceCount, now) {
    const isMissing = faceCount === 0;
    const state = this.persistenceState.faceNotVisible;

    if (isMissing) {
      if (!state.startTime) state.startTime = now;
      state.frames++;
      const durationMs = now - state.startTime;
      if (durationMs >= PROCTORING_CONFIG.FACE_NOT_VISIBLE_THRESHOLD_MS) {
        this.triggerValidatedWarning({
          eventType: 'FACE_NOT_VISIBLE',
          severity: 'MEDIUM',
          title: '⚠ CAMERA WARNING',
          message: 'Your face is not clearly visible. Please return to the camera view.',
          recommendation: 'Position yourself in front of the camera.',
          durationSec: Math.round(durationMs / 1000),
          metadata: {},
          cooldownMs: 15000,
          now
        });
      }
    } else {
      if (this.activeIncidents.FACE_NOT_VISIBLE) {
        this.closeActiveIncident('FACE_NOT_VISIBLE', now);
      }
      state.startTime = null;
      state.frames = 0;
    }
  }

  analyzeHeadAndGazeDirection(keypoints, frameWidth, frameHeight) {
    if (!keypoints || keypoints.length < 5) return 'CENTER';
    const nose = keypoints.find(k => k.name === 'noseTip') || keypoints[1] || keypoints[0];
    const leftEye = keypoints.find(k => k.name === 'leftEye') || keypoints[33] || keypoints[1];
    const rightEye = keypoints.find(k => k.name === 'rightEye') || keypoints[263] || keypoints[2];
    if (!nose || !leftEye || !rightEye) return 'CENTER';

    const distToLeft = Math.hypot(nose.x - leftEye.x, nose.y - leftEye.y);
    const distToRight = Math.hypot(nose.x - rightEye.x, nose.y - rightEye.y);
    const eyeSpan = Math.abs(rightEye.x - leftEye.x) || 1;
    const horizontalRatio = (distToLeft - distToRight) / eyeSpan;

    if (horizontalRatio > 0.42) return 'LOOKING_LEFT';
    if (horizontalRatio < -0.42) return 'LOOKING_RIGHT';
    return 'CENTER';
  }

  handleTabSwitch(durationSec = 0) {
    const now = Date.now();
    this.triggerValidatedWarning({
      eventType: 'TAB_SWITCH',
      severity: 'MEDIUM',
      title: '⚠ INTERVIEW INTEGRITY WARNING',
      message: 'You left the interview window. Please remain on the SmartHire interview page.',
      recommendation: 'Do not switch browser tabs or open other applications during the test.',
      durationSec,
      metadata: { duration_outside_tab: durationSec },
      cooldownMs: 0,
      now
    });
  }

  handleFullscreenExit() {
    const now = Date.now();
    this.triggerValidatedWarning({
      eventType: 'FULLSCREEN_EXIT',
      severity: 'MEDIUM',
      title: '⚠ FULLSCREEN WARNING',
      message: 'You have exited fullscreen mode. Please return to fullscreen to continue.',
      recommendation: 'Return to fullscreen mode.',
      durationSec: 0,
      metadata: { action: 'fullscreen_exit' },
      cooldownMs: 5000,
      now
    });
  }

  handleCameraDisconnect() {
    const now = Date.now();
    this.statusPanel.cameraActive = false;
    this.updateStatusPanel();
    this.triggerValidatedWarning({
      eventType: 'CAMERA_DISCONNECTED',
      severity: 'HIGH',
      title: '🚨 CAMERA REQUIRED',
      message: 'Your camera connection was interrupted.',
      recommendation: 'Ensure your webcam is connected.',
      durationSec: 0,
      metadata: { status: 'disconnected' },
      cooldownMs: 0,
      now
    });
  }

  handleMicDisconnect() {
    const now = Date.now();
    this.statusPanel.micActive = false;
    this.updateStatusPanel();
    this.triggerValidatedWarning({
      eventType: 'MIC_DISCONNECTED',
      severity: 'HIGH',
      title: '🚨 MICROPHONE REQUIRED',
      message: 'Your microphone connection was interrupted.',
      recommendation: 'Check microphone connection.',
      durationSec: 0,
      metadata: { status: 'disconnected' },
      cooldownMs: 0,
      now
    });
  }

  triggerValidatedWarning({ eventType, severity, title, message, recommendation, durationSec, metadata, cooldownMs, now }) {
    if (this.activeIncidents[eventType]) {
      this.activeIncidents[eventType].duration = durationSec;
      return;
    }
    const incident = {
      id: `${eventType}_${now}`,
      eventType,
      severity,
      title,
      message,
      recommendation,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      duration: durationSec,
      metadata,
    };
    this.activeIncidents[eventType] = incident;
    this.enqueueEvent({
      event_type: eventType,
      severity,
      message,
      timestamp: incident.startTime,
      duration: durationSec,
      metadata,
    });
    if (this.onWarning) this.onWarning(incident);
  }

  closeActiveIncident(eventType, now) {
    if (this.activeIncidents[eventType]) {
      const inc = this.activeIncidents[eventType];
      inc.endTime = new Date(now).toISOString();
      this.enqueueEvent({
        event_type: eventType,
        severity: inc.severity,
        message: `${inc.message} (Resolved)`,
        timestamp: inc.startTime,
        duration: inc.duration,
        metadata: inc.metadata,
      });
      this.activeIncidents[eventType] = null;
    }
  }

  /**
   * Update Status Panel listener (Detailed Debug Panel Data)
   */
  updateStatusPanel() {
    this.statusPanel.modelStatus = this.modelStatus;
    this.statusPanel.videoRefConnected = this.videoRefConnected;
    this.statusPanel.videoReadyState = this.videoReadyState;
    this.statusPanel.cameraResolution = this.cameraResolution;
    this.statusPanel.streamTrackState = this.streamTrackState;
    this.statusPanel.detectionCycles = this.detectionCycles;
    this.statusPanel.rawPredictions = this.rawPredictions;
    this.statusPanel.phoneDetectionCount = `${Math.min(this.consecutivePhoneFrames, 3)} / 3`;
    this.statusPanel.phoneStatus = this.activeIncidents.MOBILE_DEVICE_DETECTED || this.consecutivePhoneFrames >= 3
      ? 'DETECTED' : 'CLEAR';

    if (this.onStatusChange) {
      this.onStatusChange({ ...this.statusPanel });
    }
  }

  enqueueEvent(eventObj) {
    this.eventQueue.push(eventObj);
    if (this.onEventRecorded) this.onEventRecorded(eventObj);
  }

  async flushQueueToBackend() {
    if (!this.sessionId || this.eventQueue.length === 0) return;
    const eventsToSend = [...this.eventQueue];
    this.eventQueue = [];

    try {
      const res = await fetch(`${this.apiBase}/api/interviews/${this.sessionId}/proctoring/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: eventsToSend }),
        credentials: 'include'
      });
      if (!res.ok) {
        this.eventQueue = [...eventsToSend, ...this.eventQueue];
      }
    } catch (_err) {
      this.eventQueue = [...eventsToSend, ...this.eventQueue];
    }
  }
}
