import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
});

export const POST: RequestHandler = async ({ request }) => {
  const OCR_SECRET_KEY = import.meta.env.VITE_NAVER_OCR_SECRET_KEY;
  const OCR_INVOKE_URL = import.meta.env.VITE_NAVER_OCR_INVOKE_URL;

  try {
    const { imageData, lang } = await request.json();

    // 영어인 경우 OpenAI Vision API 사용
    if (lang === 'en') {
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "What text is written in this image? Respond with ONLY the text, no additional words." },
                {
                  type: "image_url",
                  image_url: {
                    url: imageData,
                  },
                },
              ],
            },
          ],
          max_tokens: 100,
        });

        return json({ text: completion.choices[0].message.content || '' });
      } catch (error) {
        console.error('OpenAI Vision API Error:', error);
        return new Response('OpenAI Vision API failed', { status: 500 });
      }
    }

    // 한국어인 경우 Naver OCR 사용
    if (!OCR_SECRET_KEY || !OCR_INVOKE_URL) {
      return new Response('OCR credentials not configured', { status: 500 });
    }

    const timestamp = new Date().getTime();
    
    const requestBody = {
      version: "V2",
      requestId: timestamp.toString(),
      timestamp: timestamp,
      lang: "ko",
      images: [
        {
          format: "jpg",
          name: "test",
          data: imageData.split(',')[1]
        }
      ]
    };

    const response = await fetch(OCR_INVOKE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OCR-SECRET': OCR_SECRET_KEY
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      return new Response('OCR request failed', { status: response.status });
    }

    const result = await response.json();
    
    if (result.images && result.images[0].fields) {
      const text = result.images[0].fields
        .map((field: any) => field.inferText)
        .join(' ')
        .trim();
      
      return json({ text });
    }

    return json({ text: '' });
  } catch (error) {
    console.error('OCR Error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}; 