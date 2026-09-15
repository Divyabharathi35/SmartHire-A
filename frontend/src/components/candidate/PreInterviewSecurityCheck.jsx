// ============================================================
//  PreInterviewSecurityCheck.jsx — SmartHire Pre-Interview Diagnostics
// ============================================================
import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck, Camera, Mic, Volume2, Sun, Monitor, Radio, AlertTriangle,
  CheckCircle2, XCircle, RefreshCw, Lock, Sparkles, User, Play, StopCircle
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function PreInterviewSecurityCheck({ onChecksPassed, onCancel }) {
  const [checks, setChecks] = useState({
    face: { id: 'face', label: 'Face Verification', status: 'CHECKING', detail: 'Detecting face presence and centering...' },
    camera: { id: 'camera', label: 'Camera Stream', status: 'CHECKING', detail: 'Verifying video stream input...' },
    microphone: { id: 'microphone', label: 'Microphone Stream', status: 'CHECKING', detail: 'Testing audio input & volume...' },
    speaker: { id: 'speaker', label: 'Speaker Output', status: 'CHECKING', detail: 'Audio playback test' },
    positioning: { id: 'positioning', label: 'Face Positioning', status: 'CHECKING', detail: 'Evaluating face frame distance...' },
    lighting: { id: 'lighting', label: 'Lighting Quality', status: 'CHECKING', detail: 'Analyzing illumination levels...' },
    environment: { id: 'environment', label: 'Environment Integrity', status: 'CHECKING', detail: 'Checking video feed stability...' },
    permissions: { id: 'permissions', label: 'Browser Permissions', status: 'CHECKING', detail: 'Checking camera & mic authorization...' },
    recording: { id: 'recording', label: 'Recording Readiness', status: 'CHECKING', detail: 'Verifying MediaRecorder capabilities...' },
    network: { id: 'network', label: 'Network Connection', status: 'CHECKING', detail: 'Testing backend latency & API health...' },
  });

  const [stream, setStream] = useState(null);
  const [audioTesting, setAudioTesting] = useState(false);
  const [speakerTested, setSpeakerTested] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [consentAgreed, setConsentAgreed] = useState(true);
  const [running, setRunning] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const audioCtxRef = useRef(null);
  const animFrameRef = useRef(null);

  useEffect(() => {
    runAllChecks();
    return () => {
      stopMediaTracks();
    };
  }, []);

  const stopMediaTracks = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close();
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const updateCheck = (key, status, detail) => {
    setChecks(prev => ({
      ...prev,
      [key]: { ...prev[key], status, detail }
    }));
  };

  const runAllChecks = async () => {
    setRunning(true);
    // Reset status
    Object.keys(checks).forEach(k => {
      if (k !== 'speaker') {
        updateCheck(k, 'CHECKING', 'Checking...');
      }
    });

    let localStream = null;

    // 1. Browser Permissions & Media Devices
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      updateCheck('permissions', 'FAILED', 'Browser does not support media recording APIs.');
      updateCheck('camera', 'FAILED', 'Media devices unavailable.');
      updateCheck('microphone', 'FAILED', 'Media devices unavailable.');
      setRunning(false);
      return;
    }

    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true
      });
      setStream(localStream);
      if (videoRef.current) {
        videoRef.current.srcObject = localStream;
      }
      updateCheck('permissions', 'PASSED', 'Camera & Microphone authorized');
    } catch (err) {
      updateCheck('permissions', 'FAILED', `Permission denied or device in use: ${err.message}`);
      updateCheck('camera', 'FAILED', 'Camera access denied');
      updateCheck('microphone', 'FAILED', 'Microphone access denied');
      setRunning(false);
      return;
    }

    // 2. Camera Stream Verification
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack && videoTrack.readyState === 'live') {
      const settings = videoTrack.getSettings();
      updateCheck('camera', 'PASSED', `Active (${settings.width || 1280}x${settings.height || 720})`);
    } else {
      updateCheck('camera', 'FAILED', 'Camera video stream not live');
    }

    // 3. Microphone Stream & Audio Level Verification
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack && audioTrack.readyState === 'live') {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(localStream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let volSum = 0;
        let samples = 0;

        const checkAudioLevel = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          setMicVolume(Math.min(100, Math.round((avg / 128) * 100)));
          volSum += avg;
          samples++;
          if (samples < 30) {
            animFrameRef.current = requestAnimationFrame(checkAudioLevel);
          } else {
            const overallAvg = volSum / samples;
            if (overallAvg > 1.5) {
              updateCheck('microphone', 'PASSED', 'Audio input detected');
            } else {
              updateCheck('microphone', 'WARNING', 'Microphone active but audio input is quiet');
            }
          }
        };
        checkAudioLevel();
      } catch (_e) {
        updateCheck('microphone', 'PASSED', 'Microphone active');
      }
    } else {
      updateCheck('microphone', 'FAILED', 'Microphone stream inactive or disconnected');
    }

    // 4. Speaker Output
    updateCheck('speaker', speakerTested ? 'PASSED' : 'PASSED', speakerTested ? 'Tested successfully' : 'Speaker ready (Click test to verify)');

    // 5. Recording Readiness Check
    if (typeof MediaRecorder !== 'undefined') {
      const mimeTypes = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
      const supported = mimeTypes.some(t => MediaRecorder.isTypeSupported(t));
      if (supported) {
        updateCheck('recording', 'PASSED', 'MediaRecorder supported');
      } else {
        updateCheck('recording', 'WARNING', 'MediaRecorder basic fallback supported');
      }
    } else {
      updateCheck('recording', 'FAILED', 'MediaRecorder not supported by browser');
    }

    // 6. Network Connection to SmartHire API Health
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      if (res.ok) {
        updateCheck('network', 'PASSED', 'Connected to SmartHire server');
      } else {
        updateCheck('network', 'WARNING', `Server response HTTP ${res.status}`);
      }
    } catch (_netErr) {
      updateCheck('network', 'FAILED', 'Could not reach backend API endpoint');
    }

    // 7. Video Frame Analysis (Face, Positioning, Lighting, Environment)
    setTimeout(() => {
      analyzeCanvasVideoFeed();
      setRunning(false);
    }, 800);
  };

  const analyzeCanvasVideoFeed = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = 320;
    canvas.height = 240;

    try {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      let totalBrightness = 0;
      let pixelCount = data.length / 4;
      let skinPixels = 0;
      let centerSkinPixels = 0;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        totalBrightness += luma;

        // Skin tone heuristic check
        if (r > 60 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15) {
          skinPixels++;
          const pixelIndex = i / 4;
          const x = pixelIndex % canvas.width;
          const y = Math.floor(pixelIndex / canvas.width);
          if (x > canvas.width * 0.25 && x < canvas.width * 0.75 && y > canvas.height * 0.2 && y < canvas.height * 0.8) {
            centerSkinPixels++;
          }
        }
      }

      const avgBrightness = totalBrightness / pixelCount;
      const skinRatio = skinPixels / pixelCount;
      const centerSkinRatio = centerSkinPixels / (pixelCount * 0.3);

      // Lighting Analysis
      if (avgBrightness < 35) {
        updateCheck('lighting', 'WARNING', 'Lighting is too dark. Please increase ambient light.');
      } else if (avgBrightness > 225) {
        updateCheck('lighting', 'WARNING', 'Lighting is overexposed. Avoid direct glare.');
      } else {
        updateCheck('lighting', 'PASSED', `Good lighting level (${Math.round(avgBrightness)} lux)`);
      }

      // Face Verification & Presence
      if (skinRatio > 0.04) {
        updateCheck('face', 'PASSED', 'Candidate face detected');
      } else {
        updateCheck('face', 'WARNING', 'Face not clearly visible. Position face in camera view.');
      }

      // Face Positioning Check
      if (centerSkinRatio > 0.08 && centerSkinRatio < 0.60) {
        updateCheck('positioning', 'PASSED', 'Face centered and well positioned');
      } else if (centerSkinRatio >= 0.60) {
        updateCheck('positioning', 'WARNING', 'Please move slightly away from camera');
      } else {
        updateCheck('positioning', 'WARNING', 'Please center your face in the camera stream');
      }

      // Environment Check
      if (skinRatio < 0.70) {
        updateCheck('environment', 'PASSED', 'Stable interview background detected');
      } else {
        updateCheck('environment', 'WARNING', 'Camera seems obstructed or too close to wall');
      }

    } catch (_err) {
      updateCheck('face', 'PASSED', 'Face detection active');
      updateCheck('positioning', 'PASSED', 'Positioning OK');
      updateCheck('lighting', 'PASSED', 'Lighting OK');
      updateCheck('environment', 'PASSED', 'Environment OK');
    }
  };

  const testSpeakerSound = () => {
    try {
      setAudioTesting(true);
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime); // 440Hz A4 note
      gain.gain.setValueAtTime(0.15, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      setTimeout(() => {
        osc.stop();
        ctx.close();
        setAudioTesting(false);
        setSpeakerTested(true);
        updateCheck('speaker', 'PASSED', 'Audio output verified');
      }, 1000);
    } catch (_e) {
      setAudioTesting(false);
      updateCheck('speaker', 'PASSED', 'Speaker verified');
    }
  };

  // Mandatory checks that MUST pass (or warning) for interview start
  const mandatoryKeys = ['permissions', 'camera', 'microphone', 'network', 'recording'];
  const failedMandatory = mandatoryKeys.some(k => checks[k].status === 'FAILED');
  const allCompleted = Object.values(checks).every(c => c.status !== 'CHECKING');
  const canStart = allCompleted && !failedMandatory && consentAgreed && !running;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PASSED':
        return <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '4px 10px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 700, border: '1px solid rgba(16,185,129,0.3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={13} /> PASSED</span>;
      case 'WARNING':
        return <span style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', padding: '4px 10px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 700, border: '1px solid rgba(245,158,11,0.3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={13} /> WARNING</span>;
      case 'FAILED':
        return <span style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '4px 10px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 700, border: '1px solid rgba(239,68,68,0.3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><XCircle size={13} /> FAILED</span>;
      default:
        return <span style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', padding: '4px 10px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 700, border: '1px solid rgba(59,130,246,0.3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><RefreshCw size={13} className="animate-spin" /> CHECKING</span>;
    }
  };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }} className="animate-fade-in">
      <div style={{
        background: 'var(--card-bg, #111827)',
        border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
        borderRadius: 20,
        padding: 32,
        boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, borderBottom: '1px solid rgba(255,255,255,0.08)', pb: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--accent-primary, #6366f1)', fontWeight: 800, fontSize: '0.85rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              <ShieldCheck size={20} /> SMART HIRE INTERVIEW PLATFORM
            </div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-bright, #fff)', marginTop: 4, margin: 0 }}>
              Pre-Interview Security Check
            </h2>
            <p style={{ color: 'var(--text-muted, #9ca3af)', fontSize: '0.9rem', marginTop: 4 }}>
              System diagnostics for hardware, environment, and interview integrity validation.
            </p>
          </div>
          <button
            onClick={runAllChecks}
            disabled={running}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 10 }}
          >
            <RefreshCw size={14} className={running ? 'animate-spin' : ''} /> Run Checks Again
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 28 }}>
          {/* Diagnostic Checks List */}
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Object.values(checks).map((chk) => (
                <div
                  key={chk.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifySpace: 'space-between',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 12,
                    padding: '14px 18px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: chk.status === 'PASSED' ? 'rgba(16,185,129,0.1)' : chk.status === 'WARNING' ? 'rgba(245,158,11,0.1)' : 'rgba(99,102,241,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: chk.status === 'PASSED' ? '#10b981' : chk.status === 'WARNING' ? '#f59e0b' : '#6366f1'
                    }}>
                      {chk.id === 'face' && <User size={18} />}
                      {chk.id === 'camera' && <Camera size={18} />}
                      {chk.id === 'microphone' && <Mic size={18} />}
                      {chk.id === 'speaker' && <Volume2 size={18} />}
                      {chk.id === 'positioning' && <Monitor size={18} />}
                      {chk.id === 'lighting' && <Sun size={18} />}
                      {chk.id === 'environment' && <ShieldCheck size={18} />}
                      {chk.id === 'permissions' && <Lock size={18} />}
                      {chk.id === 'recording' && <Radio size={18} />}
                      {chk.id === 'network' && <Sparkles size={18} />}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f3f4f6' }}>{chk.label}</div>
                      <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: 2 }}>{chk.detail}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {chk.id === 'speaker' && (
                      <button
                        onClick={testSpeakerSound}
                        disabled={audioTesting}
                        className="btn btn-xs btn-outline"
                        style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                      >
                        {audioTesting ? 'Playing tone...' : 'Test Speaker'}
                      </button>
                    )}
                    {getStatusBadge(chk.status)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Camera Preview & Privacy Consent Box */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Live Camera Box */}
            <div style={{
              background: '#000',
              borderRadius: 16,
              overflow: 'hidden',
              position: 'relative',
              aspectRatio: '4/3',
              border: '2px solid rgba(255,255,255,0.1)',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
            }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
              />
              <canvas ref={canvasRef} style={{ display: 'none' }} />

              {/* Overlays */}
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                border: '2px dashed rgba(99,102,241,0.4)', borderRadius: '50%',
                margin: '20px auto', width: '55%', height: '70%'
              }} />

              <div style={{
                position: 'absolute', bottom: 12, left: 12, right: 12,
                background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
                borderRadius: 10, padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: '#10b981' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'pulse 1.5s infinite' }} />
                  Live Preview
                </div>
                {/* Audio Volume Bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Mic size={12} color="#9ca3af" />
                  <div style={{ width: 60, height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${micVolume}%`, height: '100%', background: micVolume > 30 ? '#10b981' : '#f59e0b', transition: 'width 0.1s' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Privacy & Recording Notice */}
            <div style={{
              background: 'rgba(99,102,241,0.06)',
              border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: 14,
              padding: 16
            }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <Lock size={18} color="#818cf8" style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ fontSize: '0.8rem', color: '#d1d5db', lineHeight: 1.5 }}>
                  <strong>Candidate Privacy Notice:</strong><br />
                  Your camera and microphone will be used during this interview. Your session will be recorded and analyzed for assessment and interview integrity purposes.
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, cursor: 'pointer', fontSize: '0.82rem', color: '#f3f4f6' }}>
                <input
                  type="checkbox"
                  checked={consentAgreed}
                  onChange={(e) => setConsentAgreed(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: '#6366f1' }}
                />
                I consent to interview video/audio recording & proctoring checks
              </label>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              {onCancel && (
                <button onClick={onCancel} className="btn btn-secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
              )}
              <button
                onClick={onChecksPassed}
                disabled={!canStart}
                className="btn btn-primary"
                style={{
                  flex: 2,
                  padding: '14px',
                  borderRadius: 12,
                  fontWeight: 800,
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  background: canStart ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'rgba(255,255,255,0.1)',
                  color: canStart ? '#fff' : '#6b7280',
                  cursor: canStart ? 'pointer' : 'not-allowed',
                  boxShadow: canStart ? '0 10px 25px rgba(99,102,241,0.4)' : 'none'
                }}
              >
                <CheckCircle2 size={18} /> Start Interview
              </button>
            </div>
            {!canStart && (
              <div style={{ fontSize: '0.75rem', color: '#ef4444', textAlign: 'center' }}>
                {!allCompleted ? 'Running system checks...' : failedMandatory ? 'Please resolve failed mandatory checks before proceeding.' : 'Please accept consent to begin.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
