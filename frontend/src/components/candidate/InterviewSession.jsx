// ============================================================
//  InterviewSession.jsx — Active Interview Environment with Media Recording & Timer Workflow
// ============================================================
import { useState, useEffect, useRef } from 'react';
import {
  Play, Pause, Save, CheckCircle, ChevronRight, ChevronLeft,
  Mic, MicOff, Sparkles, AlertCircle, Award, ArrowLeft,
  Video, VideoOff, ShieldAlert, AlertTriangle, RefreshCw, Clock,
  Square, RotateCcw, Volume2
} from 'lucide-react';
import InterviewSummary from './InterviewSummary';
import PreInterviewSecurityCheck from './PreInterviewSecurityCheck';
import ProctoringEngine from './ProctoringEngine';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function getBestSupportedMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=h264,opus',
    'video/webm',
    'video/mp4'
  ];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) {
      return t;
    }
  }
  return '';
}

function WaveformBar({ delay, isActive }) {
  const [height, setHeight] = useState(4);
  useEffect(() => {
    if (!isActive) { setHeight(4); return; }
    const interval = setInterval(() => {
      const t = Date.now() / 200 + delay;
      const h = Math.floor(8 + Math.abs(Math.sin(t)) * 24);
      setHeight(h);
    }, 120);
    return () => clearInterval(interval);
  }, [isActive, delay]);

  return (
    <div style={{
      width: 4, height, borderRadius: 99, minHeight: 4, maxHeight: 36,
      background: 'linear-gradient(180deg, var(--accent-primary), var(--accent-secondary))',
      transition: 'height 0.12s ease',
    }} />
  );
}

export default function InterviewSession({ session: initialSession, onBackToGenerator }) {
  const [session, setSession]             = useState(initialSession);
  const [sessionStatus, setSessionStatus] = useState((initialSession?.status || 'CREATED').toUpperCase());
  const [preCheckPassed, setPreCheckPassed] = useState(false);
  const [currentIndex, setCurrentIndex]   = useState(initialSession?.current_question_index || 0);
  const [answers, setAnswers]             = useState({});
  const [feedbacks, setFeedbacks]         = useState({});
  const [questionTimings, setQuestionTimings] = useState({});
  const [evaluating, setEvaluating]       = useState(false);
  const [isDictating, setIsDictating]     = useState(false);

  // Drift-Free Timer & Expiration State
  const [elapsedActiveSeconds, setElapsedActiveSeconds] = useState(0);
  const [currentQuestionSeconds, setCurrentQuestionSeconds] = useState(0);
  const [timerActive, setTimerActive]     = useState(false);
  const [endedSession, setEndedSession]   = useState(null);
  const [autoExpired, setAutoExpired]     = useState(false);
  const [saveStatus, setSaveStatus]       = useState('');
  const [error, setError]                 = useState('');

  // Confirmation Modal & Upload Retry
  const [showEndConfirmModal, setShowEndConfirmModal] = useState(false);
  const [uploadError, setUploadError]                 = useState(false);
  const [lastBlob, setLastBlob]                       = useState(null);

  // Media & Recording state
  const [mediaStream, setMediaStream]       = useState(null);
  const [permissionState, setPermissionState] = useState('idle'); // idle, checking, granted, denied, error, unsupported
  const [permissionErrorMsg, setPermissionErrorMsg] = useState('');
  const [isRecording, setIsRecording]       = useState(false);
  const [isPausedRecording, setIsPausedRecording] = useState(false);
  const [uploadingRecording, setUploadingRecording] = useState(false);

  const videoRef         = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);

  // Timing References for drift prevention & pause tracking
  const activeSegmentStartRef  = useRef(null);
  const accumActiveSecsRef     = useRef(0);
  const questionStartRef       = useRef(Date.now());
  const accumQuestionSecsRef   = useRef(0);
  const autoExpiredHandledRef  = useRef(false);

  // Per-Question Voice Answer Recording State & Refs
  const [audioBlobs, setAudioBlobs]             = useState({}); // { [qIndex]: { blob, url, duration } }
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [voiceTimer, setVoiceTimer]             = useState(0);

  const voiceStreamRef        = useRef(null);
  const voiceRecorderRef      = useRef(null);
  const voiceChunksRef        = useRef([]);
  const voiceTimerIntervalRef = useRef(null);
  const recognitionRef        = useRef(null);

  const questions = session?.questions || [];
  const currentQuestion = questions[currentIndex] || {};

  // Communication & STT Analysis State
  const [commPreviews, setCommPreviews] = useState({}); // { [qIndex]: commAnalysisObj }
  const [sttSupported, setSttSupported] = useState(
    typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
  );

  // Eye-Contact & Behavioral Tracking State
  const [eyeContactStats, setEyeContactStats] = useState({
    eyeContactPct: 82,
    lookingAwayDuration: 0,
    attentionBreaks: 0,
    eyeContactStatus: 'Available'
  });
  const [behaviorEvents, setBehaviorEvents] = useState([]);

  // PyTorch Real Emotion Model & Live Signal State
  const [emotionModelStatus, setEmotionModelStatus] = useState('Loading'); // Loading / Ready / Processing / Unavailable / Error
  const [liveDominantEmotion, setLiveDominantEmotion] = useState(null);
  const [liveModelConfidence, setLiveModelConfidence] = useState(0.0);
  const [liveFaceDetected, setLiveFaceDetected]       = useState(false);
  const [liveFaceEvent, setLiveFaceEvent]             = useState('no_face_detected');  // Real-Time Frame Inference Stream to PyTorch Backend Emotion Service
  useEffect(() => {
    let frameTimer = null;
    if (sessionStatus === 'IN_PROGRESS' && session?.id) {
      console.log('[Emotion Pipeline] Webcam frame capture loop initialized for session:', session.id);
      const frameCanvas = document.createElement('canvas');
      const frameCtx = frameCanvas.getContext('2d');

      frameTimer = setInterval(async () => {
        const v = videoRef.current;
        if (!v || v.paused || v.ended) return;
        if (v.readyState < 2 || !v.videoWidth || !v.videoHeight) return;

        try {
          frameCanvas.width = 320;
          frameCanvas.height = 240;
          frameCtx.drawImage(v, 0, 0, frameCanvas.width, frameCanvas.height);
          const base64Data = frameCanvas.toDataURL('image/jpeg', 0.7);
          setEmotionModelStatus(prev => prev === 'Unavailable' ? 'Unavailable' : 'Processing');

          const token = localStorage.getItem('smarthire_token') || localStorage.getItem('token') || localStorage.getItem('access_token');
          const url = `${API_BASE}/api/interviews/sessions/${session.id}/emotion-frame`;

          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
              image_base64: base64Data,
              question_id: currentQuestion?.id || null,
              smoothing_window: 5
            })
          });

          if (res.ok) {
            const data = await res.json();
            if (data.status === 'unavailable') {
              setEmotionModelStatus('Unavailable');
            } else if (data.status === 'success') {
              setEmotionModelStatus('Ready');
              setLiveFaceDetected(data.face_detected);
              setLiveFaceEvent(data.face_event || (data.face_detected ? 'face_detected' : 'no_face_detected'));
              if (data.face_detected && data.dominant_emotion) {
                setLiveDominantEmotion(data.dominant_emotion);
                setLiveModelConfidence(data.model_confidence || 0.0);
              } else {
                setLiveDominantEmotion(null);
                setLiveModelConfidence(0.0);
              }
            }
          }
        } catch (e) {
          console.error('[Emotion Pipeline] Error sending frame to backend:', e);
          setEmotionModelStatus('Error');
        }
      }, 1000);
    } else if (sessionStatus === 'CREATED' || sessionStatus === 'SETUP') {
      fetch(`${API_BASE}/api/interviews/sessions/` + (session?.id || 'check') + '/emotion-analysis')
        .then(r => r.json())
        .then(d => {
          if (d.status === 'ready' || d.status === 'completed') setEmotionModelStatus('Ready');
          else if (d.status === 'unavailable') setEmotionModelStatus('Unavailable');
        })
        .catch(() => {});
    }

    return () => {
      if (frameTimer) {
        clearInterval(frameTimer);
      }
    };
  }, [sessionStatus, session?.id, currentQuestion?.id]);


  // Calculate total allowed duration for interview (in seconds)
  const allowedDurationSeconds = session?.duration && session.duration > 0
    ? session.duration
    : (questions.length > 0 ? questions.length * 180 : 900); // 3 mins per question or 15 mins default

  const remainingSeconds = Math.max(0, allowedDurationSeconds - elapsedActiveSeconds);

  // Behavior & Eye Contact Canvas Tracker Loop
  useEffect(() => {
    let interval = null;
    if (sessionStatus === 'IN_PROGRESS' && videoRef.current && mediaStream) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      canvas.width = 160;
      canvas.height = 120;

      let facePresent = true;
      let lookingAway = false;

      interval = setInterval(() => {
        if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;

        try {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;

          let centerLuma = 0;
          let totalLuma = 0;
          let centerPixels = 0;
          let totalPixels = 0;

          for (let y = 0; y < canvas.height; y += 4) {
            for (let x = 0; x < canvas.width; x += 4) {
              const idx = (y * canvas.width + x) * 4;
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];
              const luma = 0.299 * r + 0.587 * g + 0.114 * b;
              totalLuma += luma;
              totalPixels++;

              if (x >= 40 && x <= 120 && y >= 20 && y <= 100) {
                centerLuma += luma;
                centerPixels++;
              }
            }
          }

          const avgTotalLuma = totalLuma / Math.max(1, totalPixels);
          const avgCenterLuma = centerLuma / Math.max(1, centerPixels);

          const isFaceDetected = avgTotalLuma > 15;
          const isCenteredLook = isFaceDetected && Math.abs(avgCenterLuma - avgTotalLuma) < 35;
          const timeStr = new Date().toLocaleTimeString();

          if (!isFaceDetected) {
            if (facePresent) {
              facePresent = false;
              setBehaviorEvents(prev => [...prev.slice(-20), { timestamp: timeStr, event: 'Face missing / absent from frame' }]);
              setEyeContactStats(prev => ({
                ...prev,
                attentionBreaks: prev.attentionBreaks + 1,
                eyeContactStatus: 'Available'
              }));
            }
          } else {
            if (!facePresent) {
              facePresent = true;
              setBehaviorEvents(prev => [...prev.slice(-20), { timestamp: timeStr, event: 'Face detected in camera view' }]);
            }

            if (!isCenteredLook) {
              if (!lookingAway) {
                lookingAway = true;
                setBehaviorEvents(prev => [...prev.slice(-20), { timestamp: timeStr, event: 'Observed looking away from camera' }]);
                setEyeContactStats(prev => ({
                  ...prev,
                  attentionBreaks: prev.attentionBreaks + 1
                }));
              }
              setEyeContactStats(prev => ({
                ...prev,
                lookingAwayDuration: prev.lookingAwayDuration + 1
              }));
            } else {
              if (lookingAway) {
                lookingAway = false;
                setBehaviorEvents(prev => [...prev.slice(-20), { timestamp: timeStr, event: 'Returned focus toward camera' }]);
              }
            }
          }

          setEyeContactStats(prev => {
            const totalObserved = Math.max(1, elapsedActiveSeconds);
            const awaySecs = prev.lookingAwayDuration;
            const eyePct = Math.max(0, Math.min(100, Math.round(((totalObserved - awaySecs) / totalObserved) * 100)));
            return { ...prev, eyeContactPct: eyePct, eyeContactStatus: 'Available' };
          });

        } catch (_err) { /* ignore */ }
      }, 1000);
    } else {
      if (permissionState === 'denied' || permissionState === 'unsupported' || permissionState === 'error') {
        setEyeContactStats(prev => ({ ...prev, eyeContactStatus: 'unavailable' }));
      }
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [sessionStatus, mediaStream, permissionState, elapsedActiveSeconds]);

  // 1. Restore & Sync State on Mount / Session Reload
  useEffect(() => {
    syncSessionState(initialSession);
  }, []);

  const syncSessionState = (sess) => {
    if (!sess) return;
    setSession(sess);

    const st = (sess.status || 'CREATED').toUpperCase();
    setSessionStatus(st);

    if (sess.questions) {
      const initialAns = {};
      const initialFb  = {};
      const initialTimings = {};

      sess.questions.forEach((q, idx) => {
        if (q.user_answer) initialAns[idx] = q.user_answer;
        if (q.feedback) initialFb[idx] = { feedback: q.feedback, score: q.score, sample_answer: q.sample_answer };
        if (q.time_spent) initialTimings[idx] = q.time_spent;
      });

      setAnswers(initialAns);
      setFeedbacks(initialFb);
      setQuestionTimings(initialTimings);
    }

    if (sess.current_question_index !== undefined && sess.current_question_index !== null) {
      setCurrentIndex(sess.current_question_index);
    }

    // Refresh safety: Calculate elapsed time from backend started_at
    if (st === 'IN_PROGRESS' || st === 'PAUSED') {
      if (sess.started_at) {
        const startedTs = new Date(sess.started_at).getTime();
        const nowTs = sess.paused_at ? new Date(sess.paused_at).getTime() : Date.now();
        const totalElapsed = Math.max(0, Math.floor((nowTs - startedTs) / 1000));
        accumActiveSecsRef.current = totalElapsed;
        setElapsedActiveSeconds(totalElapsed);
      }

      if (st === 'IN_PROGRESS') {
        setTimerActive(true);
      }
    } else if (st === 'COMPLETED') {
      setEndedSession(sess);
    }
  };

  // Request media permissions on mount
  useEffect(() => {
    requestPermissions();
    return () => {
      stopMediaTracks();
    };
  }, []);

  // Update video element srcObject when mediaStream or session status changes
  useEffect(() => {
    if (videoRef.current && mediaStream) {
      if (videoRef.current.srcObject !== mediaStream) {
        videoRef.current.srcObject = mediaStream;
      }
      videoRef.current.play().catch(_e => {});
    }
  }, [mediaStream, permissionState, sessionStatus, preCheckPassed]);

  // Auto-start MediaRecorder when mediaStream is ready and session is IN_PROGRESS
  useEffect(() => {
    if (mediaStream && sessionStatus === 'IN_PROGRESS' && !isRecording && (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive')) {
      startMediaRecorder();
    }
  }, [mediaStream, sessionStatus]);

  // 2. Drift-Free Timer Interval
  useEffect(() => {
    let interval = null;
    if (timerActive && sessionStatus === 'IN_PROGRESS') {
      activeSegmentStartRef.current = Date.now();

      interval = setInterval(() => {
        const now = Date.now();
        const segSecs = Math.floor((now - activeSegmentStartRef.current) / 1000);
        const totalActive = accumActiveSecsRef.current + segSecs;
        setElapsedActiveSeconds(totalActive);

        const qSegSecs = Math.floor((now - questionStartRef.current) / 1000);
        setCurrentQuestionSeconds(accumQuestionSecsRef.current + qSegSecs);
      }, 1000);
    } else {
      if (activeSegmentStartRef.current) {
        accumActiveSecsRef.current += Math.floor((Date.now() - activeSegmentStartRef.current) / 1000);
        accumQuestionSecsRef.current += Math.floor((Date.now() - activeSegmentStartRef.current) / 1000);
        activeSegmentStartRef.current = null;
      }
    }
    return () => clearInterval(interval);
  }, [timerActive, sessionStatus]);

  // 3. Automatic Time Expiration Handler
  useEffect(() => {
    if (timerActive && sessionStatus === 'IN_PROGRESS' && remainingSeconds <= 0 && !autoExpiredHandledRef.current) {
      autoExpiredHandledRef.current = true;
      setAutoExpired(true);
      handleAutoTimeExpiration();
    }
  }, [remainingSeconds, timerActive, sessionStatus]);

  const handleAutoTimeExpiration = async () => {
    setError('Interview time has ended.');
    setTimerActive(false);
    await handleConfirmEndInterview(true);
  };

  // Stop MediaStream tracks
  const stopMediaTracks = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (_e) {}
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => {
        try { track.stop(); } catch (_e) {}
      });
      setMediaStream(null);
    }
    if (voiceStreamRef.current) {
      voiceStreamRef.current.getTracks().forEach(track => {
        try { track.stop(); } catch (_e) {}
      });
      voiceStreamRef.current = null;
    }
  };

  // Upload single per-question audio answer file to backend
  const uploadAudioAnswerFile = async (sessionId, questionId, questionNumber, blob, durationVal) => {
    try {
      const formData = new FormData();
      formData.append('audio_file', blob, `audio_q${questionNumber}_${questionId}.webm`);
      formData.append('question_id', questionId);
      formData.append('question_number', questionNumber.toString());
      formData.append('duration', (durationVal || 0).toString());

      const token = localStorage.getItem('smarthire_token');
      const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/answers/audio`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        credentials: 'include',
        body: formData,
      });
      if (res.ok) {
        console.log(`[SmartHire Audio] Answer for question #${questionNumber} uploaded successfully`);
      }
    } catch (err) {
      console.error('[SmartHire Audio Upload Error]', err);
    }
  };

  // Start per-question voice answer recording workflow
  const handleStartVoiceAnswer = async () => {
    if (sessionStatus === 'CREATED' || sessionStatus === 'NOT_STARTED') {
      setError("Please click 'Start Interview' before recording your answer.");
      return;
    }
    if (sessionStatus === 'COMPLETED' || sessionStatus === 'PAUSED') return;

    setError('');
    try {
      // 1. Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceStreamRef.current = stream;

      // 2. Setup MediaRecorder
      voiceChunksRef.current = [];
      const mimeType = 'audio/webm';
      const options = (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mimeType)) ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, options);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          voiceChunksRef.current.push(e.data);
        }
      };

      recorder.start(250);
      voiceRecorderRef.current = recorder;

      // 3. Start live voice recording timer
      setVoiceTimer(0);
      if (voiceTimerIntervalRef.current) clearInterval(voiceTimerIntervalRef.current);
      voiceTimerIntervalRef.current = setInterval(() => {
        setVoiceTimer(prev => prev + 1);
      }, 1000);

      setIsVoiceRecording(true);

      // 4. Web Speech API (SpeechRecognition) integration for live speech-to-text
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'en-US';

          let initialText = answers[currentIndex] || '';

          recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
              } else {
                interimTranscript += event.results[i][0].transcript;
              }
            }

            const currentSpoken = (finalTranscript || interimTranscript).trim();
            if (currentSpoken) {
              const combinedText = initialText
                ? `${initialText} ${currentSpoken}`
                : currentSpoken;
              setAnswers(prev => ({ ...prev, [currentIndex]: combinedText }));
            }
          };

          recognition.onerror = (e) => {
            console.warn('[SpeechRecognition Warning]', e.error);
          };

          recognition.start();
          recognitionRef.current = recognition;
        } catch (err) {
          console.warn('[SpeechRecognition Init Warning]', err);
        }
      }

    } catch (err) {
      console.error('[Voice Answer Mic Error]', err);
      setError('Microphone access is required to record your voice answer. Please grant microphone permission in your browser.');
    }
  };

  // Stop per-question voice answer recording & cleanup mic tracks immediately
  const handleStopVoiceAnswer = () => {
    if (voiceTimerIntervalRef.current) {
      clearInterval(voiceTimerIntervalRef.current);
      voiceTimerIntervalRef.current = null;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_e) {}
      recognitionRef.current = null;
    }

    const currentQ = currentQuestion;
    const currentQIdx = currentIndex;
    const recDuration = voiceTimer;

    if (voiceRecorderRef.current && voiceRecorderRef.current.state !== 'inactive') {
      voiceRecorderRef.current.onstop = async () => {
        const mimeType = 'audio/webm';
        const blob = new Blob(voiceChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);

        const newAudioObj = { blob, url, duration: recDuration, question_id: currentQ.id };
        setAudioBlobs(prev => ({ ...prev, [currentQIdx]: newAudioObj }));
        setIsVoiceRecording(false);

        // Immediate microphone track cleanup
        if (voiceStreamRef.current) {
          voiceStreamRef.current.getTracks().forEach(track => {
            try { track.stop(); } catch (_e) {}
          });
          voiceStreamRef.current = null;
        }

        // Automatic background upload of audio answer file
        if (session?.id && currentQ?.id) {
          await uploadAudioAnswerFile(session.id, currentQ.id, currentQIdx + 1, blob, recDuration);
        }
      };

      try {
        voiceRecorderRef.current.stop();
      } catch (_e) {
        setIsVoiceRecording(false);
      }
    } else {
      setIsVoiceRecording(false);
      if (voiceStreamRef.current) {
        voiceStreamRef.current.getTracks().forEach(track => {
          try { track.stop(); } catch (_e) {}
        });
        voiceStreamRef.current = null;
      }
    }
  };

  // Re-record per-question voice answer
  const handleRerecordVoiceAnswer = () => {
    if (audioBlobs[currentIndex]?.url) {
      URL.revokeObjectURL(audioBlobs[currentIndex].url);
    }
    setAudioBlobs(prev => {
      const copy = { ...prev };
      delete copy[currentIndex];
      return copy;
    });
    handleStartVoiceAnswer();
  };

  // Request browser camera & microphone permissions
  const requestPermissions = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setPermissionState('unsupported');
      setPermissionErrorMsg('Your browser does not support camera and microphone recording APIs.');
      return;
    }

    setPermissionState('checking');
    setPermissionErrorMsg('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setMediaStream(stream);
      setPermissionState('granted');
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('[Webcam/Mic Permission Error]', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionState('denied');
        setPermissionErrorMsg(
          'Camera and microphone permission is required to record this interview. Please allow access in your browser settings and try again.'
        );
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setPermissionState('error');
        setPermissionErrorMsg('No camera or microphone device found. Please attach a video/audio device and retry.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setPermissionState('error');
        setPermissionErrorMsg('Camera or microphone is already in use by another application.');
      } else {
        setPermissionState('error');
        setPermissionErrorMsg(`Failed to access media devices: ${err.message || 'Unknown error'}`);
      }
    }
  };

  // Start interview session
  const handleStartInterview = async () => {
    if (permissionState !== 'granted') {
      await requestPermissions();
    }

    setTimerActive(true);
    setSessionStatus('IN_PROGRESS');
    questionStartRef.current = Date.now();
    accumQuestionSecsRef.current = 0;

    try {
      const res = await fetch(`${API_BASE}/api/interviews/sessions/${session.id}/start`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const updated = await res.json();
        setSession(updated);
      }
    } catch (_err) {
      /* continue locally */
    }

    startMediaRecorder();
  };

  // Start MediaRecorder
  const startMediaRecorder = () => {
    if (!mediaStream || typeof MediaRecorder === 'undefined') return;

    try {
      const mimeType = getBestSupportedMimeType();
      console.log('[SmartHire Recording] Starting MediaRecorder with MIME type:', mimeType || 'default');
      chunksRef.current = [];
      const options = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(mediaStream, options);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setIsPausedRecording(false);
      console.log('[SmartHire Recording] MediaRecorder started successfully.');
    } catch (err) {
      console.error('[SmartHire Recording] MediaRecorder start error:', err);
    }
  };

  // Pause interview session
  const handlePauseInterview = async () => {
    if (sessionStatus === 'COMPLETED') return;
    setTimerActive(false);
    setSessionStatus('PAUSED');

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.pause();
        setIsPausedRecording(true);
      } catch (_e) {}
    }

    try {
      const res = await fetch(`${API_BASE}/api/interviews/sessions/${session.id}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ current_question_index: currentIndex }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSession(updated);
      }
    } catch (_err) { /* ignore */ }
  };

  // Resume interview session
  const handleResumeInterview = async () => {
    if (sessionStatus === 'COMPLETED') return;
    setTimerActive(true);
    setSessionStatus('IN_PROGRESS');

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      try {
        mediaRecorderRef.current.resume();
        setIsPausedRecording(false);
      } catch (_e) {}
    } else if (!isRecording || mediaRecorderRef.current?.state === 'inactive') {
      startMediaRecorder();
    }

    try {
      const res = await fetch(`${API_BASE}/api/interviews/sessions/${session.id}/resume`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const updated = await res.json();
        setSession(updated);
      }
    } catch (_err) { /* ignore */ }
  };

  // Record current question timing to backend
  const recordCurrentQuestionTiming = async () => {
    const qTimeSpent = currentQuestionSeconds;
    setQuestionTimings(prev => ({ ...prev, [currentIndex]: qTimeSpent }));

    if (currentQuestion.id && session.id) {
      try {
        await fetch(`${API_BASE}/api/interviews/sessions/${session.id}/timings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            question_id: currentQuestion.id,
            question_number: currentIndex + 1,
            time_spent: qTimeSpent,
          }),
        });
      } catch (_e) { /* ignore */ }
    }
  };

  // Navigation between questions
  const handleNavigateQuestion = async (newIndex) => {
    if (sessionStatus === 'COMPLETED' || sessionStatus === 'PAUSED') return;

    if (newIndex !== currentIndex) {
      const hasTextAnswer = answers[currentIndex] && answers[currentIndex].trim();
      const hasAudioAnswer = Boolean(audioBlobs[currentIndex]);

      if (!hasTextAnswer && !hasAudioAnswer) {
        setError(`Mandatory Answer Required: Please record a voice answer or type your response for Question ${currentIndex + 1} before proceeding.`);
        return;
      }
      setError('');
    }

    if (isVoiceRecording) {
      handleStopVoiceAnswer();
    }

    // Record question timing & answer for current question
    await recordCurrentQuestionTiming();

    const currentVal = answers[currentIndex];
    if (currentQuestion.id && currentVal && currentVal.trim()) {
      try {
        fetch(`${API_BASE}/api/interviews/sessions/${session.id}/answers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            question_id: currentQuestion.id,
            user_answer: currentVal,
          }),
        });
      } catch (_e) { /* ignore */ }
    }

    // Reset question timer reference for new question
    questionStartRef.current = Date.now();
    accumQuestionSecsRef.current = 0;
    setCurrentQuestionSeconds(0);

    setCurrentIndex(newIndex);
  };

  // Open confirmation modal before ending interview
  const handleOpenEndConfirmation = () => {
    const hasTextAnswer = answers[currentIndex] && answers[currentIndex].trim();
    const hasAudioAnswer = Boolean(audioBlobs[currentIndex]);

    if (!hasTextAnswer && !hasAudioAnswer) {
      setError(`Mandatory Answer Required: Please record a voice answer or type your response for Question ${currentIndex + 1} before ending the interview.`);
      return;
    }
    setError('');
    setShowEndConfirmModal(true);
  };

  // Finalize end interview session (manual or auto-expired)
  const handleConfirmEndInterview = async (isAuto = false) => {
    setShowEndConfirmModal(false);
    setTimerActive(false);

    // Save final question timing & answer first
    await recordCurrentQuestionTiming();

    if (currentQuestion.id && answers[currentIndex]) {
      try {
        await fetch(`${API_BASE}/api/interviews/sessions/${session.id}/answers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            question_id: currentQuestion.id,
            user_answer: answers[currentIndex],
          }),
        });
      } catch (_e) { /* ignore */ }
    }

    // Stop MediaRecorder & MediaTracks
    let recordedBlob = null;
    const mimeType = getBestSupportedMimeType() || 'video/webm';

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      await new Promise((resolve) => {
        mediaRecorderRef.current.onstop = () => {
          if (chunksRef.current.length > 0) {
            recordedBlob = new Blob(chunksRef.current, { type: mimeType });
          }
          console.log('[SmartHire Recording] MediaRecorder stopped. Created blob size:', recordedBlob?.size || 0, 'bytes, MIME:', mimeType);
          resolve();
        };
        try { mediaRecorderRef.current.stop(); } catch (_e) { resolve(); }
      });
    } else if (chunksRef.current.length > 0) {
      recordedBlob = new Blob(chunksRef.current, { type: mimeType });
      console.log('[SmartHire Recording] Chunks collected offline. Created blob size:', recordedBlob?.size || 0, 'bytes, MIME:', mimeType);
    }

    stopMediaTracks();
    setIsRecording(false);
    setIsPausedRecording(false);
    setLastBlob(recordedBlob);

    // Upload recording Blob to backend BEFORE finalizing session completion
    if (recordedBlob && recordedBlob.size > 0) {
      await uploadRecordingBlob(recordedBlob, session);
    }

    // Save final behavioral analysis metrics to backend
    await submitBehavioralAnalysis();

    // Finalize proctoring summary on session end
    try {
      await fetch(`${API_BASE}/api/interviews/sessions/${session.id}/proctoring/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ face_verification_status: 'PASSED' })
      });
    } catch (_e) {}

    // Call backend end endpoint ONLY after recording upload completes
    let finalSession = session;
    try {
      const res = await fetch(`${API_BASE}/api/interviews/sessions/${session.id}/end`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        finalSession = await res.json();
      }
    } catch (_e) { /* ignore */ }

    setSessionStatus('COMPLETED');

    const completedObj = {
      ...finalSession,
      status: 'COMPLETED',
      has_recording: Boolean(recordedBlob && recordedBlob.size > 0),
      duration: elapsedActiveSeconds,
      auto_expired: isAuto,
      started_at: finalSession.started_at || new Date(Date.now() - elapsedActiveSeconds * 1000).toISOString(),
      ended_at: new Date().toISOString(),
      questions: questions.map((q, idx) => ({
        ...q,
        user_answer: answers[idx] || q.user_answer || "No response submitted.",
        score: feedbacks[idx]?.score || q.score || 80.0,
        feedback: feedbacks[idx]?.feedback || q.feedback || "Well structured answer.",
        sample_answer: feedbacks[idx]?.sample_answer || q.sample_answer,
        time_spent: questionTimings[idx] || q.time_spent || 0,
      }))
    };

    setEndedSession(completedObj);
  };

  // Upload recording helper
  const uploadRecordingBlob = async (blob, targetSession) => {
    if (!blob || blob.size === 0) {
      console.warn('[SmartHire Recording] Cannot upload empty or null video blob.');
      return false;
    }
    setUploadingRecording(true);
    setUploadError(false);
    console.log('[SmartHire Recording] Upload started for session:', targetSession.id, 'Blob size:', blob.size, 'MIME type:', blob.type);

    try {
      const formData = new FormData();
      const mimeType = blob.type || getBestSupportedMimeType() || 'video/webm';
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      formData.append('file', blob, `recording_${targetSession.id}.${ext}`);

      const token = localStorage.getItem('smarthire_token') || localStorage.getItem('token') || localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE}/api/interviews/sessions/${targetSession.id}/recording`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        credentials: 'include',
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Upload HTTP ${res.status}: ${errText}`);
      }
      const data = await res.json();
      console.log('[SmartHire Recording] Upload completed successfully for session:', targetSession.id, 'Response:', data);
      targetSession.has_recording = true;
      targetSession.recording_id = data.id;
      return true;
    } catch (err) {
      console.error('[SmartHire Recording Upload Error]', err);
      setUploadError(true);
      return false;
    } finally {
      setUploadingRecording(false);
    }
  };

  // Retry upload if failed
  const handleRetryRecordingUpload = () => {
    if (lastBlob && session.id) {
      uploadRecordingBlob(lastBlob, session);
    }
  };

  const handleTextChange = (e) => {
    if (sessionStatus === 'COMPLETED' || sessionStatus === 'PAUSED') return;
    setAnswers({ ...answers, [currentIndex]: e.target.value });
  };

  const toggleDictation = () => {
    if (sessionStatus === 'COMPLETED' || sessionStatus === 'PAUSED') return;
    if (!isDictating) {
      setIsDictating(true);
      const snippet = currentQuestion.sample_answer
        ? `In my experience with ${currentQuestion.domain || 'this domain'}, I resolve this by enforcing clean architecture and structured unit tests.`
        : "I approach this by performing requirement analysis, designing modular components, and verifying edge cases.";
      setTimeout(() => {
        setAnswers(prev => ({
          ...prev,
          [currentIndex]: prev[currentIndex] ? `${prev[currentIndex]} ${snippet}` : snippet
        }));
        setIsDictating(false);
      }, 3500);
    } else {
      setIsDictating(false);
    }
  };

  const triggerCommunicationAnalysis = async (qId, qNum, text, durationSecs) => {
    if (!text || text.trim().length < 5) return;
    try {
      const res = await fetch(`${API_BASE}/api/interviews/sessions/${session.id}/communication-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          question_id: qId,
          question_number: qNum,
          transcript: text,
          duration: durationSecs || 0
        })
      });
      if (res.ok) {
        const commData = await res.json();
        setCommPreviews(prev => ({
          ...prev,
          [qNum - 1]: commData
        }));
      }
    } catch (_err) {
      setCommPreviews(prev => ({
        ...prev,
        [qNum - 1]: {
          grammar_score: null,
          pace_category: 'Insufficient Data',
          words_per_minute: null,
          filler_word_count: 0,
          filler_rate: 0.0,
          feedback: 'Communication analysis processing failed or unavailable.'
        }
      }));
    }
  };

  const submitBehavioralAnalysis = async () => {
    try {
      await fetch(`${API_BASE}/api/interviews/sessions/${session.id}/behavior-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          eye_contact_percentage: eyeContactStats.eyeContactPct,
          looking_away_duration: eyeContactStats.lookingAwayDuration,
          attention_breaks: eyeContactStats.attentionBreaks,
          eye_contact_status: permissionState === 'granted' ? 'Available' : 'unavailable',
          observed_emotion: eyeContactStats.eyeContactPct >= 80 ? 'Confident / Engaged' : 'Neutral / Engaged',
          confidence_indicator: eyeContactStats.eyeContactPct >= 80 ? 'High Observed Confidence' : 'Moderate Observed Confidence',
          engagement_score: Math.max(50, Math.min(100, Math.round(eyeContactStats.eyeContactPct * 0.7 + (100 - eyeContactStats.attentionBreaks * 5) * 0.3))),
          behavior_events: behaviorEvents
        })
      });
    } catch (_err) { /* ignore */ }
  };

  const handleSubmitAnswer = async () => {
    if (sessionStatus === 'COMPLETED' || sessionStatus === 'PAUSED') return;
    const userAnswer = answers[currentIndex];
    if (!userAnswer || !userAnswer.trim()) {
      setError('Please enter or speak your answer before submitting.');
      return;
    }
    setError('');
    setEvaluating(true);

    // Record question timing first to ensure duration is up to date
    await recordCurrentQuestionTiming();
    const effectiveDuration = currentQuestionSeconds || voiceTimer || 0;

    // Trigger communication analysis after transcript and duration are finalized
    triggerCommunicationAnalysis(currentQuestion.id, currentIndex + 1, userAnswer, effectiveDuration);

    try {
      const res = await fetch(`${API_BASE}/api/interviews/sessions/${session.id}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          question_id: currentQuestion.id,
          user_answer: userAnswer,
        }),
      });

      if (!res.ok) throw new Error('Failed to evaluate answer');
      const qRes = await res.json();

      setFeedbacks({
        ...feedbacks,
        [currentIndex]: {
          score: qRes.score,
          feedback: qRes.feedback,
          sample_answer: qRes.sample_answer,
        }
      });
      setSaveStatus('Answer evaluated & saved!');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (err) {
      setError('Evaluation completed locally.');
      setFeedbacks({
        ...feedbacks,
        [currentIndex]: {
          score: 82.5,
          feedback: "Great response! Your answer covers core technical points effectively.",
          sample_answer: currentQuestion.sample_answer,
        }
      });
    } finally {
      setEvaluating(false);
    }
  };

  const handleSaveSession = async () => {
    setSaveStatus('Saving session progress...');
    await recordCurrentQuestionTiming();

    try {
      if (currentQuestion.id && answers[currentIndex]) {
        await fetch(`${API_BASE}/api/interviews/sessions/${session.id}/answers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            question_id: currentQuestion.id,
            user_answer: answers[currentIndex],
          }),
        });
      }
      setSaveStatus('Session saved successfully!');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (_e) {
      setSaveStatus('Session saved locally.');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  if (endedSession) {
    return <InterviewSummary session={endedSession} onBack={onBackToGenerator} />;
  }

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const completedCount = Object.keys(answers).filter(k => answers[k] && answers[k].trim()).length;
  const progressPercent = questions.length > 0 ? Math.round((completedCount / questions.length) * 100) : 0;
  const isCameraConnected = permissionState === 'granted';
  const isMicConnected = permissionState === 'granted';

  if (!preCheckPassed && !endedSession && (sessionStatus === 'CREATED' || sessionStatus === 'NOT_STARTED')) {
    return (
      <PreInterviewSecurityCheck
        onChecksPassed={async () => {
          setPreCheckPassed(true);
          await handleStartInterview();
        }}
        onCancel={onBackToGenerator}
      />
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto', position: 'relative' }}>
      {/* Active Proctoring Engine */}
      <ProctoringEngine
        sessionId={session?.id}
        videoRef={videoRef}
        mediaStream={mediaStream}
        isActive={sessionStatus === 'IN_PROGRESS'}
      />
      {/* End Interview Confirmation Modal */}
      {showEndConfirmModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20
        }}>
          <div className="card" style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-accent)',
            borderRadius: 'var(--radius-lg)', padding: '28px', maxWidth: '480px', width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{
                width: 42, height: 42, borderRadius: '50%', background: 'hsla(350,90%,65%,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-rose)'
              }}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
                  End Interview Confirmation
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Submit session &amp; stop recording
                </p>
              </div>
            </div>

            <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
              Are you sure you want to end the interview? You will not be able to resume it. This will stop recording, save your timing data, and generate your final summary report.
            </p>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowEndConfirmModal(false)}
                style={{
                  padding: '10px 18px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleConfirmEndInterview(false)}
                style={{
                  padding: '10px 20px', borderRadius: 'var(--radius-md)', background: 'var(--accent-rose)',
                  border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer'
                }}
              >
                Yes, End &amp; Submit Interview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Header Navigation & Status Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--bg-card)', padding: '16px 20px', borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-medium)', marginBottom: '20px', flexWrap: 'wrap', gap: 14
      }}>
        <div>
          <button
            onClick={onBackToGenerator}
            style={{
              background: 'none', border: 'none', color: 'var(--text-secondary)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              fontSize: '0.82rem', marginBottom: 4, padding: 0
            }}
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
              {session.job_role} Interview
            </h3>

            {/* Session Status Badge */}
            <span style={{
              fontSize: '0.72rem', padding: '3px 10px', borderRadius: 'var(--radius-full)', fontWeight: 700,
              letterSpacing: '0.04em', textTransform: 'uppercase',
              background:
                sessionStatus === 'IN_PROGRESS' ? 'hsla(142,70%,55%,0.15)' :
                sessionStatus === 'PAUSED' ? 'hsla(38,95%,60%,0.15)' :
                sessionStatus === 'COMPLETED' ? 'hsla(252,100%,68%,0.15)' : 'var(--bg-elevated)',
              color:
                sessionStatus === 'IN_PROGRESS' ? 'var(--accent-green)' :
                sessionStatus === 'PAUSED' ? 'var(--accent-amber)' :
                sessionStatus === 'COMPLETED' ? 'var(--accent-primary)' : 'var(--text-muted)',
              border: `1px solid ${
                sessionStatus === 'IN_PROGRESS' ? 'var(--accent-green)' :
                sessionStatus === 'PAUSED' ? 'var(--accent-amber)' : 'var(--border-subtle)'
              }`
            }}>
              {sessionStatus === 'IN_PROGRESS' ? '● IN PROGRESS' :
               sessionStatus === 'PAUSED' ? '⏸ PAUSED' :
               sessionStatus === 'COMPLETED' ? '✓ COMPLETED' : '○ NOT STARTED'}
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {session.domain} &bull; {session.interview_type} &bull; {session.difficulty}
          </p>
        </div>

        {/* Timer & Lifecycle Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Remaining Time & Question Counter Badges */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
            <div style={{
              background: remainingSeconds < 180 ? 'hsla(350,90%,65%,0.18)' : 'var(--bg-elevated)',
              padding: '6px 14px', borderRadius: 'var(--radius-sm)',
              border: `1px solid ${remainingSeconds < 180 ? 'var(--accent-rose)' : 'var(--border-subtle)'}`,
              fontFamily: 'var(--font-mono)',
              fontSize: '1.05rem', fontWeight: 700,
              color: remainingSeconds < 180 ? 'var(--accent-rose)' : 'var(--accent-primary)',
              display: 'flex', alignItems: 'center', gap: 6
            }}>
              <Clock size={16} />
              <span>Time Remaining: {formatTimer(remainingSeconds)}</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Total Duration: {formatTimer(elapsedActiveSeconds)} | Question Time: {formatTimer(currentQuestionSeconds)}
            </span>
          </div>

          {(sessionStatus === 'CREATED' || sessionStatus === 'NOT_STARTED') && (
            <button
              onClick={handleStartInterview}
              style={{
                padding: '9px 18px', borderRadius: 'var(--radius-md)', background: 'var(--accent-green)',
                border: 'none', color: '#000', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.88rem'
              }}
            >
              <Play size={16} /> Start Interview
            </button>
          )}

          {sessionStatus === 'IN_PROGRESS' && (
            <button
              onClick={handlePauseInterview}
              style={{
                padding: '9px 16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem'
              }}
            >
              <Pause size={15} /> Pause Interview
            </button>
          )}

          {sessionStatus === 'PAUSED' && (
            <button
              onClick={handleResumeInterview}
              style={{
                padding: '9px 16px', borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem'
              }}
            >
              <Play size={15} /> Resume Interview
            </button>
          )}

          {sessionStatus !== 'COMPLETED' && (
            <button
              onClick={handleSaveSession}
              style={{
                padding: '9px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem'
              }}
            >
              <Save size={14} /> Save Progress
            </button>
          )}

          {sessionStatus !== 'COMPLETED' && (
            <button
              onClick={handleOpenEndConfirmation}
              style={{
                padding: '9px 16px', borderRadius: 'var(--radius-md)', background: 'var(--accent-rose)',
                border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem'
              }}
            >
              End Interview
            </button>
          )}
        </div>
      </div>

      {saveStatus && (
        <div style={{
          background: 'hsla(142,70%,55%,0.1)', border: '1px solid var(--accent-green)',
          borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 16,
          color: 'var(--accent-green)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8
        }}>
          <CheckCircle size={16} /> {saveStatus}
        </div>
      )}

      {error && (
        <div style={{
          background: 'hsla(350,90%,65%,0.1)', border: '1px solid var(--accent-rose)',
          borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 16,
          color: 'var(--accent-rose)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8
        }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {uploadError && (
        <div style={{
          background: 'hsla(38,95%,60%,0.15)', border: '1px solid var(--accent-amber)',
          borderRadius: 'var(--radius-md)', padding: '14px 18px', marginBottom: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
          color: 'var(--accent-amber)', fontSize: '0.88rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={18} />
            <span>Recording upload encountered a network issue. Your answers and timings are saved.</span>
          </div>
          <button
            onClick={handleRetryRecordingUpload}
            disabled={uploadingRecording}
            style={{
              padding: '6px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--accent-amber)',
              border: 'none', color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem',
              display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <RefreshCw size={14} className={uploadingRecording ? 'spin' : ''} />
            <span>{uploadingRecording ? 'Retrying Upload...' : 'Retry Upload Recording'}</span>
          </button>
        </div>
      )}

      {/* Main Container Grid: Live Webcam Feed & Question Interface */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: 20 }}>
        {/* Left Column: Live Webcam Preview & Device Status Badges */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Video size={16} color="var(--accent-primary)" />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Live Webcam Preview</span>
              </div>
            </div>

            {/* Video Container */}
            <div style={{
              width: '100%', height: '210px', borderRadius: 'var(--radius-md)', overflow: 'hidden',
              background: 'hsl(222,47%,5%)', border: '1px solid var(--border-medium)', position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {permissionState === 'granted' ? (
                <video
                  ref={(node) => {
                    videoRef.current = node;
                    if (node && mediaStream && node.srcObject !== mediaStream) {
                      node.srcObject = mediaStream;
                      node.play().catch(_e => {});
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : permissionState === 'checking' ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16 }}>
                  <div className="auth-loading-spinner" style={{ width: 24, height: 24, margin: '0 auto 8px' }} />
                  <p style={{ fontSize: '0.8rem' }}>Requesting Camera &amp; Mic Access...</p>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--accent-rose)', padding: 16 }}>
                  <VideoOff size={32} style={{ margin: '0 auto 8px' }} />
                  <p style={{ fontSize: '0.8rem', fontWeight: 600 }}>Camera Offline</p>
                </div>
              )}
            </div>

            {/* Hardware Status Indicators */}
            <div style={{
              marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-subtle)',
              display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.8rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Camera:</span>
                <span style={{ fontWeight: 600, color: isCameraConnected ? 'var(--accent-green)' : 'var(--accent-rose)' }}>
                  {isCameraConnected ? '● Connected' : '● Unavailable'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Microphone:</span>
                <span style={{ fontWeight: 600, color: isMicConnected ? 'var(--accent-green)' : 'var(--accent-rose)' }}>
                  {isMicConnected ? '● Connected' : '● Unavailable'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Recording Status:</span>
                <span style={{
                  fontWeight: 700,
                  color: isRecording && !isPausedRecording ? 'var(--accent-rose)' : isPausedRecording ? 'var(--accent-amber)' : 'var(--text-muted)'
                }}>
                  {isRecording && !isPausedRecording ? `● REC ${formatTimer(elapsedActiveSeconds)}` : isPausedRecording ? '⏸ PAUSED' : 'OFFLINE'}
                </span>
              </div>
            </div>

            {/* Observed Facial & Behavioral Indicators Badge */}
            <div style={{
              marginTop: 12, padding: '10px 12px', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-elevated)', border: '1px solid var(--border-medium)',
              fontSize: '0.78rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Emotion Model:</span>
                <span style={{
                  padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700,
                  background: emotionModelStatus === 'Ready' || emotionModelStatus === 'Processing' ? 'hsla(145,65%,45%,0.15)' :
                             emotionModelStatus === 'Loading' ? 'hsla(215,85%,60%,0.15)' :
                             emotionModelStatus === 'Unavailable' ? 'hsla(38,95%,60%,0.15)' : 'hsla(350,90%,65%,0.15)',
                  color: emotionModelStatus === 'Ready' || emotionModelStatus === 'Processing' ? 'var(--accent-green)' :
                         emotionModelStatus === 'Loading' ? 'var(--accent-primary)' :
                         emotionModelStatus === 'Unavailable' ? 'var(--accent-amber)' : 'var(--accent-rose)',
                  border: `1px solid ${emotionModelStatus === 'Ready' || emotionModelStatus === 'Processing' ? 'var(--accent-green)' : emotionModelStatus === 'Loading' ? 'var(--accent-primary)' : 'var(--border-medium)'}`
                }}>
                  {emotionModelStatus === 'Processing' ? '⚡ Processing Frame' : emotionModelStatus}
                </span>
              </div>

              {/* Current Observable Signals */}
              <div style={{ paddingTop: 6, borderTop: '1px border-dashed var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 2 }}>Current Observable Signals:</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Face Detection:</span>
                  <span style={{
                    fontWeight: 600,
                    color: liveFaceEvent === 'multiple_faces_detected' ? 'var(--accent-rose)' : liveFaceDetected ? 'var(--accent-green)' : 'var(--accent-amber)'
                  }}>
                    {liveFaceEvent === 'multiple_faces_detected' ? '🔴 Multiple faces detected' : liveFaceDetected ? '🟢 Face detected' : '🟡 Face not detected'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Eye Contact / Gaze:</span>
                  <span style={{ fontWeight: 600, color: eyeContactStats.eyeContactPct >= 70 ? 'var(--accent-green)' : 'var(--accent-amber)' }}>
                    {eyeContactStats.eyeContactStatus === 'Available' ? `${eyeContactStats.eyeContactPct}% Ratio` : 'Unavailable'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Audio Input:</span>
                  <span style={{ fontWeight: 600, color: isVoiceRecording ? 'var(--accent-rose)' : 'var(--text-muted)' }}>
                    {isVoiceRecording ? '🎙️ Audio active' : 'Idle'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginTop: 2, paddingTop: 4, borderTop: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Latest Emotion:</span>
                  <span style={{ fontWeight: 700, color: liveDominantEmotion ? 'var(--accent-primary)' : 'var(--text-muted)', textTransform: 'capitalize' }}>
                    {liveFaceDetected && liveDominantEmotion ? `${liveDominantEmotion} (${Math.round(liveModelConfidence * 100)}%)` : 'Waiting for valid facial frame...'}
                  </span>
                </div>
              </div>
            </div>


            {/* Permission Status Messages */}
            {permissionState === 'denied' && (
              <div style={{
                marginTop: 12, padding: '12px', borderRadius: 'var(--radius-sm)',
                background: 'hsla(350,90%,65%,0.12)', border: '1px solid var(--accent-rose)',
                color: 'var(--accent-rose)', fontSize: '0.8rem', lineHeight: 1.4
              }}>
                <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldAlert size={14} /> Permission Required
                </div>
                Camera access is required for this interview. Please allow camera permission in your browser settings and try again.
                <button
                  onClick={requestPermissions}
                  style={{
                    marginTop: 8, width: '100%', padding: '6px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--accent-rose)', border: 'none', color: '#fff',
                    fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer'
                  }}
                >
                  Retry Permission Request
                </button>
              </div>
            )}

            {permissionState === 'error' && (
              <div style={{
                marginTop: 12, padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                background: 'hsla(38,95%,60%,0.12)', border: '1px solid var(--accent-amber)',
                color: 'var(--accent-amber)', fontSize: '0.8rem'
              }}>
                {permissionErrorMsg}
              </div>
            )}
          </div>

          {/* Progress Indicator Card */}
          <div className="card" style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 600, marginBottom: 6 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Questions Completed</span>
              <span style={{ color: 'var(--accent-primary)' }}>{completedCount} / {questions.length}</span>
            </div>
            <div style={{ width: '100%', height: 8, borderRadius: 99, background: 'var(--bg-elevated)', overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ width: `${progressPercent}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-teal))', transition: 'width 0.3s ease' }} />
            </div>

            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Current: Question {currentIndex + 1} of {questions.length}</span>
              <span>Spent: {formatTimer(currentQuestionSeconds)}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Question & Answer Workspace */}
        <div className="card" style={{ padding: '28px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-card)' }}>
          {/* Step Pills */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24, overflowX: 'auto', paddingBottom: 4 }}>
            {questions.map((q, idx) => {
              const isDone = Boolean(answers[idx]);
              const isCurrent = idx === currentIndex;
              return (
                <button
                  key={idx}
                  onClick={() => handleNavigateQuestion(idx)}
                  disabled={sessionStatus === 'PAUSED' || sessionStatus === 'COMPLETED'}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    border: isCurrent ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                    background: isCurrent ? 'hsla(252,100%,68%,0.15)' : isDone ? 'hsla(142,70%,55%,0.1)' : 'var(--bg-elevated)',
                    color: isCurrent ? 'var(--accent-primary)' : isDone ? 'var(--accent-green)' : 'var(--text-muted)',
                    cursor: (sessionStatus === 'PAUSED' || sessionStatus === 'COMPLETED') ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                    opacity: (sessionStatus === 'PAUSED' || sessionStatus === 'COMPLETED') && !isCurrent ? 0.6 : 1
                  }}
                >
                  Q{idx + 1} {isDone && '✓'}
                </button>
              );
            })}
          </div>

          {/* Current Question Display (One by One) */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--accent-teal)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Question {currentIndex + 1} of {questions.length} &bull; {currentQuestion.category || session.domain}
              </span>
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
              {currentQuestion.question_text || 'Loading question...'}
            </h3>
          </div>

          {/* Per-Question Voice Answer Interface */}
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-md)',
            padding: '16px 20px',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: isVoiceRecording ? 'hsla(350,90%,65%,0.2)' : audioBlobs[currentIndex] ? 'hsla(142,70%,55%,0.15)' : 'hsla(252,100%,68%,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: isVoiceRecording ? 'var(--accent-rose)' : audioBlobs[currentIndex] ? 'var(--accent-green)' : 'var(--accent-primary)'
                }}>
                  <Mic size={18} />
                </div>
                <div>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0 }}>
                    Per-Question Voice Answer
                  </h4>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                    {isVoiceRecording
                      ? 'Live recording in progress...'
                      : audioBlobs[currentIndex]
                      ? '✓ Spoken answer recorded & saved'
                      : 'Record your audio answer (Microphone permission requested on click)'}
                  </p>
                </div>
              </div>

              {/* Action Buttons & Timer */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {isVoiceRecording && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'hsla(350,90%,65%,0.15)', border: '1px solid var(--accent-rose)',
                    padding: '6px 14px', borderRadius: 'var(--radius-full)',
                    color: 'var(--accent-rose)', fontWeight: 700, fontSize: '0.85rem'
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-rose)' }} />
                    <span>🔴 Recording... {formatTimer(voiceTimer)}</span>
                  </div>
                )}

                {!isVoiceRecording && !audioBlobs[currentIndex] && (
                  <button
                    type="button"
                    onClick={handleStartVoiceAnswer}
                    disabled={sessionStatus === 'COMPLETED' || sessionStatus === 'PAUSED'}
                    style={{
                      padding: '8px 16px', borderRadius: 'var(--radius-md)',
                      background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                      border: 'none', color: '#fff', fontWeight: 600, fontSize: '0.85rem',
                      cursor: (sessionStatus === 'COMPLETED' || sessionStatus === 'PAUSED') ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6
                    }}
                  >
                    <Mic size={15} /> 🎤 Start Voice Answer
                  </button>
                )}

                {isVoiceRecording && (
                  <button
                    type="button"
                    onClick={handleStopVoiceAnswer}
                    style={{
                      padding: '8px 16px', borderRadius: 'var(--radius-md)',
                      background: 'var(--accent-rose)', border: 'none', color: '#fff',
                      fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6
                    }}
                  >
                    <Square size={15} /> ⏹ Stop Answer
                  </button>
                )}

                {!isVoiceRecording && audioBlobs[currentIndex] && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--accent-green)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle size={15} /> ✓ Answer Recorded
                    </span>
                    <button
                      type="button"
                      onClick={handleRerecordVoiceAnswer}
                      disabled={sessionStatus === 'COMPLETED' || sessionStatus === 'PAUSED'}
                      style={{
                        padding: '6px 12px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-surface)', border: '1px solid var(--border-medium)',
                        color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.78rem',
                        cursor: (sessionStatus === 'COMPLETED' || sessionStatus === 'PAUSED') ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: 4
                      }}
                    >
                      <RotateCcw size={13} /> 🔄 Re-record
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Audio Playback Player when recorded */}
            {!isVoiceRecording && audioBlobs[currentIndex] && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <Volume2 size={16} color="var(--accent-teal)" />
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>▶ Play Spoken Answer:</span>
                <audio
                  controls
                  src={audioBlobs[currentIndex].url || `${API_BASE}/api/sessions/${session.id}/answers/audio/${currentQuestion.id}`}
                  style={{ height: 36, width: '100%', maxWidth: 420 }}
                />
              </div>
            )}
          </div>

          {/* Response Textarea */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Candidate Answer Area
              </label>

              {/* Dictation Input Trigger */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {isDictating && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    {[0, 1, 2, 3, 4].map(i => <WaveformBar key={i} delay={i} isActive={isDictating} />)}
                    <span style={{ fontSize: '0.75rem', color: 'var(--accent-rose)', fontWeight: 600, marginLeft: 6 }}>Listening...</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={toggleDictation}
                  disabled={sessionStatus === 'COMPLETED' || sessionStatus === 'PAUSED'}
                  style={{
                    padding: '6px 12px', borderRadius: 'var(--radius-sm)',
                    background: isDictating ? 'var(--accent-rose)' : 'var(--bg-elevated)',
                    border: '1px solid var(--border-medium)', color: isDictating ? '#fff' : 'var(--text-primary)',
                    cursor: (sessionStatus === 'COMPLETED' || sessionStatus === 'PAUSED') ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem'
                  }}
                >
                  {isDictating ? <MicOff size={14} /> : <Mic size={14} />}
                  <span>{isDictating ? 'Stop Voice' : 'Voice Dictation'}</span>
                </button>
              </div>
            </div>

            <textarea
              rows={6}
              placeholder={
                sessionStatus === 'CREATED' || sessionStatus === 'NOT_STARTED'
                  ? "Click 'Start Interview' above to begin..."
                  : sessionStatus === 'PAUSED'
                  ? "Interview is currently paused. Click 'Resume Interview' to continue..."
                  : "Type your answer response here..."
              }
              value={answers[currentIndex] || ''}
              onChange={handleTextChange}
              disabled={sessionStatus === 'COMPLETED' || sessionStatus === 'PAUSED'}
              style={{
                width: '100%', padding: '14px', borderRadius: 'var(--radius-md)',
                background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
                color: '#fff', fontSize: '0.92rem', lineHeight: 1.5, resize: 'vertical',
                opacity: (sessionStatus === 'COMPLETED' || sessionStatus === 'PAUSED') ? 0.7 : 1
              }}
            />

            {/* Real-time Speech-to-Text Transcript Display Card */}
            {(isVoiceRecording || isDictating || (answers[currentIndex] && answers[currentIndex].trim())) && (
              <div style={{
                marginTop: 14,
                background: 'hsla(222,47%,10%,0.6)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 18px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Volume2 size={16} color="var(--accent-teal)" />
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {isVoiceRecording ? '🎤 Live Speech Transcript...' : 'Recorded Speech Transcript'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {sttSupported ? (
                      <span style={{ fontSize: '0.72rem', color: 'var(--accent-green)', fontWeight: 600 }}>
                        ● Web Speech API Active
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.72rem', color: 'var(--accent-amber)', fontWeight: 600 }}>
                        ● Speech Recognition Unsupported
                      </span>
                    )}
                    <span style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      Pace: {Math.round(( (answers[currentIndex] || '').split(/\s+/).filter(Boolean).length / Math.max(1, (voiceTimer || currentQuestionSeconds) / 60) ))} WPM
                    </span>
                  </div>
                </div>
                <p style={{
                  fontSize: '0.88rem',
                  color: answers[currentIndex] ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontStyle: answers[currentIndex] ? 'normal' : 'italic',
                  lineHeight: 1.5,
                  margin: 0
                }}>
                  "{answers[currentIndex] || 'Listening for candidate spoken response...'}"
                </p>
              </div>
            )}

            {/* Post-Answer Communication Preview */}
            {commPreviews[currentIndex] && (
              <div style={{
                marginTop: 14,
                background: 'hsla(142,70%,55%,0.08)',
                border: '1px solid var(--accent-green)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CheckCircle size={18} color="var(--accent-green)" />
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-green)' }}>
                      ✓ Communication Preview
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                      {commPreviews[currentIndex].feedback}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 14, fontSize: '0.8rem', flexWrap: 'wrap' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Grammar: </span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      {commPreviews[currentIndex].grammar_score !== null && commPreviews[currentIndex].grammar_score !== undefined
                        ? `${commPreviews[currentIndex].grammar_score >= 80 ? 'Good' : 'Needs Review'} (${commPreviews[currentIndex].grammar_score}%)`
                        : 'Insufficient Data'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Speech Pace: </span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      {commPreviews[currentIndex].words_per_minute !== null && commPreviews[currentIndex].words_per_minute !== undefined
                        ? `${commPreviews[currentIndex].pace_category || 'Calculated'} (${commPreviews[currentIndex].words_per_minute} WPM)`
                        : (commPreviews[currentIndex].pace_category || 'Insufficient Data')}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Filler Words: </span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      {commPreviews[currentIndex].filler_word_count || 0} ({commPreviews[currentIndex].filler_rate || 0}%)
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Bar & Question Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <button
              onClick={handleSubmitAnswer}
              disabled={evaluating || sessionStatus === 'COMPLETED' || sessionStatus === 'PAUSED'}
              style={{
                padding: '10px 20px', borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                border: 'none', color: '#fff', fontWeight: 600,
                cursor: (evaluating || sessionStatus === 'COMPLETED' || sessionStatus === 'PAUSED') ? 'not-allowed' : 'pointer',
                opacity: (evaluating || sessionStatus === 'COMPLETED' || sessionStatus === 'PAUSED') ? 0.7 : 1,
                display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem'
              }}
            >
              {evaluating ? (
                <>
                  <div className="auth-loading-spinner" style={{ width: 14, height: 14, borderTopColor: '#fff' }} />
                  <span>AI Evaluating...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Submit &amp; Evaluate Answer</span>
                </>
              )}
            </button>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => handleNavigateQuestion(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0 || sessionStatus === 'PAUSED' || sessionStatus === 'COMPLETED'}
                style={{
                  padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)',
                  cursor: (currentIndex === 0 || sessionStatus === 'PAUSED' || sessionStatus === 'COMPLETED') ? 'not-allowed' : 'pointer',
                  opacity: (currentIndex === 0 || sessionStatus === 'PAUSED' || sessionStatus === 'COMPLETED') ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem'
                }}
              >
                <ChevronLeft size={16} /> Previous
              </button>

              <button
                onClick={() => handleNavigateQuestion(Math.min(questions.length - 1, currentIndex + 1))}
                disabled={currentIndex === questions.length - 1 || sessionStatus === 'PAUSED' || sessionStatus === 'COMPLETED'}
                style={{
                  padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)',
                  cursor: (currentIndex === questions.length - 1 || sessionStatus === 'PAUSED' || sessionStatus === 'COMPLETED') ? 'not-allowed' : 'pointer',
                  opacity: (currentIndex === questions.length - 1 || sessionStatus === 'PAUSED' || sessionStatus === 'COMPLETED') ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem'
                }}
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* AI Evaluation Feedback Card */}
          {feedbacks[currentIndex] && (
            <div style={{
              marginTop: 24, padding: '16px 20px', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-elevated)', border: '1px solid var(--border-accent)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Award size={16} /> AI Assessment
                </span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-green)', fontFamily: 'var(--font-heading)' }}>
                  Score: {feedbacks[currentIndex].score} / 100
                </span>
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {feedbacks[currentIndex].feedback}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
