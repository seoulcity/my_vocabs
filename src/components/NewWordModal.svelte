<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { createChatCompletion, type ChatMessage } from '../lib/services/openai';
  import { slide } from 'svelte/transition';
  
  export let show = false;
  
  const dispatch = createEventDispatcher();

  const PARTS_OF_SPEECH = [
    '명사(noun)',
    '동사(verb)',
    '형용사(adjective)',
    '부사(adverb)',
    '전치사(preposition)',
    '접속사(conjunction)',
    '감탄사(interjection)'
  ];
  
  type WordEntry = {
    word: string;
    part_of_speech: string;
    meaning: string;
    isNew?: boolean;
  };

  let wordEntries: WordEntry[] = [
    { word: '', part_of_speech: '', meaning: '', isNew: true }
  ];
  let isGeneratingMeanings = false;
  let error: string | null = null;

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && show) {
      handleClose();
    }
  }

  function handleClose() {
    wordEntries = [createEmptyEntry()];
    dispatch('close');
  }

  function handleAdd() {
    const validEntries = wordEntries
      .filter(entry => entry.word.trim() && entry.meaning.trim())
      .map(({ isNew, ...entry }) => entry);
    
    if (validEntries.length > 0) {
      dispatch('add', validEntries);
      resetForm();
    }
  }

  function resetForm() {
    wordEntries = [{ word: '', part_of_speech: '', meaning: '', isNew: true }];
    error = null;
  }

  function handleInput(index: number, event?: Event) {
    const entry = wordEntries[index];
    
    // 알파벳 입력 체크
    if (event && event.target instanceof HTMLInputElement && event.target.name === 'word') {
      const input = event.target;
      const value = input.value;
      // 알파벳과 공백만 허용
      const sanitizedValue = value.replace(/[^a-zA-Z\s]/g, '');
      if (value !== sanitizedValue) {
        input.value = sanitizedValue;
        entry.word = sanitizedValue;
      }
    }

    if (entry.isNew && (entry.word.trim() || entry.meaning.trim())) {
      entry.isNew = false;
      wordEntries = [
        ...wordEntries,
        { word: '', part_of_speech: '', meaning: '', isNew: true }
      ];
    }
  }

  function removeEntry(index: number) {
    if (wordEntries.length > 1) {
      wordEntries = wordEntries.filter((_, i) => i !== index);
    }
  }

  async function generateMeanings() {
    const wordsToTranslate = wordEntries
      .filter(entry => entry.word.trim() && !entry.meaning.trim())
      .map(entry => entry.word.trim());

    if (wordsToTranslate.length === 0) {
      error = '의미를 생성할 단어가 없습니다.';
      return;
    }

    isGeneratingMeanings = true;
    error = null;

    try {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: 'You are a helpful assistant that provides Korean meanings for English words. For each word, provide a concise and accurate Korean meaning. Respond with ONLY a JSON object where keys are English words and values are Korean meanings.'
        },
        {
          role: 'user',
          content: `Provide Korean meanings for these English words: ${wordsToTranslate.join(', ')}`
        }
      ];

      const response = await createChatCompletion(messages);
      
      try {
        const cleanJson = response.message.replace(/```json\n?|\n?```/g, '').trim();
        const meanings = JSON.parse(cleanJson);
        
        wordEntries = wordEntries.map(entry => {
          if (entry.word.trim() && !entry.meaning.trim() && meanings[entry.word.trim()]) {
            return { ...entry, meaning: meanings[entry.word.trim()] };
          }
          return entry;
        });
      } catch (parseError) {
        console.error('Error parsing response:', parseError);
        error = '의미 생성 결과를 처리하는 중 오류가 발생했습니다.';
      }
    } catch (error: any) {
      console.error('Error generating meanings:', error);
      if (error.message.includes('API key')) {
        error = 'OpenAI API 키가 설정되지 않았습니다. 관리자에게 문의해주세요.';
      } else {
        error = '의미 생성 중 오류가 발생했습니다.';
      }
    } finally {
      isGeneratingMeanings = false;
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  });
</script>

{#if show}
  <div
    transition:slide={{ duration: 200 }}
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
  >
    <div
      class="bg-white rounded-lg p-6 w-full max-w-4xl transform transition-all duration-200 relative"
      in:slide={{ duration: 200, delay: 100 }}
    >
      <button
        on:click={handleClose}
        class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors duration-200"
        title="닫기"
      >
        ✕
      </button>
      
      <h2 class="text-xl font-bold mb-4">단어 추가하기</h2>
      
      <div class="bg-blue-50 p-4 rounded-lg mb-6">
        <h3 class="font-medium text-blue-800 mb-2">💡 사용 방법</h3>
        <ul class="text-sm text-blue-700 space-y-1">
          <li>• 단어는 알파벳만 입력할 수 있어요</li>
          <li>• 단어를 입력하고 '의미 자동 생성' 버튼을 누르면 GPT가 의미를 생성해줘요</li>
          <li>• 의미는 직접 입력하거나 수정할 수도 있어요</li>
          <li>• 새로운 줄은 자동으로 추가되니 계속해서 입력하시면 돼요</li>
        </ul>
      </div>

      {#if error}
        <div class="bg-red-50 p-4 rounded-lg mb-6">
          <p class="text-red-600">{error}</p>
          <button
            on:click={() => error = null}
            class="text-red-600 hover:text-red-700 text-sm font-medium mt-2"
          >
            닫기
          </button>
        </div>
      {/if}

      <div class="overflow-x-auto">
        <div class="flex justify-end mb-4">
          <button
            on:click={generateMeanings}
            disabled={isGeneratingMeanings}
            class="bg-white hover:bg-pink-50 text-pink-600 border-2 border-pink-400 px-4 py-2 rounded-lg text-sm flex items-center transition-colors duration-200"
          >
            {#if isGeneratingMeanings}
              <span class="animate-spin mr-2">🔄</span> 의미 생성 중...
            {:else}
              ✨ 의미 자동 생성
            {/if}
          </button>
        </div>

        <table class="w-full mb-6">
          <thead>
            <tr>
              <th class="px-4 py-2 bg-pink-50 text-pink-600 font-medium text-sm text-left">단어*</th>
              <th class="px-4 py-2 bg-pink-50 text-pink-600 font-medium text-sm text-left">품사</th>
              <th class="px-4 py-2 bg-pink-50 text-pink-600 font-medium text-sm text-left">의미*</th>
              <th class="px-4 py-2 bg-pink-50 text-pink-600 font-medium text-sm text-left w-10"></th>
            </tr>
          </thead>
          <tbody>
            {#each wordEntries as entry, i}
              <tr class="border-b border-pink-100">
                <td class="px-4 py-2">
                  <input
                    type="text"
                    name="word"
                    bind:value={entry.word}
                    on:input={(e) => handleInput(i, e)}
                    class="w-full p-2 border rounded-lg"
                    placeholder="단어를 입력하세요"
                  />
                </td>
                <td class="px-4 py-2">
                  <select
                    bind:value={entry.part_of_speech}
                    on:change={() => handleInput(i)}
                    class="w-full p-2 border rounded-lg"
                  >
                    <option value="">선택해주세요</option>
                    {#each PARTS_OF_SPEECH as pos}
                      <option value={pos}>{pos}</option>
                    {/each}
                  </select>
                </td>
                <td class="px-4 py-2">
                  <input
                    type="text"
                    bind:value={entry.meaning}
                    on:input={() => handleInput(i)}
                    class="w-full p-2 border rounded-lg"
                    placeholder="의미를 입력하세요"
                  />
                </td>
                <td class="px-4 py-2">
                  {#if !entry.isNew}
                    <button
                      on:click={() => removeEntry(i)}
                      class="text-gray-400 hover:text-pink-500"
                      title="삭제"
                    >
                      🗑️
                    </button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="flex justify-end space-x-4">
        <button
          on:click={handleClose}
          class="px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          취소
        </button>
        <button
          on:click={handleAdd}
          class="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600"
          disabled={!wordEntries.some(entry => entry.word.trim() && entry.meaning.trim())}
        >
          추가하기
        </button>
      </div>
    </div>
  </div>
{/if} 