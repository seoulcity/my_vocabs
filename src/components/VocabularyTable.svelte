<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  export let vocabularyData: Record<string, any>[] = [];
  export let headers: string[] = [];
  export let selectedListId: string | null = null;
  export let showNewWordModal = false;

  function handleNewWord() {
    showNewWordModal = true;
  }

  function handleStartQuiz() {
    dispatch('quiz');
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