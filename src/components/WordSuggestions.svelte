<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { createChatCompletion, type ChatMessage } from '../lib/services/openai';
  
  export let word: string;
  export let meaning: string;
  
  const dispatch = createEventDispatcher();
  
  let isLoading = false;
  let showTranslation = false;
  let error: string | null = null;
  let generatedExample = {
    english: '',
    korean: ''
  };

  async function generateExample() {
    isLoading = true;
    showTranslation = false;
    error = null;
    
    try {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: 'You are a helpful assistant that generates natural example sentences for English vocabulary words. You must respond with ONLY a JSON object, no markdown formatting or explanation. The JSON must contain exactly two fields: "english" for the example sentence and "korean" for its translation.'
        },
        {
          role: 'user',
          content: `Create a natural example sentence for the word "${word}" (meaning: ${meaning}). Respond with ONLY a JSON object in this exact format: {"english": "example sentence", "korean": "한글 번역"}`
        }
      ];

      const response = await createChatCompletion(messages);
      
      try {
        // Remove any potential markdown formatting or extra whitespace
        const cleanJson = response.message.replace(/```json\n?|\n?```/g, '').trim();
        const parsedResponse = JSON.parse(cleanJson);
        
        if (!parsedResponse.english || !parsedResponse.korean) {
          throw new Error('Invalid response format');
        }
        generatedExample = parsedResponse;
        dispatch('exampleGenerated', generatedExample);
      } catch (parseError) {
        console.error('Error parsing response:', parseError);
        console.log('Raw response:', response.message);
        error = '예문 생성 결과를 처리하는 중 오류가 발생했습니다.';
      }
    } catch (error: any) {
      console.error('Error generating example:', error);
      if (error.message.includes('API key')) {
        error = 'OpenAI API 키가 설정되지 않았습니다. 관리자에게 문의해주세요.';
      } else {
        error = '예문 생성 중 오류가 발생했습니다.';
      }
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="space-y-4">
  {#if error}
    <div class="bg-red-50 p-4 rounded-lg">
      <p class="text-red-600">{error}</p>
      <button
        on:click={() => { error = null; }}
        class="text-red-600 hover:text-red-700 text-sm font-medium mt-2"
      >
        다시 시도하기
      </button>
    </div>
  {:else if !generatedExample.english}
    <button
      on:click={generateExample}
      disabled={isLoading}
      class="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-lg text-sm flex items-center justify-center w-full"
    >
      {#if isLoading}
        <span class="animate-spin mr-2">🔄</span> 예문 생성 중...
      {:else}
        ✨ AI로 예문 만들기
      {/if}
    </button>
  {:else}
    <div class="bg-pink-50 p-4 rounded-lg">
      <p class="text-gray-800 mb-2">{generatedExample.english}</p>
      <button
        on:click={() => showTranslation = !showTranslation}
        class="text-pink-600 hover:text-pink-700 text-sm font-medium"
      >
        {showTranslation ? '해석 숨기기' : '해석 보기'} 👀
      </button>
      {#if showTranslation}
        <p class="mt-2 text-gray-600">{generatedExample.korean}</p>
      {/if}
    </div>
  {/if}
</div> 