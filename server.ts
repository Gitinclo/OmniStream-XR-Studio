import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
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
import {
  ENDPOINT_POLICIES,
  GeminiApiSecurityGovernor,
  VerifiedClientIdentity,
  clampPromptText,
  extractBearerOrQueryToken,
  redactSensitiveErrorDetails,
  sanitizeServerError,
  verifyFirebaseIdToken,
} from './src/services/serverSecurityGuard';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const PRIMARY_ADMIN_EMAIL = 'creatergame31@gmail.com';
const LIVE_SESSION_MAX_DURATION_MS = 10 * 60 * 1000; // 10 minutes max per Live WS session
const LIVE_WS_MAX_MESSAGES_PER_MIN = 120;
const LIVE_WS_MAX_PAYLOAD_BYTES = 64 * 1024; // 64 KB max per WS frame

function resolveFirebaseProjectId(): string {
  try {
    const configPath = path.join(__dirname, 'firebase-applet-config.json');
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw) as { projectId?: string };
    if (parsed.projectId && typeof parsed.projectId === 'string') {
      return parsed.projectId;
    }
  } catch {
    // Fallback to known project ID if config file cannot be read
  }
  return 'gen-lang-client-0029274497';
}

const FIREBASE_PROJECT_ID = resolveFirebaseProjectId();
const securityGovernor = new GeminiApiSecurityGovernor();

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

function getClientIp(req: http.IncomingMessage | Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim().length > 0) {
    return xff.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown_ip';
}

function logSanitizedServerError(contextCode: string, error: unknown): void {
  const raw = error instanceof Error ? error.message : String(error);
  console.error(`[ServerError:${contextCode}]`, redactSensitiveErrorDetails(raw));
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  // Scoped JSON body parsers to prevent oversized payload memory exhaustion
  const jsonTextParser = express.json({ limit: '64kb' });
  const jsonMediaParser = express.json({ limit: '10mb' });

  /**
   * Authentication, Sliding-Window Rate Limit, and Daily Weighted Quota Middleware
   * Protects all `/api/gemini/*` endpoints from unauthenticated or abusive requests.
   */
  const requireAuthenticatedGeminiQuota = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const ip = getClientIp(req);
      const token = extractBearerOrQueryToken(req.headers.authorization, req.originalUrl);
      const identity = token
        ? await verifyFirebaseIdToken(token, FIREBASE_PROJECT_ID, PRIMARY_ADMIN_EMAIL)
        : null;

      const endpointKey = req.path;
      const decision = securityGovernor.checkAndConsumeQuota({
        ip,
        endpoint: endpointKey,
        identity,
      });

      res.setHeader('X-RateLimit-Remaining', String(decision.remainingRequestsInWindow));
      res.setHeader('X-Quota-Remaining', String(decision.remainingDailyQuotaUnits));
      if (decision.retryAfterSeconds) {
        res.setHeader('Retry-After', String(decision.retryAfterSeconds));
      }

      if (!decision.allowed) {
        res.status(decision.statusCode).json({
          error: decision.publicMessage,
          code: decision.errorCode,
        });
        return;
      }

      (req as Request & { clientIdentity?: VerifiedClientIdentity }).clientIdentity =
        identity!;
      next();
    } catch (error: unknown) {
      logSanitizedServerError('AUTH_GUARD_ERROR', error);
      res.status(401).json({
        error: 'Authentication verification failed. Please sign in again.',
        code: 'AUTH_VERIFICATION_FAILED',
      });
    }
  };

  // 1. Multi-turn Chat (gemini-4-argon, gemini-3.8-flash, gemini-3.1-flash-lite)
  app.post(
    '/api/gemini/chat',
    requireAuthenticatedGeminiQuota,
    jsonTextParser,
    async (req, res) => {
      try {
        const {
          message,
          history = [],
          model = 'gemini-3.8-flash',
          roleInstruction = 'You are OmniStream Studio Director, an expert in 8K/32K video production, live streaming architecture, and creative direction.',
          highThinking = false,
        } = req.body || {};

        const ai = getGenAIClient();
        const selectedModel = [
          'gemini-4-argon',
          'gemini-3.8-flash',
          'gemini-3.1-flash-lite',
        ].includes(model)
          ? model
          : 'gemini-3.8-flash';

        const config: Record<string, unknown> = {
          systemInstruction: clampPromptText(
            roleInstruction,
            'You are OmniStream Studio Director.',
            1000
          ),
        };

        if (highThinking && selectedModel === 'gemini-4-argon') {
          config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
        }

        const formattedHistory = Array.isArray(history)
          ? history.slice(-20).map((item: { role?: string; text?: string }) => ({
              role: item?.role === 'model' ? 'model' : 'user',
              parts: [{ text: clampPromptText(item?.text, '', 2000) }],
            }))
          : [];

        const chat = ai.chats.create({
          model: selectedModel,
          history: formattedHistory,
          config,
        });

        const safeMessage = clampPromptText(
          message,
          'Hello',
          ENDPOINT_POLICIES['/api/gemini/chat'].maxPromptLength
        );
        const response = await chat.sendMessage({
          message: safeMessage,
        });

        res.json({
          text: response.text ?? '',
          model: selectedModel,
        });
      } catch (error: unknown) {
        logSanitizedServerError('CHAT_ERROR', error);
        res.status(500).json(sanitizeServerError(error, 'CHAT_ERROR'));
      }
    }
  );

  // 2. Analyze Image or Video Content (gemini-4-argon, optional ThinkingLevel.HIGH)
  app.post(
    '/api/gemini/analyze-media',
    requireAuthenticatedGeminiQuota,
    jsonMediaParser,
    async (req, res) => {
      try {
        const {
          prompt = 'Analyze this media in detail for key scenes, technical quality, and production insights.',
          mimeType,
          base64Data,
          highThinking = true,
        } = req.body || {};

        const ai = getGenAIClient();
        const parts: Array<Record<string, unknown>> = [];
        if (base64Data && mimeType) {
          parts.push({
            inlineData: {
              mimeType: String(mimeType).slice(0, 100),
              data: String(base64Data),
            },
          });
        }
        parts.push({
          text: clampPromptText(
            prompt,
            'Analyze this media in detail.',
            ENDPOINT_POLICIES['/api/gemini/analyze-media'].maxPromptLength
          ),
        });

        const response = await ai.models.generateContent({
          model: 'gemini-4-argon',
          contents: { parts },
          config: highThinking
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH } }
            : undefined,
        });

        res.json({ text: response.text ?? '' });
      } catch (error: unknown) {
        logSanitizedServerError('ANALYZE_MEDIA_ERROR', error);
        res.status(500).json(sanitizeServerError(error, 'ANALYZE_MEDIA_ERROR'));
      }
    }
  );

  // 3. Low-Latency Fast Assistant (gemini-3.1-flash-lite)
  app.post(
    '/api/gemini/fast-assist',
    requireAuthenticatedGeminiQuota,
    jsonTextParser,
    async (req, res) => {
      try {
        const { prompt } = req.body || {};
        const ai = getGenAIClient();
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: clampPromptText(
            prompt,
            'Suggest 5 trending 8K video tags.',
            ENDPOINT_POLICIES['/api/gemini/fast-assist'].maxPromptLength
          ),
        });
        res.json({ text: response.text ?? '' });
      } catch (error: unknown) {
        logSanitizedServerError('FAST_ASSIST_ERROR', error);
        res.status(500).json(sanitizeServerError(error, 'FAST_ASSIST_ERROR'));
      }
    }
  );

  // 4. Google Search Grounding (gemini-3.8-flash + googleSearch)
  app.post(
    '/api/gemini/search-grounding',
    requireAuthenticatedGeminiQuota,
    jsonTextParser,
    async (req, res) => {
      try {
        const { query } = req.body || {};
        const ai = getGenAIClient();
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: clampPromptText(
            query,
            'Latest breakthroughs in 8K and spatial video streaming',
            ENDPOINT_POLICIES['/api/gemini/search-grounding'].maxPromptLength
          ),
          config: {
            tools: [{ googleSearch: {} }],
          },
        });
        const chunks =
          response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
        res.json({
          text: response.text ?? '',
          groundingChunks: chunks,
        });
      } catch (error: unknown) {
        logSanitizedServerError('SEARCH_GROUNDING_ERROR', error);
        res.status(500).json(sanitizeServerError(error, 'SEARCH_GROUNDING_ERROR'));
      }
    }
  );

  // 5. Google Maps Grounding (gemini-3.8-flash + googleMaps)
  app.post(
    '/api/gemini/maps-grounding',
    requireAuthenticatedGeminiQuota,
    jsonTextParser,
    async (req, res) => {
      try {
        const {
          query,
          latitude = 37.78193,
          longitude = -122.40476,
        } = req.body || {};
        const safeLat = Math.max(-90, Math.min(90, Number(latitude) || 37.78193));
        const safeLng = Math.max(-180, Math.min(180, Number(longitude) || -122.40476));

        const ai = getGenAIClient();
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: clampPromptText(
            query,
            'Top film and production studios nearby',
            ENDPOINT_POLICIES['/api/gemini/maps-grounding'].maxPromptLength
          ),
          config: {
            tools: [{ googleMaps: {} }],
            toolConfig: {
              retrievalConfig: {
                latLng: {
                  latitude: safeLat,
                  longitude: safeLng,
                },
              },
            },
          },
        });
        const chunks =
          response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
        res.json({
          text: response.text ?? '',
          groundingChunks: chunks,
        });
      } catch (error: unknown) {
        logSanitizedServerError('MAPS_GROUNDING_ERROR', error);
        res.status(500).json(sanitizeServerError(error, 'MAPS_GROUNDING_ERROR'));
      }
    }
  );

  // 6. Image Generation & Editing (gemini-nano-banana-2.1 & gemini-3-pro-image)
  app.post(
    '/api/gemini/generate-image',
    requireAuthenticatedGeminiQuota,
    jsonMediaParser,
    async (req, res) => {
      try {
        const {
          prompt,
          model = 'gemini-nano-banana-2.1',
          aspectRatio = '16:9',
          imageSize = '1K',
          base64ImageData,
          mimeType = 'image/png',
        } = req.body || {};

        const ai = getGenAIClient();
        const resolvedModel =
          model === 'gemini-3-pro-image-preview' || model === 'gemini-3-pro-image'
            ? 'gemini-3-pro-image'
            : 'gemini-nano-banana-2.1';

        const parts: Array<Record<string, unknown>> = [];
        if (base64ImageData) {
          parts.push({
            inlineData: {
              data: String(base64ImageData),
              mimeType: String(mimeType).slice(0, 100),
            },
          });
        }
        parts.push({
          text: clampPromptText(
            prompt,
            'A futuristic 32K holographic broadcast studio',
            ENDPOINT_POLICIES['/api/gemini/generate-image'].maxPromptLength
          ),
        });

        const response = await ai.models.generateContent({
          model: resolvedModel,
          contents: { parts },
          config: {
            imageConfig: {
              aspectRatio: String(aspectRatio).slice(0, 10),
              imageSize: String(imageSize).slice(0, 10),
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
        logSanitizedServerError('GENERATE_IMAGE_ERROR', error);
        res.status(500).json(sanitizeServerError(error, 'GENERATE_IMAGE_ERROR'));
      }
    }
  );

  // 7. Video Generation & Image-to-Video Animation (gemini-omni-1.1-flash via Interactions API)
  app.post(
    '/api/gemini/generate-video',
    requireAuthenticatedGeminiQuota,
    jsonMediaParser,
    async (req, res) => {
      try {
        const {
          prompt,
          aspectRatio = '16:9',
          base64ImageBytes,
          mimeType = 'image/png',
        } = req.body || {};

        const ai = getGenAIClient();
        const validAspectRatio = aspectRatio === '9:16' ? '9:16' : '16:9';
        const safePrompt = clampPromptText(
          prompt,
          'A futuristic neon streaming control room with holographic displays.',
          ENDPOINT_POLICIES['/api/gemini/generate-video'].maxPromptLength
        );

        const inputPayload = base64ImageBytes
          ? [
              {
                type: 'image' as const,
                mime_type: String(mimeType).slice(0, 100),
                data: String(base64ImageBytes),
              },
              {
                type: 'text' as const,
                text: safePrompt,
              },
            ]
          : safePrompt;

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
          res.status(500).json(sanitizeServerError(null, 'GENERATE_VIDEO_ERROR'));
        }
      } catch (error: unknown) {
        logSanitizedServerError('GENERATE_VIDEO_ERROR', error);
        res.status(500).json(sanitizeServerError(error, 'GENERATE_VIDEO_ERROR'));
      }
    }
  );

  // 8. Music Generation (lyria-3-clip-preview & lyria-3-pro-preview)
  app.post(
    '/api/gemini/generate-music',
    requireAuthenticatedGeminiQuota,
    jsonTextParser,
    async (req, res) => {
      try {
        const { prompt, model = 'lyria-3-clip-preview' } = req.body || {};
        const ai = getGenAIClient();
        const selectedModel =
          model === 'lyria-3-pro-preview'
            ? 'lyria-3-pro-preview'
            : 'lyria-3-clip-preview';

        const response = await ai.models.generateContentStream({
          model: selectedModel,
          contents: clampPromptText(
            prompt,
            'Generate a 30-second cinematic synthwave soundtrack.',
            ENDPOINT_POLICIES['/api/gemini/generate-music'].maxPromptLength
          ),
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
        logSanitizedServerError('GENERATE_MUSIC_ERROR', error);
        res.status(500).json(sanitizeServerError(error, 'GENERATE_MUSIC_ERROR'));
      }
    }
  );

  // 9. Text-to-Speech (gemini-3.8-flash-tts)
  app.post(
    '/api/gemini/tts',
    requireAuthenticatedGeminiQuota,
    jsonTextParser,
    async (req, res) => {
      try {
        const {
          text,
          secondSpeakerText,
          voice1 = 'Puck',
          voice2 = 'Kore',
        } = req.body || {};

        const ai = getGenAIClient();
        const safeText = clampPromptText(
          text,
          'Welcome to OmniStream 32K Spatial Studio.',
          ENDPOINT_POLICIES['/api/gemini/tts'].maxPromptLength
        );
        const safeVoice1 = String(voice1 || 'Puck').slice(0, 32);
        const safeVoice2 = String(voice2 || 'Kore').slice(0, 32);

        if (secondSpeakerText && String(secondSpeakerText).trim().length > 0) {
          const safeSecond = clampPromptText(secondSpeakerText, '', 1500);
          const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash-tts',
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: `Host: ${safeText}`,
                    speechMetadata: {
                      speaker: 'Host',
                      style: 'Enthusiastic, bright podcast host',
                    },
                  },
                  {
                    text: `CoHost: ${safeSecond}`,
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
                      voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: safeVoice1 },
                      },
                    },
                    {
                      speaker: 'CoHost',
                      voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: safeVoice2 },
                      },
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
                    text: safeText,
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
                  prebuiltVoiceConfig: { voiceName: safeVoice1 },
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
        logSanitizedServerError('TTS_ERROR', error);
        res.status(500).json(sanitizeServerError(error, 'TTS_ERROR'));
      }
    }
  );

  // 10. Audio Transcription (gemini-3.5-transcribe)
  app.post(
    '/api/gemini/transcribe',
    requireAuthenticatedGeminiQuota,
    jsonMediaParser,
    async (req, res) => {
      try {
        const { base64Audio, mimeType = 'audio/webm' } = req.body || {};
        const ai = getGenAIClient();
        const response = await ai.models.generateContent({
          model: 'gemini-3.5-transcribe',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: String(mimeType).slice(0, 100),
                  data: String(base64Audio || ''),
                },
              },
              { text: 'Transcribe this audio accurately.' },
            ],
          },
        });
        res.json({ text: response.text ?? '' });
      } catch (error: unknown) {
        logSanitizedServerError('TRANSCRIBE_ERROR', error);
        res.status(500).json(sanitizeServerError(error, 'TRANSCRIBE_ERROR'));
      }
    }
  );

  // 11. Authenticated & Rate-Limited WebSocket Server for Gemini Live API (gemini-3.8-live)
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: LIVE_WS_MAX_PAYLOAD_BYTES,
  });

  server.on('upgrade', async (request, socket, head) => {
    try {
      const parsedUrl = new URL(
        request.url || '',
        `http://${request.headers.host || 'localhost:3000'}`
      );
      if (parsedUrl.pathname !== '/live') {
        socket.destroy();
        return;
      }

      const ip = getClientIp(request);
      const token = extractBearerOrQueryToken(
        request.headers.authorization,
        request.url
      );
      const identity = token
        ? await verifyFirebaseIdToken(token, FIREBASE_PROJECT_ID, PRIMARY_ADMIN_EMAIL)
        : null;

      const decision = securityGovernor.checkAndConsumeQuota({
        ip,
        endpoint: '/live',
        identity,
      });

      if (!decision.allowed || !identity) {
        const statusLine =
          decision.statusCode === 429
            ? 'HTTP/1.1 429 Too Many Requests'
            : 'HTTP/1.1 401 Unauthorized';
        const body = JSON.stringify({
          error: decision.publicMessage,
          code: decision.errorCode,
        });
        socket.write(
          `${statusLine}\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(
            body
          )}\r\nConnection: close\r\n\r\n${body}`
        );
        socket.destroy();
        return;
      }

      const slot = securityGovernor.acquireLiveWebSocketSlot(identity.uid);
      if (!slot.allowed) {
        const body = JSON.stringify({
          error: slot.reason || 'Live session limit reached.',
          code: 'LIVE_CONCURRENCY_LIMIT',
        });
        socket.write(
          `HTTP/1.1 429 Too Many Requests\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(
            body
          )}\r\nConnection: close\r\n\r\n${body}`
        );
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        (request as http.IncomingMessage & { clientIdentity?: VerifiedClientIdentity }).clientIdentity =
          identity;
        wss.emit('connection', ws, request);
      });
    } catch (error: unknown) {
      logSanitizedServerError('LIVE_UPGRADE_ERROR', error);
      socket.destroy();
    }
  });

  wss.on('connection', async (clientWs, request) => {
    const identity = (
      request as http.IncomingMessage & { clientIdentity?: VerifiedClientIdentity }
    ).clientIdentity;
    const uid = identity?.uid || 'unknown_uid';

    let slotReleased = false;
    const releaseSlotOnce = () => {
      if (!slotReleased) {
        slotReleased = true;
        securityGovernor.releaseLiveWebSocketSlot(uid);
      }
    };

    const maxDurationTimer = setTimeout(() => {
      if (clientWs.readyState === clientWs.OPEN) {
        clientWs.send(
          JSON.stringify({
            error: 'Maximum Live session duration (10 minutes) reached.',
            code: 'LIVE_SESSION_TIMEOUT',
          })
        );
        clientWs.close();
      }
    }, LIVE_SESSION_MAX_DURATION_MS);

    let messageTimestamps: number[] = [];
    const ai = getGenAIClient();

    try {
      const session = await ai.live.connect({
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
            if (clientWs.readyState !== clientWs.OPEN) return;
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
            logSanitizedServerError('LIVE_SESSION_ERROR', err);
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.send(
                JSON.stringify(sanitizeServerError(err, 'LIVE_SESSION_ERROR'))
              );
            }
          },
        },
      });

      clientWs.on('message', (raw) => {
        try {
          const now = Date.now();
          messageTimestamps = messageTimestamps.filter((t) => t > now - 60_000);
          if (messageTimestamps.length >= LIVE_WS_MAX_MESSAGES_PER_MIN) {
            clientWs.send(
              JSON.stringify({
                error: 'Live message rate limit exceeded. Please slow down.',
                code: 'LIVE_MESSAGE_RATE_LIMIT',
              })
            );
            return;
          }
          messageTimestamps.push(now);

          const parsed = JSON.parse(raw.toString());
          if (parsed.audio && typeof parsed.audio === 'string') {
            session.sendRealtimeInput({
              audio: { data: parsed.audio, mimeType: 'audio/pcm;rate=16000' },
            });
          } else if (parsed.text && typeof parsed.text === 'string') {
            session.sendRealtimeInput({
              text: clampPromptText(parsed.text, '', 1000),
            });
          }
        } catch (err: unknown) {
          logSanitizedServerError('LIVE_MESSAGE_PARSE_ERROR', err);
        }
      });

      clientWs.on('close', () => {
        clearTimeout(maxDurationTimer);
        releaseSlotOnce();
        session.close();
      });
    } catch (error: unknown) {
      clearTimeout(maxDurationTimer);
      releaseSlotOnce();
      logSanitizedServerError('LIVE_SESSION_ERROR', error);
      if (clientWs.readyState === clientWs.OPEN) {
        clientWs.send(
          JSON.stringify(sanitizeServerError(error, 'LIVE_SESSION_ERROR'))
        );
      }
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
