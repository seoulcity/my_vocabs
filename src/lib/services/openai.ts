// src/lib/services/openai.ts
import OpenAI from 'openai';
import { browser } from '$app/environment';

const OPENAI_API_KEY = browser ? import.meta.env.VITE_OPENAI_API_KEY : undefined;

if (browser) {
    if (!OPENAI_API_KEY) {
        console.error('OpenAI API key is missing. Please check your environment variables.');
        console.log('Available env vars:', import.meta.env);
    } else {
        console.log('OpenAI API key is configured');
    }
}

// OpenAI 클라이언트 인스턴스 생성
export const openai = OPENAI_API_KEY ? new OpenAI({
    apiKey: OPENAI_API_KEY,
    dangerouslyAllowBrowser: true // 브라우저에서 API 키 사용 허용
}) : null;

export type ChatMessage = {
    role: 'system' | 'user' | 'assistant';
    content: string;
};

export type ChatCompletionResponse = {
    message: string;
    raw: any; // 필요한 경우 상세 타입 정의
};

export async function createChatCompletion(
    messages: ChatMessage[],
    model: string = 'gpt-4o-mini'
): Promise<ChatCompletionResponse> {
    if (!openai) {
        throw new Error('OpenAI client is not initialized. Please check your API key.');
    }

    try {
        const completion = await openai.chat.completions.create({
            model,
            messages,
        });

        return {
            message: completion.choices[0].message.content || '',
            raw: completion
        };
    } catch (error) {
        console.error('OpenAI API Error:', error);
        throw error;
    }
}

export async function createVisionCompletion(
    imageUrl: string,
    prompt: string = "What text is written in this image? Respond with ONLY the text, no additional words."
): Promise<ChatCompletionResponse> {
    if (!openai) {
        throw new Error('OpenAI client is not initialized. Please check your API key.');
    }

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        {
                            type: "image_url",
                            image_url: {
                                url: imageUrl,
                            },
                        },
                    ],
                },
            ],
            max_tokens: 100,
        });

        return {
            message: completion.choices[0].message.content || '',
            raw: completion
        };
    } catch (error) {
        console.error('OpenAI Vision API Error:', error);
        throw error;
    }
} 