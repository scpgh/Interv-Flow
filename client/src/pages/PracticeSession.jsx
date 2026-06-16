import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import DashboardNavbar from '../components/DashboardNavbar';
import Footer from '../components/Footer';
import AudioWaveform from '../components/AudioWaveform';

// Helper to format voice display names cleanly for dropdown selector
const formatVoiceName = (voice) => {
  let rawName = voice.name;
  
  // Strip Microsoft prefix and common extra qualifiers
  let cleanName = rawName.replace(/^Microsoft\s+/i, '');
  cleanName = cleanName.split('-')[0].trim();
  cleanName = cleanName.replace(/\s+online\s+\(natural\)/i, '');
  cleanName = cleanName.replace(/\s+online/i, '');
  cleanName = cleanName.replace(/\(natural\)/i, '');
  
  // Clean up "Google US English" -> "Google US", etc.
  cleanName = cleanName.replace(/\s+us\s+english/i, ' US').replace(/\s+uk\s+english/i, ' UK').trim();
  
  // Determine locale tag
  let loc = 'English';
  const langLower = voice.lang.toLowerCase();
  if (langLower.includes('us')) loc = 'US English';
  else if (langLower.includes('gb') || langLower.includes('uk')) loc = 'UK English';
  else if (langLower.includes('in')) loc = 'IN English';
  else if (langLower.includes('au')) loc = 'AU English';
  else if (langLower.includes('ca')) loc = 'CA English';

  const type = !voice.localService ? 'Online' : 'Local';
  return `${cleanName} - ${loc} (${type})`;
};

export default function PracticeSession() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeNavTab, setActiveNavTab] = useState("practice");

  // 1. Wizard Setup State
  const [step, setStep] = useState('setup'); // 'setup' | 'connecting' | 'active' | 'finished'
  const [mode, setMode] = useState('jd'); // 'jd' | 'resume'
  const [jobTitle, setJobTitle] = useState('Software Engineer');
  const [company, setCompany] = useState('Google');
  const [jdText, setJdText] = useState('');
  const [resumeText, setResumeText] = useState(sessionStorage.getItem('userResumeText') || '');
  const [duration, setDuration] = useState(15); // minutes
  const [errorMsg, setErrorMsg] = useState('');

  // 2. Active Session Telemetry State
  const [sessionId, setSessionId] = useState('');
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [interviewerState, setInterviewerState] = useState('listening'); // 'listening' | 'speaking' | 'thinking'
  const [wpm, setWpm] = useState(0);
  const [fillerCount, setFillerCount] = useState(0);
  const [hesitationCount, setHesitationCount] = useState(0);
  const [transcript, setTranscript] = useState([]);
  const [isFallbackMode, setIsFallbackMode] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [speechWarning, setSpeechWarning] = useState('');
  
  // Custom Voice & Focus states
  const [voices, setVoices] = useState([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [useManualRecorder, setUseManualRecorder] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);

  // Load passed challenge state if redirected from Community / Try Challenge
  useEffect(() => {
    if (location.state) {
      if (location.state.mode) {
        setMode(location.state.mode);
      }
      if (location.state.jobTitle) {
        setJobTitle(location.state.jobTitle);
      }
      if (location.state.jdText) {
        setJdText(location.state.jdText);
      }
      if (location.state.company) {
        setCompany(location.state.company);
      }
      // Clean up location state in history to avoid re-triggering on fresh reloads
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // 3. Audio & WebSocket Refs
  const audioContextRef = useRef(null);
  const microphoneStreamRef = useRef(null);
  const workletNodeRef = useRef(null);
  const micAnalyserRef = useRef(null);
  const speakerAnalyserRef = useRef(null);
  const socketRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);

  // Fallback Voice Mode Refs
  const speechRecognitionRef = useRef(null);
  const speechRecognitionFailedRef = useRef(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const currentUtteranceRef = useRef(null);
  const recognitionTimeoutRef = useRef(null);
  const lastFinalTranscriptRef = useRef('');
  const sourceNodeRef = useRef(null);
  const speakerGainNodeRef = useRef(null);
  const currentTurnTextAccumulated = useRef('');
  const typedAnswerRef = useRef('');

  // Telemetry Math Refs
  const userWordsCountRef = useRef(0);
  const userSpeakingSecondsRef = useRef(0);
  const silenceStartRef = useRef(null);
  const activeSessionRef = useRef(false);

  // Sync typedAnswer state with ref
  useEffect(() => {
    typedAnswerRef.current = typedAnswer;
  }, [typedAnswer]);

  // Load resume text and pre-load speechSynthesis voices if available
  useEffect(() => {
    const cachedResume = sessionStorage.getItem('userResumeText') || sessionStorage.getItem('extractedText');
    if (cachedResume) {
      setResumeText(cachedResume);
    }

    // Detect Brave Browser or lack of Web SpeechRecognition support
    const isBrave = typeof navigator.brave !== 'undefined' || (navigator.userAgent && navigator.userAgent.includes("Brave"));
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (isBrave || !SpeechRecognitionClass) {
      setUseManualRecorder(true);
      if (isBrave) {
        setSpeechWarning("Brave Browser detected: Built-in Web Speech API is blocked/disabled by default. Local audio recording fallback is enabled below.");
      } else {
        setSpeechWarning("Built-in Speech Recognition is unsupported in this browser. Local audio recording fallback is enabled below.");
      }
    }

    if (window.speechSynthesis) {
      const loadVoices = () => {
        const allVoices = window.speechSynthesis.getVoices();
        const englishVoices = allVoices.filter(v => v.lang.startsWith('en'));

        // Keep all high-quality online natural voices (e.g. Google or Edge Online Natural)
        const highQualityVoices = englishVoices.filter(v => {
          const nameLower = v.name.toLowerCase();
          
          // Exclude known local robotic voices
          if (nameLower.includes('desktop') || nameLower.includes('david') || nameLower.includes('zira') || nameLower.includes('hazel')) {
            return false;
          }

          // Keep all online voices (highly realistic neural engines) and Google voices
          const isOnline = !v.localService;
          const isGoogle = nameLower.includes('google');

          return isOnline || isGoogle;
        });

        // Fallback: If filtering removed all voices, use all english voices to avoid empty lists
        const finalVoices = highQualityVoices.length > 0 ? highQualityVoices : englishVoices;
        setVoices(finalVoices);

        if (finalVoices.length > 0) {
          const bestDefault = finalVoices.find(v => v.name.toLowerCase().includes('natural') && v.name.toLowerCase().includes('online')) ||
                              finalVoices.find(v => v.name.toLowerCase().includes('natural')) ||
                              finalVoices.find(v => v.name.toLowerCase().includes('google') && v.name.toLowerCase().includes('us')) ||
                              finalVoices.find(v => v.name.toLowerCase().includes('google')) ||
                              finalVoices[0];
          setSelectedVoiceName(localStorage.getItem('selectedVoiceName') || bestDefault.name);
        }
      };
      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }, []);

  // Format seconds to MM:SS
  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ── Helper: Convert ArrayBuffer to Base64 ──
  const arrayBufferToBase64 = (buffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  // ── Helper: Convert raw 24kHz 16-bit PCM to Float32Array ──
  const pcmToFloat32 = (arrayBuffer) => {
    const dataView = new DataView(arrayBuffer);
    const len = arrayBuffer.byteLength / 2;
    const float32 = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const int16 = dataView.getInt16(i * 2, true); // Little Endian
      float32[i] = int16 / (int16 < 0 ? 0x8000 : 0x7FFF);
    }
    return float32;
  };

  // ── Start Interview Logic ──
  const handleStartInterview = async () => {
    setErrorMsg('');
    setStep('connecting');

    try {
      // 1. Request Microphone Access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      microphoneStreamRef.current = stream;

      // 2. Initialize Web Audio API context
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      // 3. Setup Mic Analyser Node for Audio Waveform
      const micAnalyser = audioContext.createAnalyser();
      micAnalyser.fftSize = 256;
      micAnalyserRef.current = micAnalyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(micAnalyser);

      // 4. Setup Speaker Analyser and Gain Nodes
      const speakerAnalyser = audioContext.createAnalyser();
      speakerAnalyser.fftSize = 256;
      speakerAnalyserRef.current = speakerAnalyser;

      const speakerGain = audioContext.createGain();
      speakerGain.connect(speakerAnalyser);
      speakerAnalyser.connect(audioContext.destination);
      speakerGainNodeRef.current = speakerGain;

      // 5. Load AudioWorklet for downsampling
      await audioContext.audioWorklet.addModule('/audioProcessor.js');
      const workletNode = new AudioWorkletNode(audioContext, 'audio-processor');
      workletNodeRef.current = workletNode;

      source.connect(workletNode);
      // Connect to a silent destination to prevent hearing oneself
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;
      workletNode.connect(silentGain);
      silentGain.connect(audioContext.destination);

      // 6. Connect to backend WebSocket proxy
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//localhost:5000/api/interview/session`;
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log("WebSocket client connection opened to server gateway");
        
        // Send initial session setup parameters to server
        const setupPayload = {
          type: 'setup',
          mode: mode,
          jdText: mode === 'jd' ? jdText : '',
          resumeText: mode === 'resume' ? resumeText : '',
          jobTitle: jobTitle,
          company: company,
          duration: duration
        };
        socket.send(JSON.stringify(setupPayload));
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'session_created') {
            setSessionId(data.sessionId);
          } 
          
          else if (data.type === 'session_ready') {
            const fallback = !!data.isFallback;
            setIsFallbackMode(fallback);
            setStep('active');
            setTimeLeft(duration * 60);
            activeSessionRef.current = true;
            console.log(`Interview session initialized and active. Fallback Mode: ${fallback}`);
          } 

          else if (data.type === 'interviewer_thinking') {
            setInterviewerState('thinking');
          }

          else if (data.type === 'fallback_speech') {
            console.log("Received fallback interviewer speech text:", data.text);
            
            // Sync local transcript with server-side transcript
            if (data.transcript) {
              setTranscript(data.transcript);
            } else {
              updateTranscript('interviewer', data.text);
            }

            speakFallbackText(data.text);
          }
          
          else if (data.type === 'timer_expired') {
            handleCompleteSession();
          } 
          
          else if (data.serverContent) {
            // Check for model's audio speech outputs
            if (data.serverContent.modelTurn && data.serverContent.modelTurn.parts) {
              data.serverContent.modelTurn.parts.forEach(part => {
                // If it contains PCM audio, buffer it for queue playback
                if (part.inlineData && part.inlineData.data) {
                  const base64Audio = part.inlineData.data;
                  const binaryString = window.atob(base64Audio);
                  const len = binaryString.length;
                  const bytes = new Uint8Array(len);
                  for (let i = 0; i < len; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                  }
                  
                  // Push the array buffer into the speaker queue
                  audioQueueRef.current.push(bytes.buffer);
                  playSpeakerQueue();
                }

                // If it contains transcription text
                if (part.text) {
                  setInterviewerState('speaking');
                  updateTranscript('interviewer', part.text);
                }
              });
            }

            // Check for user's transcription text (real-time from Gemini)
            if (data.serverContent.userTurn && data.serverContent.userTurn.parts) {
              data.serverContent.userTurn.parts.forEach(part => {
                if (part.text) {
                  setInterviewerState('listening');
                  updateTranscript('candidate', part.text);
                  
                  // Increment words and check for filler words
                  const words = part.text.split(/\s+/).filter(Boolean);
                  userWordsCountRef.current += words.length;
                  
                  // Scanner for filler words
                  const fillerMatches = part.text.toLowerCase().match(/\b(um|uh|like|you\s+know|so|actually)\b/g) || [];
                  setFillerCount(prev => prev + fillerMatches.length);
                }
              });
            }

            if (data.serverContent.turnComplete) {
              setInterviewerState('listening');
            }
          }
        } catch (e) {
          // If the socket message is binary audio frames (if backed by binary websocket frames)
          console.error("Failed to parse websocket JSON message:", e);
        }
      };

      socket.onclose = () => {
        console.log("WebSocket connection closed cleanly.");
        if (activeSessionRef.current) {
          handleCompleteSession();
        }
      };

      socket.onerror = (err) => {
        console.error("WebSocket client error:", err);
        setErrorMsg("WebSocket connection error. Make sure the server is online.");
        setStep('setup');
      };

      // 7. Pipe Worklet Audio Chunks to Socket
      workletNode.port.onmessage = (event) => {
        if (event.data.event === 'audio_chunk' && socketRef.current) {
          const ws = socketRef.current;
          if (ws.readyState === WebSocket.OPEN && activeSessionRef.current && !isMuted && !isPaused && interviewerState === 'listening') {
            const pcmBuffer = event.data.pcm;
            const base64Audio = arrayBufferToBase64(pcmBuffer);
            
            const clientAudioPayload = {
              realtimeInput: {
                mediaChunks: [
                  {
                    mimeType: "audio/pcm",
                    data: base64Audio
                  }
                ]
              }
            };
            ws.send(JSON.stringify(clientAudioPayload));

            // Volume level calculations to track silence / hesitations

            if (micAnalyserRef.current) {
              const freqData = new Uint8Array(micAnalyserRef.current.frequencyBinCount);
              micAnalyserRef.current.getByteFrequencyData(freqData);
              const volumeSum = freqData.reduce((a, b) => a + b, 0);
              const avgVolume = volumeSum / freqData.length;

              if (avgVolume < 5) { // Threshold for silence
                if (silenceStartRef.current === null) {
                  silenceStartRef.current = Date.now();
                } else if (Date.now() - silenceStartRef.current > 1800) { // 1.8s of silence
                  setHesitationCount(prev => prev + 1);
                  silenceStartRef.current = Date.now(); // reset timer
                }
              } else {
                silenceStartRef.current = null;
              }
            }
          }
        }
      };

    } catch (err) {
      console.error("Accessing media failed:", err);
      setErrorMsg("Failed to access microphone. Please verify site permissions.");
      setStep('setup');
    }
  };

  // ── Speaker Playback Scheduling Queue ──
  const playSpeakerQueue = async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0 || !audioContextRef.current) return;

    isPlayingRef.current = true;
    const audioContext = audioContextRef.current;
    
    // Get the next chunk from the queue
    const pcmData = audioQueueRef.current.shift();
    const floatData = pcmToFloat32(pcmData);

    // Create an AudioBuffer (24000Hz is Gemini Multimodal Live API response rate)
    const audioBuffer = audioContext.createBuffer(1, floatData.length, 24000);
    audioBuffer.copyToChannel(floatData, 0);

    const sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.connect(speakerGainNodeRef.current);
    sourceNodeRef.current = sourceNode;

    sourceNode.onended = () => {
      isPlayingRef.current = false;
      playSpeakerQueue(); // trigger next chunk in queue
    };

    sourceNode.start(0);
  };

  // ── Real-time Transcript State Compilation ──
  const updateTranscript = (sender, text) => {
    let newTranscript = [];
    setTranscript(prev => {
      const updated = [...prev];
      const len = updated.length;
      
      // If the last message was from the same sender, append to it
      if (len > 0 && updated[len - 1].sender === sender) {
        updated[len - 1].text += ' ' + text;
      } else {
        updated.push({ sender, text, timestamp: Date.now() });
      }
      newTranscript = updated;
      return updated;
    });

    // Sync updated transcript to WebSocket if open (outside state setter callback)
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'transcript_update',
        transcript: newTranscript
      }));
    }
  };

  // ── Fallback Voice Mode: TTS using Speech Synthesis ──
  const speakFallbackText = (text) => {
    if (!window.speechSynthesis) {
      console.warn("Speech synthesis not supported in this browser.");
      setInterviewerState('listening');
      return;
    }

    // Cancel any ongoing speaking
    window.speechSynthesis.cancel();

    // Remove any markdown or special characters before speaking
    const cleanText = text.replace(/[*#`_\-]/g, '').trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    currentUtteranceRef.current = utterance;

    // Use selected voice from state
    const voice = voices.find(v => v.name === selectedVoiceName);
    if (voice) {
      utterance.voice = voice;
      // If it's a local/offline voice, slow down the rate to make it sound less robotic and more natural
      if (voice.localService) {
        utterance.rate = 0.90; // Slower, more readable pacing for offline engines
      } else {
        utterance.rate = 0.95; // Natural pacing for online/cloud engines
      }
    } else {
      utterance.rate = 0.90;
    }

    utterance.onstart = () => {
      setInterviewerState('speaking');
    };

    utterance.onend = () => {
      currentUtteranceRef.current = null;
      setInterviewerState('listening');
    };

    utterance.onerror = (err) => {
      console.error("Speech synthesis utterance error:", err);
      currentUtteranceRef.current = null;
      setInterviewerState('listening');
    };

    window.speechSynthesis.speak(utterance);
  };

  // ── Declarative Speech Recognition Controller ──
  useEffect(() => {
    // If using manual recording fallback (e.g. Brave) or permanent fail, do not launch browser STT
    if (step !== 'active' || isPaused || isMuted || interviewerState !== 'listening' || isInputFocused || speechRecognitionFailedRef.current || useManualRecorder) {
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.onend = null;
          speechRecognitionRef.current.abort();
        } catch (e) {}
        speechRecognitionRef.current = null;
      }
      return;
    }

    let lastError = null;
    let networkRetryCount = 0;
    let retryTimeoutId = null;

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      setSpeechWarning("Speech recognition is not supported in this browser. Please type your answers below or use recording backup.");
      setUseManualRecorder(true);
      return;
    }

    // Capture the baseline at the start of this listening turn
    const baseWords = userWordsCountRef.current;
    const baseFillers = fillerCount;
    currentTurnTextAccumulated.current = typedAnswerRef.current;
    let sessionFinalTranscript = '';

    console.log(`Starting Speech Recognition. Base words: ${baseWords}, Base fillers: ${baseFillers}, Accumulated Turn Text: "${currentTurnTextAccumulated.current}"`);
    
    const recognition = new SpeechRecognitionClass();
    speechRecognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      if (lastError !== 'no-speech') {
        console.log("Speech recognition session started.");
      }
    };

    recognition.onresult = (event) => {
      if (isMuted || isPaused) return;

      let interimTranscript = '';
      let localFinalTranscript = '';

      for (let i = 0; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          localFinalTranscript += event.results[i][0].transcript + ' ';
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      // Save this session's final transcript to use in onend
      sessionFinalTranscript = localFinalTranscript;

      const currentSessionTranscript = (localFinalTranscript + interimTranscript).trim();
      const totalTurnTranscript = (currentTurnTextAccumulated.current + " " + currentSessionTranscript).trim();

      setTypedAnswer(totalTurnTranscript);

      // Calculate filler words for this turn and add to baseline
      const fillerMatches = totalTurnTranscript.toLowerCase().match(/\b(um|uh|like|you\s+know|so|actually)\b/g) || [];
      setFillerCount(baseFillers + fillerMatches.length);

      // Track word count for WPM
      const words = totalTurnTranscript.split(/\s+/).filter(Boolean);
      userWordsCountRef.current = baseWords + words.length;

      // Update transcript locally
      let newTranscript = [];
      setTranscript(prev => {
        const updated = [...prev];
        const len = updated.length;
        if (len > 0 && updated[len - 1].sender === 'candidate') {
          updated[len - 1].text = totalTurnTranscript;
        } else {
          updated.push({
            sender: 'candidate',
            text: totalTurnTranscript,
            timestamp: Date.now()
          });
        }
        newTranscript = updated;
        return updated;
      });

      // Sync local transcript to WebSocket if open (outside state setter)
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: 'transcript_update',
          transcript: newTranscript
        }));
      }

      // Reset / slide silence timer for hesitation & completion detection
      if (recognitionTimeoutRef.current) {
        clearTimeout(recognitionTimeoutRef.current);
      }

      // Automatically submit response in fallback mode ONLY if candidate is silent for 3.5 seconds
      if (isFallbackMode) {
        recognitionTimeoutRef.current = setTimeout(() => {
          if (totalTurnTranscript.length > 0) {
            console.log("Auto-submitting candidate response due to 3.5s silence.");
            sendUserResponse(totalTurnTranscript);
          }
        }, 3500);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') {
        lastError = event.error;
        return;
      }
      
      console.error("Speech recognition error event:", event.error);
      lastError = event.error;
      
      if (event.error === 'not-allowed') {
        setSpeechWarning("Microphone access blocked for Speech Recognition. Check site settings.");
      } else if (event.error === 'audio-capture') {
        setSpeechWarning("Microphone is busy or not found.");
      } else if (event.error === 'aborted') {
        setSpeechWarning("Speech recognition was aborted by the browser. Enabling local recording backup below.");
        setUseManualRecorder(true);
      } else if (event.error === 'network') {
        const isBrave = typeof navigator.brave !== 'undefined' || (navigator.userAgent && navigator.userAgent.includes("Brave"));
        if (isBrave) {
          setSpeechWarning("Brave disables Google Speech API by default. Switch to Google Chrome or Microsoft Edge, or type your answers.");
        } else {
          setSpeechWarning("Speech recognition network error. Ensure cloud speech engines are supported (Edge/Chrome recommended), or check connection.");
        }
      } else {
        setSpeechWarning(`Speech recognition error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      if (lastError !== 'no-speech') {
        console.log("Speech recognition session ended. Last error:", lastError);
      }

      // Save the final transcript of this session into the accumulator
      currentTurnTextAccumulated.current = (currentTurnTextAccumulated.current + " " + sessionFinalTranscript).trim();

      // Auto-restart if we should still be listening
      if (activeSessionRef.current && interviewerState === 'listening' && !isMuted && !isPaused && !isInputFocused) {
        if (lastError === 'not-allowed' || lastError === 'audio-capture' || lastError === 'service-not-allowed') {
          console.log("Stopping speech recognition auto-restart due to fatal error:", lastError);
          return;
        }

        if (lastError === 'aborted') {
          speechRecognitionFailedRef.current = true;
          setUseManualRecorder(true);
          setSpeechWarning("Speech recognition was aborted by the browser. Please use the 'Record Voice' button below or type.");
          console.log("Speech recognition aborted. Switching to manual recording fallback.");
          return;
        }

        if (lastError === 'network') {
          if (networkRetryCount < 3) {
            networkRetryCount++;
            console.log(`Scheduling speech recognition restart in 5 seconds due to network error (attempt ${networkRetryCount}/3)...`);
            retryTimeoutId = setTimeout(() => {
              if (activeSessionRef.current && interviewerState === 'listening' && !isMuted && !isPaused && !isInputFocused) {
                console.log("Auto-restarting speech recognition after network error...");
                try {
                  lastError = null;
                  recognition.start();
                } catch (err) {
                  console.error("Failed to restart speech recognition after network error:", err);
                }
              }
            }, 5000);
          } else {
            speechRecognitionFailedRef.current = true;
            setUseManualRecorder(true);
            setSpeechWarning("Speech recognition unavailable due to persistent network/compatibility issues. Edge or Chrome are recommended. Please type your answers or record below.");
            console.log("Max network retries reached. Stopping speech recognition auto-restart.");
          }
          return;
        }

        if (lastError === 'no-speech') {
          // Restart silently with a minor delay (500ms) to avoid high frequency looping
          retryTimeoutId = setTimeout(() => {
            if (activeSessionRef.current && interviewerState === 'listening' && !isMuted && !isPaused && !isInputFocused) {
              try {
                lastError = null;
                recognition.start();
              } catch (err) {}
            }
          }, 500);
          return;
        }

        console.log("Auto-restarting speech recognition...");
        try {
          lastError = null;
          recognition.start();
        } catch (err) {
          console.error("Failed to restart speech recognition:", err);
        }
      }
    };

    try {
      recognition.start();
    } catch (err) {
      console.error("Error starting speech recognition:", err);
    }

    return () => {
      clearInterval(secondsTimer);
      if (recognitionTimeoutRef.current) {
        clearTimeout(recognitionTimeoutRef.current);
      }
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId);
      }
      try {
        recognition.onend = null;
        recognition.abort();
      } catch (e) {}
    };
  }, [step, isPaused, isMuted, interviewerState, isFallbackMode, isInputFocused, useManualRecorder]);

  // ── Local Audio Recording Fallback using MediaRecorder ──
  const startAudioRecording = () => {
    if (!microphoneStreamRef.current) return;
    audioChunksRef.current = [];
    
    // Choose appropriate mime type supported by the browser
    let mimeType = 'audio/webm';
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      mimeType = 'audio/webm;codecs=opus';
    } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
      mimeType = 'audio/ogg;codecs=opus';
    } else if (MediaRecorder.isTypeSupported('audio/wav')) {
      mimeType = 'audio/wav';
    }

    try {
      const mediaRecorder = new MediaRecorder(microphoneStreamRef.current, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size < 100) {
          console.warn("Recorded audio blob is too small.");
          return;
        }

        setIsRecordingAudio(false);
        setInterviewerState('thinking');

        const formData = new FormData();
        formData.append('audio', audioBlob, `recording.${mimeType.split('/')[1].split(';')[0]}`);

        try {
          const response = await fetch('http://localhost:5000/api/interview/transcribe', {
            method: 'POST',
            body: formData
          });
          const result = await response.json();
          if (result.success && result.text && result.text.trim()) {
            console.log("Uploaded fallback audio transcription result:", result.text);
            sendUserResponse(result.text);
          } else {
            console.warn("Transcription was empty or failed.");
            setInterviewerState('listening');
          }
        } catch (err) {
          console.error("Error sending audio to transcription API:", err);
          setInterviewerState('listening');
        }
      };

      mediaRecorder.start();
      setIsRecordingAudio(true);
    } catch (e) {
      console.error("Failed to start MediaRecorder:", e);
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  // ── Fallback Voice Mode: Send user response to server ──
  const sendUserResponse = (text) => {
    if (!text || text.trim().length === 0) return;

    if (recognitionTimeoutRef.current) {
      clearTimeout(recognitionTimeoutRef.current);
      recognitionTimeoutRef.current = null;
    }

    setInterviewerState('thinking');
    setTypedAnswer(''); // clear input box
    currentTurnTextAccumulated.current = '';

    // Update global state and sync socket
    let newTranscript = [];
    setTranscript(prev => {
      const updated = [...prev];
      const len = updated.length;
      if (len > 0 && updated[len - 1].sender === 'candidate') {
        updated[len - 1].text = text.trim();
      } else {
        updated.push({
          sender: 'candidate',
          text: text.trim(),
          timestamp: Date.now()
        });
      }
      newTranscript = updated;
      return updated;
    });

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      if (isFallbackMode) {
        socketRef.current.send(JSON.stringify({
          type: 'user_response',
          text: text.trim()
        }));
      } else {
        socketRef.current.send(JSON.stringify({
          realtimeInput: {
            text: text.trim()
          }
        }));
      }
    }
  };

  const handleSendTypedAnswer = () => {
    if (typedAnswer.trim() && interviewerState === 'listening') {
      sendUserResponse(typedAnswer.trim());
    }
  };

  // Calculate WPM dynamically during session
  useEffect(() => {
    if (step !== 'active') return;

    const wpmInterval = setInterval(() => {
      const minutesSpoken = userSpeakingSecondsRef.current / 60;
      if (minutesSpoken > 0) {
        const calculatedWpm = Math.round(userWordsCountRef.current / minutesSpoken);
        setWpm(Math.min(calculatedWpm, 280)); // Limit unreasonable peaks
      }
    }, 3000);

    return () => clearInterval(wpmInterval);
  }, [step]);

  // Recalculate candidate words count and filler count dynamically whenever transcript updates
  useEffect(() => {
    const candidateTurnsText = transcript
      .filter(item => item.sender === 'candidate')
      .map(item => item.text)
      .join(' ');

    const words = candidateTurnsText.split(/\s+/).filter(Boolean);
    userWordsCountRef.current = words.length;

    // Match filler words: um, uh, like, you know, so, actually, basically
    const fillerMatches = candidateTurnsText.toLowerCase().match(/\b(um|uh|like|you\s+know|so|actually|basically)\b/g) || [];
    setFillerCount(fillerMatches.length);
  }, [transcript]);

  // Dynamic Speaking Seconds Timer (active during candidate's turn)
  useEffect(() => {
    if (step !== 'active' || isPaused || isMuted || interviewerState !== 'listening') return;

    const timer = setInterval(() => {
      userSpeakingSecondsRef.current += 1;
    }, 1000);

    return () => clearInterval(timer);
  }, [step, isPaused, isMuted, interviewerState]);

  // Duration Timer Countdown
  useEffect(() => {
    if (step !== 'active' || isPaused) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [step, isPaused]);

  // Handle completion when countdown timer runs out
  useEffect(() => {
    if (step === 'active' && timeLeft === 0) {
      handleCompleteSession();
    }
  }, [timeLeft, step]);

  // ── Session Teardown & Redirect to Feedback Report ──
  const handleCompleteSession = async () => {
    activeSessionRef.current = false;
    setStep('finished');

    // Stop Web Speech Synthesis & Recognition if active
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.onend = null;
        speechRecognitionRef.current.stop();
      } catch (e) {}
    }
    if (recognitionTimeoutRef.current) {
      clearTimeout(recognitionTimeoutRef.current);
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (e) {}
    }

    // 1. Stop all microphone stream tracks
    if (microphoneStreamRef.current) {
      microphoneStreamRef.current.getTracks().forEach(track => track.stop());
    }

    // 2. Shut down Web Audio pipeline
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch (e) {}
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close().catch(e => console.error("Error closing AudioContext:", e));
      } catch (e) {
        console.error("AudioContext close exception:", e);
      }
    }

    // 3. Clear timers
    clearTimeout(silenceStartRef.current);

    // 4. Close WebSocket Connection cleanly
    const finalSessionId = sessionId;
    if (socketRef.current) {
      socketRef.current.close();
    }

    // Redirect to the feedback panel with sessionId
    if (finalSessionId) {
      console.log(`Redirecting candidate to evaluation panel: /practice/feedback/${finalSessionId}`);
      navigate(`/practice/feedback/${finalSessionId}`);
    } else {
      navigate('/dashboard');
    }
  };

  const handleToggleMute = () => {
    setIsMuted(prev => !prev);
  };

  const handleTogglePause = () => {
    const nextPaused = !isPaused;
    setIsPaused(nextPaused);

    if (audioContextRef.current) {
      if (nextPaused) {
        audioContextRef.current.suspend();
      } else {
        audioContextRef.current.resume();
      }
    }

    if (nextPaused) {
      // Pause Speech Synthesis if speaking
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
      }
    } else {
      // Resume Speech Synthesis if paused
      if (window.speechSynthesis && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    }
  };

  return (
    <div className="bg-[#09090b] text-[#e5e1e4] min-h-screen flex flex-col relative overflow-x-hidden pt-16 font-body-md text-left">
      <div className="fixed inset-0 pointer-events-none z-0 bg-radial-gradient"></div>

      <DashboardNavbar activeTab={activeNavTab} setActiveTab={setActiveNavTab} />

      {/* Main Container */}
      <div className="flex-grow flex items-center justify-center p-margin-mobile md:p-margin-desktop relative z-10 my-4">
        
        {/* STEP 1: CONFIGURATION SETUPS */}
        {step === 'setup' && (
          <div className="glass-card w-full max-w-2xl rounded-2xl p-8 md:p-10 flex flex-col gap-6 bg-[#18181b]/35 border border-white/10 shadow-2xl relative">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-2">
                <span className="material-symbols-outlined text-[16px] text-primary">keyboard_voice</span>
                <span className="text-[10px] text-primary uppercase tracking-widest font-mono font-bold font-semibold">AI Voice Simulator</span>
              </div>
              <h2 className="font-headline-lg text-headline-lg text-white font-bold tracking-tight">Configure Practice Session</h2>
              <p className="text-xs text-on-surface-variant max-w-md mx-auto leading-relaxed">
                Connect your microphone and launch a real-time, low-latency mock interview. Select a focus mode below.
              </p>
            </div>

            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-xs font-mono flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">error</span>
                {errorMsg}
              </div>
            )}

            <div className="space-y-6">
              {/* Select Focus Mode */}
              <div className="flex bg-[#131315]/80 p-1 rounded-full border border-white/5 relative z-10 w-fit mx-auto">
                <button 
                  onClick={() => setMode('jd')}
                  className={`px-6 py-2.5 rounded-full font-label-md text-xs font-bold transition-all duration-200 cursor-pointer ${mode === 'jd' ? 'bg-[#1E1B4B] text-[#818CF8] shadow-[0_0_15px_rgba(129,140,248,0.25)] border border-[#818cf8]/20' : 'text-on-surface-variant hover:text-white border border-transparent'}`}
                >
                  💼 Job Description (JD) Mode
                </button>
                <button 
                  onClick={() => setMode('resume')}
                  className={`px-6 py-2.5 rounded-full font-label-md text-xs font-bold transition-all duration-200 cursor-pointer ${mode === 'resume' ? 'bg-[#1E1B4B] text-[#818CF8] shadow-[0_0_15px_rgba(129,140,248,0.25)] border border-[#818cf8]/20' : 'text-on-surface-variant hover:text-white border border-transparent'}`}
                >
                  📁 Resume Cross-Exam Mode
                </button>
              </div>

              {/* JD Mode Fields */}
              {mode === 'jd' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="font-label-md text-label-md text-on-surface-variant block">Job Title</label>
                    <input 
                      type="text" 
                      className="w-full bg-black/20 border border-outline-variant rounded-lg px-4 py-3 text-xs text-white focus:outline-none focus:border-primary"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      placeholder="e.g. Senior Backend Engineer"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-label-md text-label-md text-on-surface-variant block">Target Company</label>
                    <input 
                      type="text" 
                      className="w-full bg-black/20 border border-outline-variant rounded-lg px-4 py-3 text-xs text-white focus:outline-none focus:border-primary"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="e.g. Stripe"
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="font-label-md text-label-md text-on-surface-variant block">Paste Job Description details</label>
                    <textarea 
                      className="w-full h-32 bg-black/20 border border-outline-variant rounded-lg p-4 text-xs text-white focus:outline-none focus:border-primary resize-none"
                      value={jdText}
                      onChange={(e) => setJdText(e.target.value)}
                      placeholder="Paste the target job description text here..."
                    />
                  </div>
                </div>
              )}

              {/* Resume Mode Fields */}
              {mode === 'resume' && (
                <div className="space-y-4 text-left">
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-primary">description</span>
                      Active Resume Context Loaded
                    </h4>
                    <p className="text-[10px] text-on-surface-variant leading-relaxed">
                      We will pull the text contents of your last uploaded resume. The AI interviewer will perform a deep behavioral and architectural audit of the stack, projects, and scopes in your document.
                    </p>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="font-label-md text-label-md text-on-surface-variant block">Review / Edit Resume Transcript</label>
                    <textarea 
                      className="w-full h-36 bg-black/20 border border-outline-variant rounded-lg p-4 text-xs text-white focus:outline-none focus:border-primary resize-none font-mono"
                      value={resumeText}
                      onChange={(e) => setResumeText(e.target.value)}
                      placeholder="Or paste your complete resume text profile here..."
                    />
                  </div>
                </div>
              )}

              {/* Select Interviewer Voice */}
              <div className="space-y-2 text-left border-t border-white/5 pt-4">
                <label className="font-label-md text-label-md text-on-surface-variant block">🎙️ Select AI Interviewer Voice (Fallback Assistant)</label>
                <div className="flex gap-3">
                  <select 
                    className="flex-grow bg-black/20 border border-outline-variant rounded-lg px-4 py-3 text-xs text-white focus:outline-none focus:border-primary cursor-pointer"
                    value={selectedVoiceName}
                    onChange={(e) => {
                      setSelectedVoiceName(e.target.value);
                      localStorage.setItem('selectedVoiceName', e.target.value);
                    }}
                  >
                    {voices.length === 0 ? (
                      <option value="" className="bg-[#131315]">Default Browser Voice</option>
                    ) : (
                      voices.map(v => (
                        <option key={v.name} value={v.name} className="bg-[#131315]">
                          {formatVoiceName(v)}
                        </option>
                      ))
                    )}
                  </select>
                  
                  <button
                    type="button"
                    onClick={() => {
                      if (!window.speechSynthesis) return;
                      window.speechSynthesis.cancel();
                      const utterance = new SpeechSynthesisUtterance("Hi there! I am your AI interviewer. How does my voice sound to you?");
                      const voice = voices.find(v => v.name === selectedVoiceName);
                      if (voice) {
                        utterance.voice = voice;
                        if (voice.localService) {
                          utterance.rate = 0.90;
                        } else {
                          utterance.rate = 0.95;
                        }
                      } else {
                        utterance.rate = 0.90;
                      }
                      window.speechSynthesis.speak(utterance);
                    }}
                    className="px-4 py-3 rounded-lg text-xs font-bold text-[#818CF8] bg-[#1E1B4B]/50 hover:bg-[#1E1B4B] border border-[#818CF8]/30 transition-all cursor-pointer flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                    Preview
                  </button>
                </div>
              </div>

              {/* Settings and Trigger */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-5 pt-4 border-t border-white/5">
                <div className="flex items-center gap-3 w-full sm:w-auto text-left">
                  <span className="material-symbols-outlined text-primary text-xl">timer</span>
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-on-surface-variant block uppercase tracking-wider font-mono">Session Limit</label>
                    <select 
                      className="bg-transparent border-none text-xs text-white focus:outline-none font-bold cursor-pointer"
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                    >
                      <option className="bg-[#131315]" value="10">10 Minutes</option>
                      <option className="bg-[#131315]" value="15">15 Minutes</option>
                      <option className="bg-[#131315]" value="20">20 Minutes</option>
                      <option className="bg-[#131315]" value="30">30 Minutes</option>
                      <option className="bg-[#131315]" value="45">45 Minutes</option>
                      <option className="bg-[#131315]" value="60">60 Minutes (1 Hour)</option>
                      <option className="bg-[#131315]" value="75">75 Minutes (1 Hr 15 Min)</option>
                      <option className="bg-[#131315]" value="90">90 Minutes (1 Hr 30 Min)</option>
                      <option className="bg-[#131315]" value="105">105 Minutes (1 Hr 45 Min)</option>
                    </select>
                  </div>
                </div>

                <button 
                  onClick={handleStartInterview}
                  className="w-full sm:w-auto btn-primary px-8 py-4 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 border-none cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">mic</span>
                  Connect & Start Interview
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: CONNECTING / LOADING STATE */}
        {step === 'connecting' && (
          <div className="glass-card w-full max-w-md rounded-2xl p-8 flex flex-col items-center justify-center gap-6 text-center bg-[#18181b]/35 border border-white/10 shadow-2xl">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-primary border-t-transparent animate-spin flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-2xl">settings_voice</span>
            </div>
            <div className="space-y-1">
              <h3 className="font-headline-md text-headline-md text-white font-bold">Initializing Voice Proxy</h3>
              <p className="text-xs text-on-surface-variant">Allocating secure backend websocket gateway and connecting to Google Gemini Live API...</p>
            </div>
          </div>
        )}

        {/* STEP 3: ACTIVE MOCK INTERVIEW CONSOLE */}
        {step === 'active' && (
          <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-3 gap-6 relative items-stretch">
            
            {/* Visual Control and Waves Left Area */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              
              {/* Voice Interactive Console HUD */}
              <div className="glass-card rounded-2xl p-6 flex flex-col justify-between gap-6 bg-[#18181b]/40 border border-white/10 flex-grow">
                <div className="flex justify-between items-center border-b border-white/5 pb-4">
                  <div className="flex items-center gap-3">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Live Simulation</h3>
                        {isFallbackMode ? (
                          <span className="text-[9px] px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono font-semibold">Voice Assist (WebSpeech)</span>
                        ) : (
                          <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono font-semibold">Gemini Live API</span>
                        )}
                      </div>
                      <p className="text-[10px] text-on-surface-variant mt-0.5">
                        {mode === 'jd' ? `${jobTitle} @ ${company}` : "Resume Cross-Examination"}
                      </p>
                    </div>
                  </div>
                  
                  {/* Timer Display */}
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-lg border border-white/10 font-mono text-xs font-bold text-white">
                    <span className="material-symbols-outlined text-sm">schedule</span>
                    {formatTime(timeLeft)}
                  </div>
                </div>

                {/* Pulsating AI Avatar Core Visualizer */}
                <div className="flex flex-col items-center justify-center py-6 gap-6 flex-grow">
                  <div className={`w-28 h-28 rounded-full flex items-center justify-center border transition-all duration-300 relative ${
                    interviewerState === 'speaking' 
                      ? 'bg-rose-500/10 border-rose-500/40 shadow-[0_0_40px_rgba(244,63,94,0.2)] scale-105' 
                      : interviewerState === 'thinking' 
                      ? 'bg-amber-500/10 border-amber-500/40 shadow-[0_0_30px_rgba(245,158,11,0.2)] animate-pulse'
                      : 'bg-primary/10 border-primary/40 shadow-[0_0_30px_rgba(37,99,235,0.2)]'
                  }`}>
                    {/* Pulsing ring */}
                    <div className={`absolute inset-0 rounded-full border animate-[ping_2s_infinite] opacity-30 ${
                      interviewerState === 'speaking' ? 'border-rose-500' : 'border-primary'
                    }`}></div>
                    
                    <span className={`material-symbols-outlined text-5xl ${
                      interviewerState === 'speaking' ? 'text-rose-400' : interviewerState === 'thinking' ? 'text-amber-400' : 'text-primary'
                    }`}>
                      {interviewerState === 'speaking' ? 'record_voice_over' : interviewerState === 'thinking' ? 'hourglass_empty' : 'graphic_eq'}
                    </span>
                  </div>

                  <div className="text-center space-y-1">
                    <h4 className="text-xs font-bold text-white capitalize font-mono tracking-wider">
                      Interviewer Status: {interviewerState}
                    </h4>
                    <p className="text-[10px] text-on-surface-variant">
                      {isFallbackMode 
                        ? (interviewerState === 'speaking' 
                            ? "Interviewer is speaking..." 
                            : interviewerState === 'thinking' 
                            ? "AI is formulating the next question..." 
                            : "Listening... Speak clearly. Tap 'Finish Answer' when done.")
                        : (interviewerState === 'speaking' 
                            ? "Gemini is replying... (Speak anytime to interrupt)"
                            : interviewerState === 'thinking'
                            ? "Calibrating answer models..."
                            : "Listening... Speak clearly into your microphone.")}
                    </p>
                  </div>
                </div>

                {/* Overlapping Waves Canvas visualizer */}
                <AudioWaveform 
                  analyser={interviewerState === 'speaking' ? speakerAnalyserRef.current : micAnalyserRef.current}
                  isActive={step === 'active' && !isPaused}
                  mode={interviewerState === 'speaking' ? 'speaking' : 'listening'}
                />

                {/* Speech recognition warning if browser unsupported */}
                {speechWarning && (
                  <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-3 rounded-xl text-[10px] font-mono flex items-center gap-2 mt-4 w-full">
                    <span className="material-symbols-outlined text-xs">warning</span>
                    {speechWarning}
                  </div>
                )}

                {/* Typed Answer Input Box */}
                <div className="flex gap-3 w-full mt-4 items-center flex-wrap sm:flex-nowrap">
                  <input 
                    type="text"
                    placeholder={interviewerState === 'listening' ? "Review transcribed answer or type here..." : "Wait for the interviewer to finish..."}
                    disabled={interviewerState !== 'listening'}
                    value={typedAnswer}
                    onChange={(e) => setTypedAnswer(e.target.value)}
                    onFocus={() => setIsInputFocused(true)}
                    onBlur={() => {
                      setTimeout(() => setIsInputFocused(false), 200);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && interviewerState === 'listening') {
                        handleSendTypedAnswer();
                      }
                    }}
                    className="flex-grow bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-primary disabled:opacity-40"
                  />

                  {useManualRecorder && interviewerState === 'listening' && (
                    <button
                      onClick={isRecordingAudio ? stopAudioRecording : startAudioRecording}
                      className={`px-5 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                        isRecordingAudio 
                          ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse' 
                          : 'bg-[#1E1B4B]/60 text-[#818CF8] border-[#818CF8]/30 hover:bg-[#1E1B4B]'
                      }`}
                      title={isRecordingAudio ? "Stop recording & submit" : "Record audio response"}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {isRecordingAudio ? 'mic_off' : 'mic'}
                      </span>
                      {isRecordingAudio ? 'Stop' : 'Record Voice'}
                    </button>
                  )}

                  <button
                    onClick={handleSendTypedAnswer}
                    disabled={interviewerState !== 'listening' || !typedAnswer.trim()}
                    className="px-6 py-3 rounded-xl text-xs font-bold text-white bg-[#1E1B4B] hover:bg-[#1E1B4B]/80 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 border border-[#818CF8]/30"
                  >
                    <span className="material-symbols-outlined text-[16px]">send</span>
                    Send
                  </button>
                </div>

                {/* Console Control Buttons */}
                <div className="flex justify-center items-center gap-4 border-t border-white/5 pt-4 flex-wrap">
                  {/* Mute Button */}
                  <button 
                    onClick={handleToggleMute}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${
                      isMuted 
                        ? 'bg-red-500/15 border-red-500/40 text-red-400' 
                        : 'bg-white/5 border-white/10 text-on-surface-variant hover:text-white'
                    }`}
                    title={isMuted ? "Unmute Mic" : "Mute Mic"}
                  >
                    <span className="material-symbols-outlined text-xl">
                      {isMuted ? 'mic_off' : 'mic'}
                    </span>
                  </button>

                  {/* Pause Button */}
                  <button 
                    onClick={handleTogglePause}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${
                      isPaused 
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-400' 
                        : 'bg-white/5 border-white/10 text-on-surface-variant hover:text-white'
                    }`}
                    title={isPaused ? "Resume Session" : "Pause Session"}
                  >
                    <span className="material-symbols-outlined text-xl">
                      {isPaused ? 'play_arrow' : 'pause'}
                    </span>
                  </button>

                  {/* Manual Finish Answer Button in Fallback Mode */}
                  {isFallbackMode && interviewerState === 'listening' && (
                    <button 
                      onClick={() => {
                        const currentSpokenText = transcript.length > 0 && transcript[transcript.length - 1].sender === 'candidate' 
                          ? transcript[transcript.length - 1].text 
                          : '';
                        if (currentSpokenText && currentSpokenText.trim().length > 0) {
                          sendUserResponse(currentSpokenText);
                        }
                      }}
                      className="px-5 py-3 rounded-xl text-xs font-bold text-[#818CF8] bg-[#1E1B4B]/80 hover:bg-[#1E1B4B] border border-[#818CF8]/30 hover:border-[#818CF8]/50 transition-all cursor-pointer flex items-center gap-1.5"
                      title="Submit answer immediately"
                    >
                      <span className="material-symbols-outlined text-[16px]">send</span>
                      Finish Answer
                    </button>
                  )}

                  {/* Complete Session Button */}
                  <button 
                    onClick={handleCompleteSession}
                    className="btn-primary px-8 py-3 rounded-xl text-xs font-bold text-white flex items-center gap-2 border-none cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">call_end</span>
                    End & Evaluate
                  </button>
                </div>
              </div>
            </div>

            {/* Sidebar Metrics and Realtime Transcript Panel */}
            <div className="lg:col-span-1 flex flex-col gap-6">
              
              {/* Telemetry Dashboard Stats */}
              <div className="glass-card rounded-2xl p-5 flex flex-col gap-4 bg-[#18181b]/35 border border-white/10">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Live Speech Telemetry</h4>
                
                <div className="grid grid-cols-3 lg:grid-cols-1 gap-4">
                  {/* WPM */}
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary text-lg">speed</span>
                    <div>
                      <span className="text-[10px] text-on-surface-variant block uppercase tracking-wider font-mono">Speaking WPM</span>
                      <span className="text-sm font-bold text-white font-mono">{wpm || '--'}</span>
                    </div>
                  </div>

                  {/* Filler words */}
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-3">
                    <span className="material-symbols-outlined text-rose-400 text-lg">sms_failed</span>
                    <div>
                      <span className="text-[10px] text-on-surface-variant block uppercase tracking-wider font-mono">Fillers Count</span>
                      <span className="text-sm font-bold text-rose-400 font-mono">{fillerCount}</span>
                    </div>
                  </div>

                  {/* Hesitations */}
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-3">
                    <span className="material-symbols-outlined text-amber-400 text-lg">pause_circle</span>
                    <div>
                      <span className="text-[10px] text-on-surface-variant block uppercase tracking-wider font-mono">Hesitations</span>
                      <span className="text-sm font-bold text-amber-400 font-mono">{hesitationCount}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Running Transcript Logger Box */}
              <div className="glass-card rounded-2xl p-5 flex flex-col bg-[#18181b]/35 border border-white/10 flex-grow h-[260px] lg:h-[350px]">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono mb-3">Live Transcript</h4>
                
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar text-xs">
                  {transcript.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-center text-[10px] text-on-surface-variant p-4">
                      No speech recorded yet. Tap start and speak.
                    </div>
                  ) : (
                    transcript.map((item, idx) => (
                      <div 
                        key={idx} 
                        className={`p-3 rounded-xl leading-relaxed text-left border ${
                          item.sender === 'candidate' 
                            ? 'bg-[#1E1B4B]/30 border-[#818CF8]/25 ml-4' 
                            : 'bg-white/[0.02] border-white/5 mr-4'
                        }`}
                      >
                        <span className={`block text-[9px] font-mono font-bold uppercase mb-1 ${
                          item.sender === 'candidate' ? 'text-[#818CF8]' : 'text-primary'
                        }`}>
                          {item.sender === 'candidate' ? 'You (Candidate)' : 'Interviewer (Gemini)'}
                        </span>
                        <p className="text-white/90">{item.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* STEP 4: GENERATING REPORT STAGE */}
        {step === 'finished' && (
          <div className="glass-card w-full max-w-md rounded-2xl p-8 flex flex-col items-center justify-center gap-6 text-center bg-[#18181b]/35 border border-white/10 shadow-2xl">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-tertiary border-t-transparent animate-spin flex items-center justify-center">
              <span className="material-symbols-outlined text-tertiary text-2xl">insights</span>
            </div>
            <div className="space-y-1">
              <h3 className="font-headline-md text-headline-md text-white font-bold">Compiling Audit Report</h3>
              <p className="text-xs text-on-surface-variant">Uploading transcript context, resolving telemetry, and querying Groq Llama 3.3 for analytical speech critiques...</p>
            </div>
          </div>
        )}

      </div>

      <Footer />
    </div>
  );
}
