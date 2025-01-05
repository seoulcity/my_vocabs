<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import WordSuggestions from './WordSuggestions.svelte';
  import { createClient } from '@supabase/supabase-js';
  
  const dispatch = createEventDispatcher();
  
  export let vocabularyData: Record<string, any>[] = [];
  export let headers: string[] = [];
  export let selectedListId: string | null = null;
  export let showNewWordModal = false;

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  function handleNewWord() {
    showNewWordModal = true;
  }

  function handleStartQuiz() {
    dispatch('quiz');
  }

  async function handleExampleGenerated(event: CustomEvent, wordId: string) {
    const { english: example, korean: translation } = event.detail;
    
    try {
      const { error } = await supabase
        .from('vocabulary_words')
        .update({ 
          example,
          example_translation: translation 
        })
        .eq('id', wordId);

      if (error) throw error;
      
      // Update local state
      vocabularyData = vocabularyData.map(word => {
        if (word.id === wordId) {
          return { ...word, example, example_translation: translation };
        }
        return word;
      });
    } catch (error) {
      console.error('Error updating example:', error);
      alert('예문 저장 중 오류가 발생했습니다.');
    }
  }
</script>

{#if vocabularyData.length > 0}
  <div class="mb-12 text-center">
    <button
      on:click={handleStartQuiz}
      class="bg-pink-500 hover:bg-pink-600 text-white font-medium py-3 px-8 rounded-full transform hover:scale-105 transition-transform duration-200 shadow-md"
    >
      ✏️ 단어 시험 시작하기
    </button>
  </div>

  <div class="overflow-x-auto bg-white rounded-lg shadow-md">
    <table class="min-w-full">
      <thead>
        <tr>
          {#each headers as header}
            <th class="px-6 py-3 border-b-2 border-pink-100 bg-pink-50 text-left text-sm font-medium text-pink-600 uppercase tracking-wider">
              {header}
            </th>
          {/each}
          <th class="px-6 py-3 border-b-2 border-pink-100 bg-pink-50 text-left text-sm font-medium text-pink-600 uppercase tracking-wider">
            예문
          </th>
        </tr>
      </thead>
      <tbody>
        {#each vocabularyData as row}
          <tr class="hover:bg-pink-50 transition-colors duration-150">
            {#each headers as header}
              <td class="px-6 py-4 border-b border-pink-100">
                {row[header]}
              </td>
            {/each}
            <td class="px-6 py-4 border-b border-pink-100">
              {#if row.example}
                <div class="bg-pink-50 p-3 rounded">
                  <p class="text-gray-800">{row.example}</p>
                  {#if row.example_translation}
                    <button
                      class="text-pink-600 hover:text-pink-700 text-sm font-medium mt-2"
                      on:click={() => row.showTranslation = !row.showTranslation}
                    >
                      {row.showTranslation ? '해석 숨기기' : '해석 보기'} 👀
                    </button>
                    {#if row.showTranslation}
                      <p class="mt-2 text-gray-600">{row.example_translation}</p>
                    {/if}
                  {/if}
                </div>
              {:else}
                <WordSuggestions
                  word={row.word}
                  meaning={row.meaning}
                  on:exampleGenerated={(event) => handleExampleGenerated(event, row.id)}
                />
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else if selectedListId}
  <div class="text-center text-pink-600 text-lg">
    <p>📝 단어를 추가하거나 엑셀 파일을 올려주세요!</p>
  </div>
{:else}
  <div class="text-center text-pink-600 text-lg">
    <p>📚 단어장을 선택하거나 새로 만들어주세요!</p>
  </div>
{/if}

<div class="fixed bottom-8 right-8">
  <button
    on:click={handleNewWord}
    disabled={!selectedListId}
    class="bg-pink-500 hover:bg-pink-600 text-white px-6 py-3 rounded-full text-lg shadow-lg transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
  >
    ✨ 단어 추가
  </button>
</div> 