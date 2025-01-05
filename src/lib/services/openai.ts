import OpenAI from 'openai';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
    console.error('OpenAI API key is missing. Please check your environment variables.');
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
    model: string = 'gpt-4-turbo-preview'
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