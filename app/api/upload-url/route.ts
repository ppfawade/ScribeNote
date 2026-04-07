import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { fileName, mimeType, size } = await req.json();
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not set' }, { status: 500 });
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': size.toString(),
        'X-Goog-Upload-Header-Content-Type': mimeType,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file: {
          display_name: fileName,
        }
      })
    });

    const uploadUrl = response.headers.get('x-goog-upload-url');
    if (!uploadUrl) {
      const errorText = await response.text();
      throw new Error(`Failed to get upload URL: ${errorText}`);
    }

    return NextResponse.json({ uploadUrl });
  } catch (error: any) {
    console.error('Upload URL error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
