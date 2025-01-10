// src/routes/api/ocr/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
});

const PROMPTS = {
  ko: "이 이미지에 쓰여진 한글 필기를 읽어주세요. 텍스트만 응답하고 다른 설명은 하지 마세요.",
  en: "Read the English handwritten text in this image. Respond with ONLY the text, no additional words or explanations."
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { imageData, lang } = await request.json();

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPTS[lang] },
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
  } catch (error) {
    console.error('OCR Error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}; 