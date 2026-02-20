import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY?.trim();
const ELEVENLABS_BASE_URL = process.env.ELEVENLABS_BASE_URL?.trim() || 'https://api.elevenlabs.io';
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID?.trim() || 'EXAVITQu4vr4xnSDxMaL';
const DEFAULT_MODEL_ID = process.env.ELEVENLABS_MODEL_ID?.trim() || 'eleven_flash_v2_5';
const DEFAULT_OUTPUT_FORMAT = process.env.ELEVENLABS_OUTPUT_FORMAT?.trim() || 'mp3_44100_128';

const CACHE_DIR = path.join(process.cwd(), '.tts-cache');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

type TTSRequestBody = {
  text?: string;
  voiceId?: string;
  modelId?: string;
  outputFormat?: string;
  languageCode?: string;
};

function resolveAudioResponseMeta(outputFormat: string): { extension: string; contentType: string; accept: string } {
  if (outputFormat.startsWith('pcm_')) {
    const sampleRate = outputFormat.split('_')[1] || '24000';
    return {
      extension: 'pcm',
      contentType: `audio/L16; rate=${sampleRate}; channels=1`,
      accept: 'audio/pcm',
    };
  }

  if (outputFormat.startsWith('mp3_')) {
    return { extension: 'mp3', contentType: 'audio/mpeg', accept: 'audio/mpeg' };
  }

  if (outputFormat.startsWith('opus_')) {
    return { extension: 'opus', contentType: 'audio/ogg; codecs=opus', accept: 'audio/ogg' };
  }

  return { extension: 'audio', contentType: 'application/octet-stream', accept: 'audio/*' };
}

export async function POST(req: NextRequest) {
  try {
    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { error: 'ELEVENLABS_API_KEY is not configured on the server.' },
        { status: 500 },
      );
    }

    const {
      text,
      voiceId,
      modelId,
      outputFormat,
      languageCode,
    } = (await req.json()) as TTSRequestBody;

    if (!text?.trim()) {
      return NextResponse.json({ error: 'Text required' }, { status: 400 });
    }

    const resolvedVoiceId = voiceId?.trim() || DEFAULT_VOICE_ID;
    const resolvedModelId = modelId?.trim() || DEFAULT_MODEL_ID;
    const resolvedOutputFormat = outputFormat?.trim() || DEFAULT_OUTPUT_FORMAT;
    const audioMeta = resolveAudioResponseMeta(resolvedOutputFormat);

    const hash = crypto
      .createHash('md5')
      .update(`${text}:${resolvedVoiceId}:${resolvedModelId}:${resolvedOutputFormat}:${languageCode || ''}`)
      .digest('hex');

    const filename = `${hash}.${audioMeta.extension}`;
    const filePath = path.join(CACHE_DIR, filename);

    if (fs.existsSync(filePath)) {
      const fileBuffer = fs.readFileSync(filePath);
      return new NextResponse(new Uint8Array(fileBuffer), {
        headers: {
          'Content-Type': audioMeta.contentType,
          'Content-Length': fileBuffer.length.toString(),
          'X-Cache': 'HIT',
        },
      });
    }

    const endpoint = new URL(
      `/v1/text-to-speech/${encodeURIComponent(resolvedVoiceId)}`,
      ELEVENLABS_BASE_URL,
    );

    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        Accept: audioMeta.accept,
      },
      body: JSON.stringify({
        text,
        model_id: resolvedModelId,
        output_format: resolvedOutputFormat,
        language_code: languageCode,
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      return NextResponse.json(
        {
          error: 'ElevenLabs TTS generation failed',
          details: errText || upstream.statusText,
          status: upstream.status,
        },
        { status: upstream.status === 429 ? 503 : 500 },
      );
    }

    const upstreamContentType = upstream.headers.get('content-type') || audioMeta.contentType;

    const audioBuffer = Buffer.from(await upstream.arrayBuffer());
    fs.writeFileSync(filePath, audioBuffer);

    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: {
        'Content-Type': upstreamContentType,
        'Content-Length': audioBuffer.length.toString(),
        'X-Cache': 'MISS',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal Server Error', details: error?.message || 'Unknown error' },
      { status: 500 },
    );
  }
}
