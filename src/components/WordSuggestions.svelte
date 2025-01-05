<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import wd from 'word-definition';
  import nlp from 'compromise';
  
  const dispatch = createEventDispatcher();
  
  export let word = '';
  let suggestions: Array<{
    word: string;
    definition?: string;
    partOfSpeech?: string;
  }> = [];
  let loading = false;
  let searchTimeout: NodeJS.Timeout | null = null;

  async function searchWord(searchTerm: string) {
    if (!searchTerm.trim()) {
      suggestions = [];
      return;
    }

    loading = true;
    try {
      // 유사 단어 찾기
      const doc = nlp(searchTerm);
      const terms = doc.terms().json() as Array<{ text: string; }>;
      const similar = terms
        .map(t => t.text)
        .filter((value, index, self) => self.indexOf(value) === index)
        .slice(0, 5);

      // 각 단어의 정의 찾기
      const results = await Promise.all(
        similar.map(async (word) => {
          return new Promise((resolve) => {
            wd.getDef(word, "en", null, (definition: any) => {
              resolve({
                word,
                definition: definition.definition || '정의를 찾을 수 없습니다.',
                partOfSpeech: definition.category || '품사 정보 없음'
              });
            });
          });
        })
      );

      suggestions = results as Array<{
        word: string;
        definition?: string;
        partOfSpeech?: string;
      }>;
    } catch (error) {
      console.error('Error searching word:', error);
      suggestions = [];
    } finally {
      loading = false;
    }
  }

  function handleSelect(suggestion: typeof suggestions[0]) {
    dispatch('select', suggestion);
    suggestions = []; // 선택 후 제안 목록 숨기기
  }

  function clearSearchTimeout() {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
      searchTimeout = null;
    }
  }

  $: {
    clearSearchTimeout();
    if (word) {
      searchTimeout = setTimeout(() => searchWord(word), 300);
    } else {
      suggestions = [];
    }
  }

  onMount(() => {
    return () => {
      clearSearchTimeout();
    };
  });
</script>

{#if suggestions.length > 0}
  <div class="mt-2 bg-white rounded-lg shadow-lg overflow-hidden border border-pink-100 absolute w-full z-10">
    {#each suggestions as suggestion}
      <button
        on:click={() => handleSelect(suggestion)}
        class="w-full px-4 py-2 text-left hover:bg-pink-50 transition-colors duration-150 border-b border-pink-100 last:border-b-0"
      >
        <div class="font-medium text-gray-800">{suggestion.word}</div>
        {#if suggestion.partOfSpeech}
          <div class="text-sm text-pink-600">{suggestion.partOfSpeech}</div>
        {/if}
        {#if suggestion.definition}
          <div class="text-sm text-gray-600 truncate">{suggestion.definition}</div>
        {/if}
      </button>
    {/each}
  </div>
{/if}

{#if loading}
  <div class="mt-2 text-center text-pink-600">
    <span class="inline-block animate-spin mr-2">🔍</span>
    검색 중...
  </div>
{/if} 