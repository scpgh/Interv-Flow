import WebSocket from 'ws';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const candidateModels = [
  "models/gemini-2.0-flash",
  "models/gemini-2.0-flash-exp",
  "models/gemini-2.0-flash-realtime",
  "models/gemini-2.0-flash-live",
  "models/gemini-2.5-flash",
  "models/gemini-2.5-flash-live"
];

const apiVersions = ["v1alpha", "v1beta"];

async function testModel(apiVersion, modelName) {
  return new Promise((resolve) => {
    const geminiUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.${apiVersion}.GenerativeService.BidiGenerateContent?key=${apiKey}`;
    console.log(`\nTesting version: ${apiVersion}, model: ${modelName}...`);
    const ws = new WebSocket(geminiUrl);

    let setupSent = false;
    let resolved = false;

    ws.on('open', () => {
      console.log(`[${apiVersion} - ${modelName}] Connected. Sending setup...`);
      const setupMessage = {
        setup: {
          model: modelName,
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
            parts: [{ text: "You are a helpful assistant." }]
          }
        }
      };
      ws.send(JSON.stringify(setupMessage));
      setupSent = true;
    });

    ws.on('message', (data) => {
      console.log(`[${apiVersion} - ${modelName}] Received data:`, data.toString().substring(0, 100));
      if (!resolved) {
        resolved = true;
        ws.close();
        resolve(true);
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`[${apiVersion} - ${modelName}] Closed with code ${code}. Reason: ${reason.toString() || 'None'}`);
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    });

    ws.on('error', (err) => {
      console.error(`[${apiVersion} - ${modelName}] Error:`, err.message);
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    });

    // Timeout after 4 seconds
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        try { ws.close(); } catch(e){}
        console.log(`[${apiVersion} - ${modelName}] Test timed out.`);
        resolve(false);
      }
    }, 4000);
  });
}

async function runTests() {
  for (const apiVersion of apiVersions) {
    for (const model of candidateModels) {
      const success = await testModel(apiVersion, model);
      if (success) {
        console.log(`\n🎉 SUCCESS! Version "${apiVersion}" with Model "${model}" is supported.`);
        return; // Stop on first success to save time
      } else {
        console.log(`❌ FAILED: Version "${apiVersion}" with Model "${model}" is not supported.`);
      }
    }
  }
}

runTests();
