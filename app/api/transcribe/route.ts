import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const maxDuration = 300; // 5 minutes

export async function POST(req: NextRequest) {
  // Initialize Gemini API
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not set' }, { status: 500 });
  }
  const ai = new GoogleGenAI({ apiKey });

  try {
    const { fileUri, mimeType, name } = await req.json();
    
    if (!fileUri || !mimeType) {
      return NextResponse.json({ error: 'Missing file information' }, { status: 400 });
    }

    // Generate content
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          fileData: {
            fileUri: fileUri,
            mimeType: mimeType,
          }
        },
        'Transcribe this audio accurately. Return only the transcript text. Do not include any conversational filler.'
      ]
    });

    // Cleanup the file from Gemini
    if (name) {
      await ai.files.delete({ name }).catch(err => console.error('Failed to delete Gemini file:', err));
    }

    return NextResponse.json({ text: response.text });
  } catch (error: any) {
    console.error('Transcription error:', error);
    return NextResponse.json(
      { error: error.message || 'Transcription failed' },
      { status: 500 }
    );
  }
}
