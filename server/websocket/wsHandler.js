import { WebSocketServer, WebSocket } from 'ws';
import { saveSessionToDatabase } from '../helpers/dbHelpers.js';
import { ai, callWithRetry, callGroqChat } from '../helpers/critiqueHelpers.js';
import { checkIpRateLimit } from '../middleware/auth.js';

function initializeWebSocketServer(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const { pathname } = new URL(request.url, `http://${request.headers.host}`);
    if (pathname === '/api/interview/session') {
      const ip = request.headers['x-forwarded-for'] || request.socket.remoteAddress;
      if (checkIpRateLimit(ip)) {
        console.warn(`WebSocket upgrade rate limited for IP: ${ip}`);
        socket.write('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n');
        socket.destroy();
        return;
      }

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
        if (payload.type === 'end_session') {
          console.log(`Explicit end_session request received for session ${sessionId}`);
          try {
            await saveSessionToDatabase(sessionState);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'session_saved', sessionId }));
            }
          } catch (saveErr) {
            console.error("Failed to process explicit end_session database write:", saveErr);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'session_saved', sessionId }));
            }
          }
          return;
        }

        // Handle initial configuration
        if (payload.type === 'setup') {
          const { mode, jdText, resumeText, jobTitle, company, duration, userEmail, jdId, customSystemPrompt, customQuestions } = payload;
          
          if (userEmail) {
            const { findUserByEmail, getGlobalSettings, saveUser } = await import('../helpers/dbHelpers.js');
            const sanitizedEmail = userEmail.toLowerCase().trim();
            const user = await findUserByEmail(sanitizedEmail);
            if (user) {
              const settings = await getGlobalSettings();
              const planName = (user.subscription && user.subscription.plan) || 'Basic';
              
              let credits = user.credits;
              if (!credits) {
                const defaultLimits = {
                  jobApplicationsLimit: 3,
                  aiMocksLimit: 3
                };
                if (planName === 'Pro') {
                  defaultLimits.jobApplicationsLimit = settings.planPro?.jobApplicationsLimit || 15;
                  defaultLimits.aiMocksLimit = settings.planPro?.aiMocksLimit || 15;
                } else if (planName === 'Pro Plus') {
                  defaultLimits.jobApplicationsLimit = settings.planProPlus?.jobApplicationsLimit || 99999;
                  defaultLimits.aiMocksLimit = settings.planProPlus?.aiMocksLimit || 99999;
                }
                credits = {
                  jobApplicationsUsed: 0,
                  jobApplicationsLimit: defaultLimits.jobApplicationsLimit,
                  aiMocksUsed: 0,
                  aiMocksLimit: defaultLimits.aiMocksLimit
                };
              }

              if (jdId) {
                const limit = credits.jobApplicationsLimit || 3;
                if (credits.jobApplicationsUsed >= limit) {
                  console.warn(`[BILLING] Job application limit reached for user ${sanitizedEmail}`);
                  ws.send(JSON.stringify({ 
                    type: 'error', 
                    message: "Job application limit reached. Please upgrade your subscription tier." 
                  }));
                  setTimeout(() => ws.close(), 1000);
                  return;
                }
                credits.jobApplicationsUsed = (credits.jobApplicationsUsed || 0) + 1;
                console.log(`[BILLING] Incremented Job Applications Used to ${credits.jobApplicationsUsed} for ${sanitizedEmail}`);
              } else {
                const limit = credits.aiMocksLimit || 3;
                if (credits.aiMocksUsed >= limit) {
                  console.warn(`[BILLING] AI mock interview limit reached for user ${sanitizedEmail}`);
                  ws.send(JSON.stringify({ 
                    type: 'error', 
                    message: "AI mock interview limit reached. Please upgrade your subscription tier." 
                  }));
                  setTimeout(() => ws.close(), 1000);
                  return;
                }
                credits.aiMocksUsed = (credits.aiMocksUsed || 0) + 1;
                console.log(`[BILLING] Incremented AI Mocks Used to ${credits.aiMocksUsed} for ${sanitizedEmail}`);
              }

              user.credits = credits;
              await saveUser(user);
            }
          }

          sessionState.mode = mode || 'jd';
          sessionState.title = jobTitle || 'Technical Interview';
          sessionState.company = company || 'Target Company';
          sessionState.durationMinutes = duration || 15;
          sessionState.userEmail = userEmail || null;
          sessionState.jdId = jdId || null;
          sessionState.customSystemPrompt = customSystemPrompt || null;
          sessionState.customQuestions = customQuestions || null;

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
          if (customQuestions && Array.isArray(customQuestions) && customQuestions.length > 0) {
            const listText = customQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n');
            systemInstructions = `You are a strict technical hiring manager interviewing a candidate for the position of "${jobTitle}" at "${company}".
You MUST ask the following set of predefined questions sequentially. Do NOT ask any other topics. Wait for their response and then briefly acknowledge (1 sentence) and move to the next question.
List of Questions to ask:
${listText}

Start by asking the first question immediately.`;
          } else if (customSystemPrompt) {
            systemInstructions = `You are a strict, highly professional technical hiring manager interviewing a candidate for the position of "${jobTitle}" at "${company}".
Role description/Job Details:
--- JOB DESCRIPTION START ---
${jdText || "General Software Engineering expectations"}
--- JOB DESCRIPTION END ---

Guidelines for the interviewer:
${customSystemPrompt}

Conduct a realistic, rigorous technical interview. Ask challenging, relevant questions one by one. Keep your responses short (1-3 sentences) so the conversation flows naturally.
Do not provide feedback or score them during the interview itself. Wrap up cleanly when the interview concludes.`;
          } else if (sessionState.mode === 'jd') {
            systemInstructions = `You are a strict, highly professional technical hiring manager interviewing a candidate for the position of "${jobTitle}" at "${company}".
Role description/Job Details:
--- JOB DESCRIPTION START ---
${jdText || "General Software Engineering expectations"}
--- JOB DESCRIPTION END ---

Structure the interview into three distinct progressive difficulty phases, dynamically adjusted to the total interview duration of ${duration} minutes:
1. **Easy Phase (First 33% of the session)**: Start with introductory questions, basic conceptual checks, and fundamentals of the role or simple projects on their resume. Ask follow-up questions to probe understanding before moving on.
2. **Medium Phase (Middle 33% of the session)**: Transition to medium-difficulty questions testing practical implementation, common system design patterns, troubleshooting scenarios, or structural resume claims.
3. **Hard Phase (Final 33% of the session)**: Conclude with high-difficulty questions exploring complex architectural trade-offs, edge cases, deep debugging, scale optimization, and advanced engineering principles.

Conduct a realistic, rigorous technical interview. Ask challenging, relevant questions one by one. Listen carefully to the candidate's answers, ask follow-up questions, probe their reasoning, and check for depth. 
Be conversational, realistic, and do not repeat questions. Keep your responses short (1-3 sentences) so the conversation flows naturally.
Do not provide feedback or score them during the interview itself. Wrap up cleanly when the interview concludes.`;
          } else {
            systemInstructions = `You are a strict, highly professional technical hiring manager interviewing a candidate based on their resume.
Candidate Resume Details:
--- RESUME START ---
${resumeText || "No resume details available."}
--- RESUME END ---

Structure the interview into three distinct progressive difficulty phases, dynamically adjusted to the total interview duration of ${duration} minutes:
1. **Easy Phase (First 33% of the session)**: Start with introductory questions, basic conceptual checks, and fundamentals of the role or simple projects on their resume. Ask follow-up questions to probe understanding before moving on.
2. **Medium Phase (Middle 33% of the session)**: Transition to medium-difficulty questions testing practical implementation, common system design patterns, troubleshooting scenarios, or structural resume claims.
3. **Hard Phase (Final 33% of the session)**: Conclude with high-difficulty questions exploring complex architectural trade-offs, edge cases, deep debugging, scale optimization, and advanced engineering principles.

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
                // Generate initial introductory question based on job details or custom questions
                let firstQuestion = `Hello! Welcome. Thank you for joining the interview today for the "${jobTitle}" position at "${company}". Let's start by having you introduce yourself and walk me through your background and relevant experiences.`;
                if (customQuestions && Array.isArray(customQuestions) && customQuestions.length > 0) {
                  firstQuestion = `Hello! Welcome. Thank you for joining the interview for the "${jobTitle}" position at "${company}". Let's start with the first question: ${customQuestions[0]}`;
                }
                
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
    // If sequential custom questions are specified, pull the next one from the array
    if (session.customQuestions && Array.isArray(session.customQuestions) && session.customQuestions.length > 0) {
      const interviewerTurns = session.transcript.filter(turn => turn.sender === 'interviewer').length;
      if (interviewerTurns < session.customQuestions.length) {
        return session.customQuestions[interviewerTurns];
      } else {
        return "Thank you. That was the final question of the interview. We are all set.";
      }
    }

    const elapsedTimeMs = Date.now() - session.startTime;
    const totalDurationMs = (session.durationMinutes || 15) * 60 * 1000;
    const progressRatio = totalDurationMs > 0 ? (elapsedTimeMs / totalDurationMs) : 0;

    let difficultyPhase = "EASY (fundamental concepts, simple resume claims, and basic background/fit)";
    let difficultyLabel = "Easy";
    if (progressRatio > 0.66) {
      difficultyPhase = "HARD (complex architecture, edge cases, scalability, performance tuning, and deep technical details)";
      difficultyLabel = "Hard";
    } else if (progressRatio > 0.33) {
      difficultyPhase = "MEDIUM (practical implementation, debugging scenarios, database schema design, and core technical claims)";
      difficultyLabel = "Medium";
    }

    console.log(`[FALLBACK] Generating question for session ${session.id}. Progress: ${Math.round(progressRatio * 100)}%. Difficulty selected: ${difficultyLabel}`);

    if (session.customQuestions && Array.isArray(session.customQuestions) && session.customQuestions.length > 0) {
      const interviewerTurns = session.transcript.filter(t => t.sender === 'interviewer');
      const nextIndex = interviewerTurns.length;
      if (nextIndex < session.customQuestions.length) {
        return session.customQuestions[nextIndex];
      } else {
        return "Thank you. That completes all the custom questions I had for today's interview. We are all set!";
      }
    }

    let systemPrompt = "";
    if (session.customSystemPrompt) {
      systemPrompt = `You are a strict, highly professional technical hiring manager interviewing a candidate for the position of "${session.title}" at "${session.company}".

Guidelines for the interviewer:
${session.customSystemPrompt}

Ask exactly ONE question and nothing else. Do not output any markdown formatting, headers, or pleasantries other than your dialog. Keep it concise (1-2 sentences).`;
    } else if (session.mode === 'jd') {
      systemPrompt = `You are a strict, highly professional technical hiring manager interviewing a candidate for the position of "${session.title}" at "${session.company}".

Current Interview Stage: We are currently in the ${difficultyPhase} phase of the interview.

Instructions:
Conduct a realistic, rigorous technical interview. Ask challenging, relevant questions one by one based on candidate answers or standard expectations for this role.
Ensure the difficulty of the next question or follow-up matches the current interview stage difficulty specified above.
Be conversational, realistic, and do not repeat questions. Keep your responses short (1-2 sentences) so the conversation flows naturally.
Do not provide feedback or score them during the interview itself.
Ask exactly ONE question and nothing else. Do not output any markdown formatting, headers, or pleasantries other than your dialog.`;
    } else {
      systemPrompt = `You are a strict, highly professional technical hiring manager interviewing a candidate based on their resume.
Interview Details:
- Job Title Focus: ${session.title}
- Company Focus: ${session.company}

Current Interview Stage: We are currently in the ${difficultyPhase} phase of the interview.

Instructions:
Conduct a realistic, rigorous interview cross-examining their specific bullet points, projects, and technologies. Question their claims, check their actual depth of knowledge, and ask relevant behavioral or technical questions one by one.
Ensure the difficulty of the next question or follow-up matches the current interview stage difficulty specified above.
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
