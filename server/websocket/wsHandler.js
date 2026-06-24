import { WebSocketServer, WebSocket } from 'ws';
import { saveSessionToDatabase } from '../helpers/dbHelpers.js';
import { ai, callWithRetry, callGroqChat } from '../helpers/critiqueHelpers.js';

function initializeWebSocketServer(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const { pathname } = new URL(request.url, `http://${request.headers.host}`);
    if (pathname === '/api/interview/session') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws, req) => {
    console.log("New client connected to interview WebSocket session");
    
    let geminiWs = null;
    let sessionId = Math.random().toString(36).substring(2, 15);
    let sessionState = {
      id: sessionId,
      transcript: [],
      startTime: Date.now(),
      timer: null,
      mode: 'jd',
      title: 'Interview Session',
      company: 'Target Company',
      durationMinutes: 15
    };

    // Tell client their session ID
    ws.send(JSON.stringify({ type: 'session_created', sessionId }));

    ws.on('message', async (message) => {
      try {
        const payload = JSON.parse(message.toString());

        // Handle initial configuration
        if (payload.type === 'setup') {
          const { mode, jdText, resumeText, jobTitle, company, duration, userEmail } = payload;
          sessionState.mode = mode || 'jd';
          sessionState.title = jobTitle || 'Technical Interview';
          sessionState.company = company || 'Target Company';
          sessionState.durationMinutes = duration || 15;
          sessionState.userEmail = userEmail || null;

          console.log(`Setting up ${mode} interview for ${jobTitle} at ${company} (Duration: ${duration}m)`);

          // Start server side timer to prevent lingering sessions
          const durationMs = sessionState.durationMinutes * 60 * 1000;
          sessionState.timer = setTimeout(() => {
            console.log(`Session ${sessionId} reached duration limit. Terminating.`);
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ type: 'timer_expired', message: "Your interview session has reached the time limit." }));
            }
            ws.close();
          }, durationMs + 30000); // 30s grace period

          // Construct custom system instructions based on JD/Resume mode
          let systemInstructions = "";
          if (sessionState.mode === 'jd') {
            systemInstructions = `You are a strict, highly professional technical hiring manager interviewing a candidate for the position of "${jobTitle}" at "${company}".
Role description/Job Details:
--- JOB DESCRIPTION START ---
${jdText || "General Software Engineering expectations"}
--- JOB DESCRIPTION END ---

Conduct a realistic, rigorous technical interview. Ask challenging, relevant questions one by one. Listen carefully to the candidate's answers, ask follow-up questions, probe their reasoning, and check for depth. 
Be conversational, realistic, and do not repeat questions. Keep your responses short (1-3 sentences) so the conversation flows naturally.
Do not provide feedback or score them during the interview itself. Wrap up cleanly when the interview concludes.`;
          } else {
            systemInstructions = `You are a strict, highly professional technical hiring manager interviewing a candidate based on their resume.
Candidate Resume Details:
--- RESUME START ---
${resumeText || "No resume details available."}
--- RESUME END ---

Conduct a realistic, rigorous interview cross-examining their specific bullet points, projects, and technologies. Question their claims, check their actual depth of knowledge, and ask relevant behavioral or technical questions one by one.
Keep your responses short (1-3 sentences) so the conversation flows naturally.
Do not provide feedback or score them during the interview itself. Wrap up cleanly when the interview concludes.`;
          }

          // Initialize Google Gemini WebSocket connection
          const geminiUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${process.env.GEMINI_API_KEY}`;
          
          let useFallback = false;
          let setupCompleted = false;
          let connectionTimeout = setTimeout(() => {
            if (!setupCompleted) {
              console.log(`[TIMEOUT] Gemini Live connection timed out for session ${sessionId}. Activating fallback.`);
              activateFallback();
            }
          }, 3500);

          function activateFallback() {
            if (useFallback) return;
            useFallback = true;
            setupCompleted = true;
            clearTimeout(connectionTimeout);

            console.log(`[FALLBACK] Initializing Fallback Voice Interview Engine for session ${sessionId}...`);

            const hasDialogue = sessionState.transcript.length > 0;

            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ 
                type: 'session_ready', 
                isFallback: true 
              }));

              if (!hasDialogue) {
                // Generate initial introductory question based on job details
                const firstQuestion = `Hello! Welcome. Thank you for joining the interview today for the "${jobTitle}" position at "${company}". Let's start by having you introduce yourself and walk me through your background and relevant experiences.`;
                
                sessionState.transcript.push({
                  sender: 'interviewer',
                  text: firstQuestion,
                  timestamp: Date.now()
                });

                // Send the initial question to trigger speechSynthesis on client
                setTimeout(() => {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                      type: 'fallback_speech',
                      text: firstQuestion,
                      transcript: sessionState.transcript
                    }));
                  }
                }, 1000);
              } else {
                console.log(`[FALLBACK] Switched mid-interview for session ${sessionId}. Dialogue turns: ${sessionState.transcript.length}`);
                
                const lastTurn = sessionState.transcript[sessionState.transcript.length - 1];
                if (lastTurn && lastTurn.sender === 'candidate') {
                  ws.send(JSON.stringify({ type: 'interviewer_thinking' }));
                  generateFallbackQuestion(sessionState).then(nextQuestion => {
                    sessionState.transcript.push({
                      sender: 'interviewer',
                      text: nextQuestion,
                      timestamp: Date.now()
                    });
                    if (ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({
                        type: 'fallback_speech',
                        text: nextQuestion,
                        transcript: sessionState.transcript
                      }));
                    }
                  }).catch(err => {
                    console.error("Mid-interview fallback question generation error:", err);
                  });
                } else if (lastTurn && lastTurn.sender === 'interviewer') {
                  ws.send(JSON.stringify({
                    type: 'fallback_speech',
                    text: lastTurn.text,
                    transcript: sessionState.transcript
                  }));
                }
              }
            }
          }

          console.log(`Connecting to Gemini Live API WebSocket for session ${sessionId}...`);
          geminiWs = new WebSocket(geminiUrl);

          geminiWs.on('open', () => {
            console.log("Connected to Google Gemini Live WebSocket API");
            
            // Send setup payload to Gemini
            const setupMessage = {
              setup: {
                model: "models/gemini-2.0-flash-exp",
                generationConfig: {
                  responseModalities: ["audio"],
                  speechConfig: {
                    voiceConfig: {
                      prebuiltVoiceConfig: {
                        voiceName: "Aoede"
                      }
                    }
                  }
                },
                systemInstruction: {
                  parts: [
                    {
                      text: systemInstructions
                    }
                  ]
                }
              }
            };
            geminiWs.send(JSON.stringify(setupMessage));
            
            setTimeout(() => {
              if (geminiWs && geminiWs.readyState === WebSocket.OPEN && !useFallback) {
                setupCompleted = true;
                clearTimeout(connectionTimeout);
                ws.send(JSON.stringify({ type: 'session_ready', isFallback: false }));
              }
            }, 1000);
          });

          geminiWs.on('message', (geminiMsg) => {
            try {
              if (ws.readyState === ws.OPEN) {
                const rawData = geminiMsg.toString();
                ws.send(rawData);

                const parsed = JSON.parse(rawData);
                if (parsed.serverContent) {
                  if (parsed.serverContent.modelTurn && parsed.serverContent.modelTurn.parts) {
                    parsed.serverContent.modelTurn.parts.forEach(part => {
                      if (part.text) {
                        const len = sessionState.transcript.length;
                        if (len > 0 && sessionState.transcript[len - 1].sender === 'interviewer') {
                          sessionState.transcript[len - 1].text += part.text;
                        } else {
                          sessionState.transcript.push({
                            sender: 'interviewer',
                            text: part.text,
                            timestamp: Date.now()
                          });
                        }
                      }
                    });
                  }
                  if (parsed.serverContent.userTurn && parsed.serverContent.userTurn.parts) {
                    parsed.serverContent.userTurn.parts.forEach(part => {
                      if (part.text) {
                        const len = sessionState.transcript.length;
                        if (len > 0 && sessionState.transcript[len - 1].sender === 'candidate') {
                          sessionState.transcript[len - 1].text += part.text;
                        } else {
                          sessionState.transcript.push({
                            sender: 'candidate',
                            text: part.text,
                            timestamp: Date.now()
                          });
                        }
                      }
                    });
                  }
                }
              }
            } catch (err) {
              console.error("Error parsing Gemini WebSocket message:", err);
            }
          });

          geminiWs.on('error', (err) => {
            console.error("Gemini WebSocket API Error:", err);
            if (!useFallback) {
              activateFallback();
            }
          });

          geminiWs.on('close', (code, reason) => {
            console.log(`Gemini WebSocket connection closed: ${code} - ${reason}`);
            if (!useFallback) {
              activateFallback();
            }
          });
        }

        else if (payload.realtimeInput && geminiWs && geminiWs.readyState === WebSocket.OPEN) {
          geminiWs.send(JSON.stringify(payload));
        }

        else if (payload.type === 'transcript_update') {
          sessionState.transcript = payload.transcript;
        }

        else if (payload.type === 'user_response') {
          if (sessionState.isGenerating) {
            console.log(`[FALLBACK] Question generation already in progress for session ${sessionId}. Ignoring duplicate 'user_response'.`);
            return;
          }
          sessionState.isGenerating = true;

          const userText = payload.text;
          console.log(`[FALLBACK] Received candidate response for session ${sessionId}: "${userText}"`);

          const lastTurn = sessionState.transcript[sessionState.transcript.length - 1];
          if (!lastTurn || lastTurn.sender !== 'candidate' || lastTurn.text !== userText) {
            sessionState.transcript.push({
              sender: 'candidate',
              text: userText,
              timestamp: Date.now()
            });
          }

          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'interviewer_thinking' }));
          }

          try {
            const nextQuestion = await generateFallbackQuestion(sessionState);
            console.log(`[FALLBACK] Generated next question: "${nextQuestion}"`);
            
            sessionState.transcript.push({
              sender: 'interviewer',
              text: nextQuestion,
              timestamp: Date.now()
            });

            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'fallback_speech',
                text: nextQuestion,
                transcript: sessionState.transcript
              }));
            }
          } catch (err) {
            console.error("Error generating fallback question:", err);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'error',
                message: "Interviewer failed to process response. Please try again."
              }));
            }
          } finally {
            sessionState.isGenerating = false;
          }
        }

      } catch (e) {
        if (Buffer.isBuffer(message) && geminiWs && geminiWs.readyState === WebSocket.OPEN) {
          const base64Audio = message.toString('base64');
          const clientAudioChunk = {
            realtimeInput: {
              mediaChunks: [
                {
                  mimeType: "audio/pcm",
                  data: base64Audio
                }
              ]
            }
          };
          geminiWs.send(JSON.stringify(clientAudioChunk));
        } else {
          console.error("WebSocket message parsing error:", e);
        }
      }
    });

    ws.on('close', () => {
      console.log(`Client connection closed for session ${sessionId}`);
      if (sessionState.timer) {
        clearTimeout(sessionState.timer);
      }
      if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
        geminiWs.close();
      }
      saveSessionToDatabase(sessionState);
    });

    ws.on('error', (err) => {
      console.error(`Client WebSocket error for session ${sessionId}:`, err);
    });
  });

  async function generateFallbackQuestion(session) {
    let systemPrompt = "";
    if (session.mode === 'jd') {
      systemPrompt = `You are a strict, highly professional technical hiring manager interviewing a candidate for the position of "${session.title}" at "${session.company}".

Instructions:
Conduct a realistic, rigorous technical interview. Ask challenging, relevant questions one by one based on candidate answers or standard expectations for this role.
Be conversational, realistic, and do not repeat questions. Keep your responses short (1-2 sentences) so the conversation flows naturally.
Do not provide feedback or score them during the interview itself.
Ask exactly ONE question and nothing else. Do not output any markdown formatting, headers, or pleasantries other than your dialog.`;
    } else {
      systemPrompt = `You are a strict, highly professional technical hiring manager interviewing a candidate based on their resume.
Interview Details:
- Job Title Focus: ${session.title}
- Company Focus: ${session.company}

Instructions:
Conduct a realistic, rigorous interview cross-examining their specific bullet points, projects, and technologies. Question their claims, check their actual depth of knowledge, and ask relevant behavioral or technical questions one by one.
Keep your responses short (1-2 sentences) so the conversation flows naturally.
Do not provide feedback or score them during the interview itself.
Ask exactly ONE question and nothing else. Do not output any markdown formatting, headers, or pleasantries other than your dialog.`;
    }

    const historyText = session.transcript.map(turn => {
      const senderLabel = turn.sender === 'candidate' ? 'Candidate' : 'Interviewer';
      return `${senderLabel}: ${turn.text}`;
    }).join("\n");

    const userPrompt = `Here is the conversation history so far:\n${historyText}\n\nProvide your next interviewer response. Ask a follow-up or a new question. Keep it concise (1-2 sentences).`;

    try {
      const responseText = await callGroqChat(systemPrompt, userPrompt, "llama-3.3-70b-versatile");
      return responseText.trim().replace(/^Interviewer:\s*/i, '');
    } catch (groqErr) {
      console.warn("Groq failed in fallback generator, attempting standard Gemini API:", groqErr);
      if (ai) {
        try {
          const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });
          const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
          const result = await callWithRetry(async () => {
            return await Promise.race([
              model.generateContent(fullPrompt),
              new Promise((_, reject) => setTimeout(() => reject(new Error("Gemini API call timed out after 20 seconds")), 20000))
            ]);
          });
          return result.response.text().trim().replace(/^Interviewer:\s*/i, '');
        } catch (geminiErr) {
          console.error("Gemini fallback also failed:", geminiErr);
          throw new Error("Both Groq and Gemini API are unavailable for fallback generation.");
        }
      } else {
        throw new Error("Groq failed and Gemini API is not initialized.");
      }
    }
  }
}

export { initializeWebSocketServer };
