import { browser } from '$app/environment';

const OCR_SECRET_KEY = browser ? import.meta.env.VITE_NAVER_OCR_SECRET_KEY : undefined;
const OCR_INVOKE_URL = browser ? import.meta.env.VITE_NAVER_OCR_INVOKE_URL : undefined;

if (browser && (!OCR_SECRET_KEY || !OCR_INVOKE_URL)) {
  console.error('Naver OCR credentials are missing. Please check your environment variables.');
}

export async function recognizeText(imageData: string, lang: 'ko' | 'en'): Promise<string> {
  try {
    const response = await fetch('/api/ocr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageData, lang })
    });

    if (!response.ok) {
      throw new Error('OCR request failed');
    }

    const result = await response.json();
    return result.text;
  } catch (error) {
    console.error('Naver OCR Error:', error);
    throw error;
  }
} 