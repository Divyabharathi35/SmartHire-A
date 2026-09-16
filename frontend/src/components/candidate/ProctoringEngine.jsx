// ============================================================
//  ProctoringEngine.jsx — Real-time AI Proctoring Component with Live Warnings & Important Debug Panel
// ============================================================
import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, ShieldAlert, ShieldCheck, Cpu
} from 'lucide-react';
import { ProctoringWarningManager, PROCTORING_CONFIG } from './ProctoringWarningManager';

export default function ProctoringEngine({
  sessionId,
  videoRef,
  mediaStream,
  isActive = true,
  onIntegrityUpdate = null
}) {
  const [activeWarning, setActiveWarning] = useState(null);
  const [statusPanel, setStatusPanel] = useState({
    modelStatus: 'LOADING',
    videoRefConnected: false,
    videoReadyState: 0,
    cameraResolution: 'Waiting for live webcam...',
    streamTrackState: 'missing',
    detectionCycles: 0,
    rawPredictions: [],
    phoneDetectionCount: '0 / 3',
    phoneStatus: 'CLEAR',
  });

  const warningManagerRef = useRef(null);
  const bboxCanvasRef = useRef(null);
  const processTimerRef = useRef(null);

  // 1. Initialize ProctoringWarningManager & Load COCO-SSD Model ONCE
  useEffect(() => {
    if (!sessionId) return;

    const manager = new ProctoringWarningManager({
      sessionId,
      onWarning: (warningObj) => {
        setActiveWarning(warningObj);
      },
      onStatusChange: (statusObj) => {
        setStatusPanel(statusObj);
      },
      onEventRecorded: (ev) => {
        if (onIntegrityUpdate) {
          onIntegrityUpdate(ev);
        }
      }
    });

    warningManagerRef.current = manager;
    manager.initializeModels();
    manager.startBackendSync();

    return () => {
      if (warningManagerRef.current) {
        warningManagerRef.current.stopBackendSync();
      }
    };
  }, [sessionId, onIntegrityUpdate]);

  // 2. Ensure Video Element Receives MediaStream as soon as mounted
  useEffect(() => {
    if (videoRef && videoRef.current && mediaStream) {
      const v = videoRef.current;
      if (v.srcObject !== mediaStream) {
        v.srcObject = mediaStream;
      }
      v.play().catch(_e => {});
    }
  }, [videoRef, mediaStream, isActive]);

  // 3. Tab switch & Fullscreen event listeners
  useEffect(() => {
    if (!isActive) return;
    let tabSwitchStart = null;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        tabSwitchStart = Date.now();
      } else if (document.visibilityState === 'visible' && tabSwitchStart) {
        const durSec = Math.round((Date.now() - tabSwitchStart) / 1000);
        tabSwitchStart = null;
        if (warningManagerRef.current) {
          warningManagerRef.current.handleTabSwitch(durSec);
        }
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (warningManagerRef.current) {
          warningManagerRef.current.handleFullscreenExit();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [isActive]);

  // 4. Attach Canvas Overlay to Parent Video Element Container
  useEffect(() => {
    if (!videoRef || !videoRef.current) return;
    const videoElem = videoRef.current;
    const parentContainer = videoElem.parentElement;

    if (!parentContainer) return;

    if (getComputedStyle(parentContainer).position === 'static') {
      parentContainer.style.position = 'relative';
    }

    let canvas = parentContainer.querySelector('#proctoring-bbox-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'proctoring-bbox-canvas';
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '15';
      parentContainer.appendChild(canvas);
    }
    bboxCanvasRef.current = canvas;
  }, [videoRef]);

  // 5. Throttled Detection Loop (~200ms interval / ~5 fps)
  useEffect(() => {
    if (!isActive) return;

    const runDetectionCycle = async () => {
      if (videoRef && videoRef.current && warningManagerRef.current) {
        // Enforce mediaStream assignment if missing
        if (mediaStream && videoRef.current.srcObject !== mediaStream) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(() => {});
        }
        await warningManagerRef.current.processFrame(videoRef.current, bboxCanvasRef.current);
      }
    };

    processTimerRef.current = setInterval(runDetectionCycle, 200);

    return () => {
      if (processTimerRef.current) {
        clearInterval(processTimerRef.current);
        processTimerRef.current = null;
      }
    };
  }, [isActive, videoRef, mediaStream]);

  const handleAcknowledgeWarning = () => {
    setActiveWarning(null);
  };

  return (
    <>
      {/* Important Debug Mode Panel (Required UI Specification) */}
      <div
        className="proctoring-debug-panel"
        style={{
          position: 'absolute',
          top: 14,
          right: 14,
          zIndex: 90,
          background: 'rgba(15, 23, 42, 0.94)',
          backdropFilter: 'blur(14px)',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          borderRadius: 12,
          padding: '14px 18px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.55)',
          color: '#fff',
          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
          fontSize: '0.78rem',
          minWidth: '290px',
          maxWidth: '340px',
        }}
      >
        <div style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.08em', color: '#38bdf8', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.12)', pb: 6 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Cpu size={14} color="#38bdf8" /> AI OBJECT DETECTION DEBUG
          </span>
          <ShieldCheck size={14} color={statusPanel.modelStatus === 'READY' ? '#10b981' : '#f59e0b'} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* MODEL */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#94a3b8' }}>MODEL:</span>
            <span style={{ fontWeight: 700, color: statusPanel.modelStatus === 'READY' ? '#10b981' : (statusPanel.modelStatus === 'LOADING' ? '#f59e0b' : '#ef4444') }}>
              {statusPanel.modelStatus === 'READY' ? '🟢 COCO-SSD Ready' : (statusPanel.modelStatus === 'LOADING' ? '🟡 LOADING...' : '🔴 ERROR')}
            </span>
          </div>

          {/* VIDEO REF */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#94a3b8' }}>VIDEO REF:</span>
            <span style={{ fontWeight: 700, color: statusPanel.videoRefConnected ? '#10b981' : '#ef4444' }}>
              {statusPanel.videoRefConnected ? '🟢 Connected' : '🔴 Missing'}
            </span>
          </div>

          {/* VIDEO READY STATE */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#94a3b8' }}>VIDEO READY STATE:</span>
            <span style={{ fontWeight: 700, color: statusPanel.videoReadyState >= 2 ? '#10b981' : '#f59e0b' }}>
              {statusPanel.videoReadyState} {statusPanel.videoReadyState >= 2 ? '(HAVE_DATA)' : ''}
            </span>
          </div>

          {/* CAMERA FRAME */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#94a3b8' }}>CAMERA FRAME:</span>
            <span style={{ fontWeight: 700, color: statusPanel.cameraResolution.includes('×') || statusPanel.cameraResolution.includes('x') ? '#10b981' : '#f59e0b' }}>
              {statusPanel.cameraResolution.includes('×') || statusPanel.cameraResolution.includes('x')
                ? `🟢 ${statusPanel.cameraResolution}`
                : `🟡 ${statusPanel.cameraResolution}`}
            </span>
          </div>

          {/* STREAM TRACK */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#94a3b8' }}>STREAM TRACK:</span>
            <span style={{ fontWeight: 700, color: statusPanel.streamTrackState === 'live' ? '#10b981' : '#ef4444' }}>
              {statusPanel.streamTrackState === 'live' ? '🟢 live' : `🔴 ${statusPanel.streamTrackState}`}
            </span>
          </div>

          {/* DETECTION CYCLES */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#94a3b8' }}>DETECTION CYCLES:</span>
            <span style={{ fontWeight: 700, color: '#e2e8f0' }}>
              {statusPanel.detectionCycles}
            </span>
          </div>

          {/* RAW OBJECTS */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 6, marginTop: 4 }}>
            <span style={{ color: '#cbd5e1', fontWeight: 700, display: 'block', marginBottom: 4 }}>RAW OBJECTS:</span>
            {(statusPanel.rawPredictions || []).length > 0 ? (
              (statusPanel.rawPredictions || []).map((p, i) => (
                <div key={i} style={{ fontSize: '0.74rem', color: p.class === 'cell phone' ? '#fca5a5' : '#e2e8f0', display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
                  <span style={{ fontWeight: p.class === 'cell phone' ? 800 : 400 }}>• {p.class}:</span>
                  <span style={{ fontWeight: 700 }}>{(p.rawScore || (p.score / 100)).toFixed(2)} ({p.score}%)</span>
                </div>
              ))
            ) : (
              <span style={{ fontSize: '0.74rem', color: '#94a3b8', fontStyle: 'italic' }}>No objects detected in frame</span>
            )}
          </div>

          {/* PHONE DETECTION COUNT */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 6, marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#94a3b8' }}>PHONE DETECTION COUNT:</span>
            <span style={{ fontWeight: 700, color: statusPanel.phoneDetectionCount.startsWith('3') ? '#ef4444' : '#e2e8f0' }}>
              {statusPanel.phoneDetectionCount}
            </span>
          </div>

          {/* PHONE STATUS */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
            <span style={{ color: '#94a3b8', fontWeight: 700 }}>PHONE STATUS:</span>
            <span style={{
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: '0.72rem',
              background: statusPanel.phoneStatus === 'DETECTED' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.2)',
              color: statusPanel.phoneStatus === 'DETECTED' ? '#ef4444' : '#10b981',
              border: `1px solid ${statusPanel.phoneStatus === 'DETECTED' ? '#ef4444' : '#10b981'}`
            }}>
              {statusPanel.phoneStatus === 'DETECTED' ? '🔴 DETECTED' : '🟢 CLEAR'}
            </span>
          </div>
        </div>
      </div>

      {/* Validated Warning Modal */}
      {activeWarning && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 480,
              background: '#0f172a',
              border: '2px solid rgba(239, 68, 68, 0.9)',
              borderRadius: 16,
              boxShadow: '0 20px 60px rgba(239, 68, 68, 0.45)',
              padding: '28px 32px',
              color: '#fff',
              fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              textAlign: 'center',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginBottom: 18 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.18)',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShieldAlert size={36} color="#ef4444" />
              </div>

              <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#fca5a5' }}>
                🚨 MOBILE DEVICE DETECTED
              </h3>
            </div>

            <p style={{ fontSize: '0.98rem', lineHeight: 1.55, color: '#f1f5f9', margin: '0 0 18px' }}>
              A mobile phone has been detected in the camera view.
            </p>

            <p style={{ fontSize: '0.9rem', color: '#94a3b8', margin: '0 0 20px' }}>
              Please remove the device from the interview area.
            </p>

            <button
              onClick={handleAcknowledgeWarning}
              style={{
                width: '100%',
                padding: '14px 20px',
                borderRadius: 10,
                border: 'none',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '1rem',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(239, 68, 68, 0.4)',
                transition: 'transform 0.15s ease',
              }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              [ I Understand ]
            </button>
          </div>
        </div>
      )}
    </>
  );
}
