import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Server-side Gemini Client Setup (with Failover)
const API_KEYS = [
    process.env.NEXT_PUBLIC_GEMINI_API_KEY,
    process.env.NEXT_PUBLIC_GEMINI_API_KEY_2,
].filter((k): k is string => !!k?.trim());

const MODEL_NAME = 'gemini-2.5-flash-preview-tts';

const aiClients: GoogleGenAI[] = API_KEYS.map((key) => new GoogleGenAI({ apiKey: key }));
let currentClientIndex = 0;

function getActiveClient() {
    if (aiClients.length === 0) return null;
    return aiClients[currentClientIndex];
}

function rotateClient() {
    if (aiClients.length <= 1) return;
    currentClientIndex = (currentClientIndex + 1) % aiClients.length;
    console.log(`[Server TTS] Rotated to API Key index: ${currentClientIndex}`);
}

/**
 * Gemini TTS returns raw PCM (audio/L16;codec=pcm;rate=NNNN).
 * Browsers cannot play raw PCM. This function wraps it in a proper WAV header
 * so any browser can play it with the native <audio> element or Web Audio API.
 */
function pcmToWav(pcmBuffer: Buffer, sampleRate: number = 24000, channels: number = 1, bitDepth: number = 16): Buffer {
    const dataSize = pcmBuffer.length;
    const headerSize = 44;
    const wavBuffer = Buffer.alloc(headerSize + dataSize);

    // RIFF chunk descriptor
    wavBuffer.write('RIFF', 0);
    wavBuffer.writeUInt32LE(36 + dataSize, 4);   // ChunkSize
    wavBuffer.write('WAVE', 8);

    // fmt sub-chunk
    wavBuffer.write('fmt ', 12);
    wavBuffer.writeUInt32LE(16, 16);             // Subchunk1Size (16 for PCM)
    wavBuffer.writeUInt16LE(1, 20);              // AudioFormat: 1 = PCM
    wavBuffer.writeUInt16LE(channels, 22);       // NumChannels
    wavBuffer.writeUInt32LE(sampleRate, 24);     // SampleRate
    wavBuffer.writeUInt32LE(sampleRate * channels * (bitDepth / 8), 28); // ByteRate
    wavBuffer.writeUInt16LE(channels * (bitDepth / 8), 32); // BlockAlign
    wavBuffer.writeUInt16LE(bitDepth, 34);       // BitsPerSample

    // data sub-chunk
    wavBuffer.write('data', 36);
    wavBuffer.writeUInt32LE(dataSize, 40);       // Subchunk2Size

    pcmBuffer.copy(wavBuffer, 44);
    return wavBuffer;
}

/**
 * Parse sample rate from a MIME type like "audio/L16;codec=pcm;rate=24000"
 */
function parseSampleRate(mimeType: string, defaultRate = 24000): number {
    const match = mimeType.match(/rate=(\d+)/i);
    return match ? parseInt(match[1], 10) : defaultRate;
}

// Cache Directory
const CACHE_DIR = path.join(process.cwd(), '.tts-cache');
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

export async function POST(req: NextRequest) {
    try {
        const { text, voiceName = 'Kore' } = await req.json();

        if (!text) {
            return NextResponse.json({ error: 'Text required' }, { status: 400 });
        }

        // Cache key
        const hash = crypto.createHash('md5').update(`${text}:${voiceName}`).digest('hex');
        const filename = `${hash}.wav`;
        const filePath = path.join(CACHE_DIR, filename);

        // 1. Check Cache
        if (fs.existsSync(filePath)) {
            console.log(`[Server TTS] Cache HIT — "${text.slice(0, 30)}..."`);
            const fileBuffer = fs.readFileSync(filePath);
            return new NextResponse(new Uint8Array(fileBuffer), {
                headers: {
                    'Content-Type': 'audio/wav',
                    'Content-Length': fileBuffer.length.toString(),
                    'X-Cache': 'HIT',
                },
            });
        }

        console.log(`[Server TTS] Cache MISS — "${text.slice(0, 30)}..." Generating...`);

        // 2. Generate Audio with failover
        let audioData: string | null = null;
        let audioMimeType = 'audio/L16;codec=pcm;rate=24000';
        let lastError: any = null;

        for (let attempt = 0; attempt < aiClients.length; attempt++) {
            const client = getActiveClient();
            if (!client) break;

            try {
                const response = await client.models.generateContent({
                    model: MODEL_NAME,
                    contents: { role: 'user', parts: [{ text }] } as any,
                    config: {
                        responseModalities: ['AUDIO'],
                        speechConfig: {
                            voiceConfig: {
                                prebuiltVoiceConfig: { voiceName },
                            },
                            languageCode: 'en-IN', // Indian English accent
                        },
                    } as any,
                });

                const candidate = response.candidates?.[0];
                const inlineData = candidate?.content?.parts?.find((p: any) => p?.inlineData)?.inlineData;

                if (inlineData?.data) {
                    audioData = inlineData.data;
                    audioMimeType = inlineData.mimeType || audioMimeType;
                    console.log(`[Server TTS] Generated — mimeType: ${audioMimeType}, dataLen: ${audioData.length}`);
                    break;
                } else {
                    console.error('[Server TTS] No audio data. Full response:', JSON.stringify(response, null, 2));
                    throw new Error('No audio data in response');
                }
            } catch (error: any) {
                const errMsg: string = error?.message || '';
                const isRateLimited = errMsg.includes('429') || errMsg.includes('quota') || errMsg.toLowerCase().includes('ratelimit') || errMsg.includes('retryDelay');
                console.error(`[Server TTS] Attempt ${attempt + 1} failed${isRateLimited ? ' (RATE LIMITED)' : ''}:`, errMsg.slice(0, 200));
                lastError = error;
                if (isRateLimited) {
                    console.warn(`[Server TTS] Attempt ${attempt + 1} rate limited. Rotating to next key...`);
                    rotateClient();
                    lastError = error;
                    continue; // Try next key!
                }
                rotateClient(); // Rotate on other errors too (e.g. 500)
            }
        }

        if (!audioData) {
            const errMsg: string = lastError?.message || '';
            const isRateLimit = errMsg.includes('429') || errMsg.includes('quota') || errMsg.toLowerCase().includes('ratelimit') || errMsg.includes('retryDelay');

            if (isRateLimit) {
                // Return 503 if last error was rate limit
                const retryMatch = errMsg.match(/retryDelay.*?(\d+)s/);
                const retryAfter = retryMatch ? parseInt(retryMatch[1]) : 30;
                return NextResponse.json(
                    { error: 'All quotas exhausted', retryAfter, details: errMsg },
                    { status: 503, headers: { 'Retry-After': retryAfter.toString() } }
                );
            }

            return NextResponse.json(
                { error: 'TTS generation failed', details: lastError?.message },
                { status: 500 }
            );
        }

        // 3. Convert PCM → WAV for browser playback
        const pcmBuffer = Buffer.from(audioData, 'base64');
        const sampleRate = parseSampleRate(audioMimeType);
        const wavBuffer = pcmToWav(pcmBuffer, sampleRate);
        console.log(`[Server TTS] Converted PCM (${pcmBuffer.length}b) → WAV (${wavBuffer.length}b) @ ${sampleRate}Hz`);

        // 4. Save WAV to cache
        fs.writeFileSync(filePath, wavBuffer);
        console.log(`[Server TTS] Saved to cache: ${filename}`);

        return new NextResponse(new Uint8Array(wavBuffer), {
            headers: {
                'Content-Type': 'audio/wav',
                'Content-Length': wavBuffer.length.toString(),
                'X-Cache': 'MISS',
            },
        });

    } catch (error: any) {
        console.error('[Server TTS] Unexpected error:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}
