import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const TTS_MODEL = 'gemini-2.5-flash-tts';

type TTSAudioPayload = {
  data: string;
  mimeType?: string;
};

function extractAudioData(response: unknown): TTSAudioPayload | undefined {
  if (!response || typeof response !== 'object') {
    return undefined;
  }

  const typedResponse = response as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } }>;
  };

  const inlineData = typedResponse.candidates?.[0]?.content?.parts?.find((part) => part?.inlineData?.data)?.inlineData;
  if (!inlineData?.data) {
    return undefined;
  }

  return {
    data: inlineData.data,
    mimeType: inlineData.mimeType,
  };
}

export async function POST(request: Request) {
  const key = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'Server AI key not configured.' }, { status: 500 });
  }

  const body = (await request.json()) as { text?: string };
  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: 'Text is required.' }, { status: 400 });
  }

  try {
    const client = new GoogleGenAI({ apiKey: key });
    const response = await client.models.generateContent({
      model: TTS_MODEL,
      contents: text,
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Kore',
            },
          },
        },
      },
    });

    const audioPayload = extractAudioData(response);
    if (!audioPayload?.data) {
      return NextResponse.json({ error: 'No audio content in Gemini response.' }, { status: 502 });
    }

    return NextResponse.json(audioPayload);
  } catch (error) {
    return NextResponse.json({ error: 'TTS request failed.', details: String(error) }, { status: 500 });
  }
}
