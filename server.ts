import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { createServer as createViteServer } from 'vite';
import {
  GoogleGenAI,
  LiveServerMessage,
  Modality,
  ThinkingLevel,
} from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

function getGenAIClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  app.use(express.json({ limit: '50mb' }));

  // 1. Multi-turn Chat (gemini-4-argon, gemini-3.8-flash, gemini-3.1-flash-lite)
  app.post('/api/gemini/chat', async (req, res) => {
    try {
      const {
        message,
        history = [],
        model = 'gemini-3.8-flash',
        roleInstruction = 'You are OmniStream Studio Director, an expert in 8K/32K video production, live streaming architecture, and creative direction.',
        highThinking = false,
      } = req.body;

      const ai = getGenAIClient();
      const selectedModel = ['gemini-4-argon', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'].includes(model)
        ? model
        : 'gemini-3.8-flash';

      const config: Record<string, unknown> = {
        systemInstruction: roleInstruction,
      };

      if (highThinking && selectedModel === 'gemini-4-argon') {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
      }

      const formattedHistory = Array.isArray(history)
        ? history.map((item: { role: string; text: string }) => ({
            role: item.role === 'model' ? 'model' : 'user',
            parts: [{ text: String(item.text || '') }],
          }))
        : [];

      const chat = ai.chats.create({
        model: selectedModel,
        history: formattedHistory,
        config,
      });

      const response = await chat.sendMessage({
        message: String(message || 'Hello'),
      });

      res.json({
        text: response.text ?? '',
        model: selectedModel,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: msg });
    }
  });

  // 2. Analyze Image or Video Content (gemini-4-argon, optional ThinkingLevel.HIGH)
  app.post('/api/gemini/analyze-media', async (req, res) => {
    try {
      const {
        prompt = 'Analyze this media in detail for key scenes, technical quality, and production insights.',
        mimeType,
        base64Data,
        highThinking = true,
      } = req.body;

      const ai = getGenAIClient();
      const parts: Array<Record<string, unknown>> = [];
      if (base64Data && mimeType) {
        parts.push({
          inlineData: {
            mimeType: String(mimeType),
            data: String(base64Data),
          },
        });
      }
      parts.push({ text: String(prompt) });

      const response = await ai.models.generateContent({
        model: 'gemini-4-argon',
        contents: { parts },
        config: highThinking
          ? { thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH } }
          : undefined,
      });

      res.json({ text: response.text ?? '' });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: msg });
    }
  });

  // 3. Low-Latency Fast Assistant (gemini-3.1-flash-lite)
  app.post('/api/gemini/fast-assist', async (req, res) => {
    try {
      const { prompt } = req.body;
      const ai = getGenAIClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: String(prompt || 'Suggest 5 trending 8K video tags.'),
      });
      res.json({ text: response.text ?? '' });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: msg });
    }
  });

  // 4. Google Search Grounding (gemini-3.8-flash + googleSearch)
  app.post('/api/gemini/search-grounding', async (req, res) => {
    try {
      const { query } = req.body;
      const ai = getGenAIClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: String(query || 'Latest breakthroughs in 8K and spatial video streaming'),
        config: {
          tools: [{ googleSearch: {} }],
        },
      });
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      res.json({
        text: response.text ?? '',
        groundingChunks: chunks,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: msg });
    }
  });

  // 5. Google Maps Grounding (gemini-3.8-flash + googleMaps)
  app.post('/api/gemini/maps-grounding', async (req, res) => {
    try {
      const { query, latitude = 37.78193, longitude = -122.40476 } = req.body;
      const ai = getGenAIClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: String(query || 'Top film and production studios nearby'),
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: {
                latitude: Number(latitude),
                longitude: Number(longitude),
              },
            },
          },
        },
      });
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      res.json({
        text: response.text ?? '',
        groundingChunks: chunks,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: msg });
    }
  });

  // 6. Image Generation & Editing (gemini-nano-banana-2.1 & gemini-3-pro-image)
  app.post('/api/gemini/generate-image', async (req, res) => {
    try {
      const {
        prompt,
        model = 'gemini-nano-banana-2.1',
        aspectRatio = '16:9',
        imageSize = '1K',
        base64ImageData,
        mimeType = 'image/png',
      } = req.body;

      const ai = getGenAIClient();
      // Normalize model alias
      const resolvedModel =
        model === 'gemini-3-pro-image-preview' || model === 'gemini-3-pro-image'
          ? 'gemini-3-pro-image'
          : 'gemini-nano-banana-2.1';

      const parts: Array<Record<string, unknown>> = [];
      if (base64ImageData) {
        parts.push({
          inlineData: {
            data: String(base64ImageData),
            mimeType: String(mimeType),
          },
        });
      }
      parts.push({ text: String(prompt || 'A futuristic 32K holographic broadcast studio') });

      const response = await ai.models.generateContent({
        model: resolvedModel,
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio: String(aspectRatio),
            imageSize: String(imageSize),
          },
        },
      });

      let imageUrl = '';
      let textOutput = '';
      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType ?? 'image/png';
          imageUrl = `data:${mime};base64,${part.inlineData.data}`;
        } else if (part.text) {
          textOutput += part.text;
        }
      }

      res.json({ imageUrl, text: textOutput, model: resolvedModel });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: msg });
    }
  });

  // 7. Video Generation & Image-to-Video Animation (gemini-omni-1.1-flash via Interactions API)
  app.post('/api/gemini/generate-video', async (req, res) => {
    try {
      const {
        prompt,
        aspectRatio = '16:9',
        base64ImageBytes,
        mimeType = 'image/png',
      } = req.body;

      const ai = getGenAIClient();
      const validAspectRatio = aspectRatio === '9:16' ? '9:16' : '16:9';

      const inputPayload = base64ImageBytes
        ? [
            {
              type: 'image' as const,
              mime_type: String(mimeType),
              data: String(base64ImageBytes),
            },
            {
              type: 'text' as const,
              text: String(prompt || 'Cinematic smooth camera motion across the scene.'),
            },
          ]
        : String(prompt || 'A futuristic neon streaming control room with holographic displays.');

      const interaction = await ai.interactions.create(
        {
          model: 'gemini-omni-1.1-flash',
          input: inputPayload,
          background: false,
          store: false,
          stream: false,
          response_format: {
            type: 'video',
            aspect_ratio: validAspectRatio,
            duration: '5s',
            resolution: '720p',
          },
        },
        { timeout: 300000 }
      );

      const videoPart = interaction.output_video;
      if (videoPart?.data) {
        const mime = videoPart.mime_type || 'video/mp4';
        res.json({
          videoDataUrl: `data:${mime};base64,${videoPart.data}`,
          aspectRatio: validAspectRatio,
        });
      } else if (videoPart?.uri) {
        res.json({
          videoDataUrl: videoPart.uri,
          aspectRatio: validAspectRatio,
        });
      } else {
        res.status(500).json({ error: 'No video data returned from gemini-omni-1.1-flash' });
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: msg });
    }
  });

  // 8. Music Generation (lyria-3-clip-preview & lyria-3-pro-preview)
  app.post('/api/gemini/generate-music', async (req, res) => {
    try {
      const { prompt, model = 'lyria-3-clip-preview' } = req.body;
      const ai = getGenAIClient();
      const selectedModel =
        model === 'lyria-3-pro-preview' ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview';

      const response = await ai.models.generateContentStream({
        model: selectedModel,
        contents: String(prompt || 'Generate a 30-second cinematic synthwave soundtrack.'),
      });

      const audioChunks: Buffer[] = [];
      let lyrics = '';
      let mimeType = 'audio/mpeg';

      for await (const chunk of response) {
        const parts = chunk.candidates?.[0]?.content?.parts;
        if (!parts) continue;
        for (const part of parts) {
          if (part.inlineData?.data) {
            if (audioChunks.length === 0 && part.inlineData.mimeType) {
              mimeType = part.inlineData.mimeType;
            }
            audioChunks.push(Buffer.from(part.inlineData.data, 'base64'));
          }
          if (part.text) {
            lyrics += part.text;
          }
        }
      }

      const audioBase64 = Buffer.concat(audioChunks).toString('base64');
      res.json({
        audioDataUrl: `data:${mimeType};base64,${audioBase64}`,
        lyrics,
        model: selectedModel,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: msg });
    }
  });

  // 9. Text-to-Speech (gemini-3.8-flash-tts)
  app.post('/api/gemini/tts', async (req, res) => {
    try {
      const {
        text,
        secondSpeakerText,
        voice1 = 'Puck',
        voice2 = 'Kore',
      } = req.body;

      const ai = getGenAIClient();

      if (secondSpeakerText && String(secondSpeakerText).trim().length > 0) {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `Host: ${String(text || 'Welcome to OmniStream 32K Studio!')}`,
                  speechMetadata: {
                    speaker: 'Host',
                    style: 'Enthusiastic, bright podcast host',
                  },
                },
                {
                  text: `CoHost: ${String(secondSpeakerText)}`,
                  speechMetadata: {
                    speaker: 'CoHost',
                    style: 'Curious, articulate co-host',
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              multiSpeakerVoiceConfig: {
                speakerVoiceConfigs: [
                  {
                    speaker: 'Host',
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: voice1 } },
                  },
                  {
                    speaker: 'CoHost',
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: voice2 } },
                  },
                ],
              },
            },
          },
        });

        const base64Audio =
          response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        res.json({
          audioDataUrl: base64Audio ? `data:audio/wav;base64,${base64Audio}` : '',
        });
      } else {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: String(text || 'Welcome to OmniStream 32K Spatial Studio.'),
                  speechMetadata: {
                    style: 'Clear, engaging broadcast narrator',
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice1 },
              },
            },
          },
        });

        const base64Audio =
          response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        res.json({
          audioDataUrl: base64Audio ? `data:audio/wav;base64,${base64Audio}` : '',
        });
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: msg });
    }
  });

  // 10. Audio Transcription (gemini-3.5-transcribe)
  app.post('/api/gemini/transcribe', async (req, res) => {
    try {
      const { base64Audio, mimeType = 'audio/webm' } = req.body;
      const ai = getGenAIClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: String(mimeType),
                data: String(base64Audio || ''),
              },
            },
            { text: 'Transcribe this audio accurately.' },
          ],
        },
      });
      res.json({ text: response.text ?? '' });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: msg });
    }
  });

  // 11. WebSocket Server for Gemini Live API (gemini-3.8-live)
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
    if (pathname === '/live') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', async (clientWs) => {
    const ai = getGenAIClient();
    let sessionPromise: ReturnType<typeof ai.live.connect> | null = null;

    try {
      sessionPromise = ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction:
            'You are the live voice co-producer inside OmniStream XR Studio. Give concise, helpful real-time broadcast and creative advice.',
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            const content = message.serverContent;
            if (content?.inputTranscription?.text) {
              clientWs.send(
                JSON.stringify({ inputTranscript: content.inputTranscription.text })
              );
            }
            if (content?.outputTranscription?.text) {
              clientWs.send(
                JSON.stringify({ outputTranscript: content.outputTranscription.text })
              );
            }
            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
              }
            }
            if (content?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          },
          onerror: (err: unknown) => {
            clientWs.send(
              JSON.stringify({
                error: err instanceof Error ? err.message : 'Live session error',
              })
            );
          },
        },
      });

      const session = await sessionPromise;

      clientWs.on('message', (raw) => {
        try {
          const parsed = JSON.parse(raw.toString());
          if (parsed.audio) {
            session.sendRealtimeInput({
              audio: { data: parsed.audio, mimeType: 'audio/pcm;rate=16000' },
            });
          } else if (parsed.text) {
            session.sendRealtimeInput({
              text: String(parsed.text),
            });
          }
        } catch (err) {
          console.error('Live message parse error:', err);
        }
      });

      clientWs.on('close', () => {
        session.close();
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      clientWs.send(JSON.stringify({ error: msg }));
      clientWs.close();
    }
  });

  // Vite middleware in development, static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`OmniStream XR Studio server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
