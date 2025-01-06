<!-- src/components/VocabularyTable.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { createChatCompletion, type ChatMessage } from '../lib/services/openai';
  import { createClient } from '@supabase/supabase-js';
  import { onMount } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  export let vocabularyData: any[] = [];
  export let headers: string[] = [];
  export let selectedListId: string | null = null;
  export let selectedList: any = null;

  const ITEMS_PER_PAGE = 25;
  let currentPage = 1;
  let searchQuery = '';
  let selectedPartOfSpeech = '';
  let generatingExampleFor: string | null = null;
  let showTranslationFor: Set<string> = new Set();
  let examples: Map<string, { english: string; korean: string }> = new Map();
  let currentExample: { english: string; korean: string | null } | null = null;
  let editingWord: any = null;
  let tempWord = { word: '', part_of_speech: '', meaning: '', example: '' };
  let newlyAddedWords: Set<string> = new Set();

  const partsOfSpeech = [
    { value: '', label: '전체' },
    { value: 'noun', label: '명사' },
    { value: 'verb', label: '동사' },
    { value: 'adjective', label: '형용사' },
    { value: 'adverb', label: '부사' },
    { value: 'preposition', label: '전치사' },
    { value: 'conjunction', label: '접속사' },
    { value: 'interjection', label: '감탄사' },
    { value: 'pronoun', label: '대명사' },
  ];

  // 새로운 단어 감지 및 강조
  $: {
    const now = new Date().getTime();
    vocabularyData.forEach(word => {
      // 최근 1분 이내에 생성된 단어는 새로운 단어로 표시
      // (페이지 새로고침 시에도 최근 추가된 단어를 식별하기 위함)
      const createdAt = new Date(word.created_at).getTime();
      if (now - createdAt < 60000) {
        newlyAddedWords.add(word.id);
      }
    });
  }

  $: filteredData = vocabularyData
    .map(item => ({
      ...item,
      isNew: newlyAddedWords.has(item.id)
    }))
    .sort((a, b) => {
      // 새로 추가된 단어를 먼저 정렬
      if (a.isNew && !b.isNew) return -1;
      if (!a.isNew && b.isNew) return 1;
      // 그 다음 최신 순으로 정렬
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
    .filter(item => {
      const matchesSearch = searchQuery === '' || 
        item.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.meaning.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesPartOfSpeech = selectedPartOfSpeech === '' || 
        item.part_of_speech === selectedPartOfSpeech;
      
      return matchesSearch && matchesPartOfSpeech;
    });

  $: totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  $: paginatedData = filteredData.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page when search changes
  $: {
    if (searchQuery || selectedPartOfSpeech) {
      currentPage = 1;
    }
  }

  function handlePrevPage() {
    if (currentPage > 1) {
      currentPage--;
    }
  }

  function handleNextPage() {
    if (currentPage < totalPages) {
      currentPage++;
    }
  }

  function handlePageClick(page: number) {
    currentPage = page;
  }

  function getPageNumbers(current: number, total: number): (number | string)[] {
    const pages: (number | string)[] = [];
    
    // Always show first page
    pages.push(1);
    
    if (current > 3) {
      pages.push('...');
    }
    
    // Show pages around current page
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
      pages.push(i);
    }
    
    if (current < total - 2) {
      pages.push('...');
    }
    
    // Always show last page if there is more than one page
    if (total > 1) {
      pages.push(total);
    }
    
    return pages;
  }

  $: pageNumbers = getPageNumbers(currentPage, totalPages);

  async function generateExample(word: string) {
    if (generatingExampleFor === word) return;
    
    generatingExampleFor = word;
    examples.delete(word);
    examples = examples; // trigger reactivity

    try {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: 'You are a helpful assistant that generates example sentences for English words. Provide a natural, modern example that clearly demonstrates the word usage. Respond with a JSON object containing "english" and "korean" fields.'
        },
        {
          role: 'user',
          content: `Generate a simple, natural example sentence using the word "${word}". The sentence should be easy to understand and reflect modern usage.`
        }
      ];

      const response = await createChatCompletion(messages);
      
      try {
        const cleanJson = response.message.replace(/```json\n?|\n?```/g, '').trim();
        const example = JSON.parse(cleanJson);
        examples.set(word, example);
        examples = examples; // trigger reactivity

        // DB에 예문 저장
        const wordItem = vocabularyData.find(item => item.word === word);
        if (wordItem) {
          const { error } = await supabase
            .from('vocabulary_words')
            .update({
              example: example.english,
              example_translation: example.korean
            })
            .eq('id', wordItem.id);

          if (error) {
            console.error('Error saving example:', error);
            throw error;
          }

          // 로컬 상태 업데이트
          vocabularyData = vocabularyData.map(item =>
            item.id === wordItem.id
              ? { ...item, example: example.english, example_translation: example.korean }
              : item
          );
        }
      } catch (error) {
        console.error('Error parsing example:', error);
      }
    } catch (error) {
      console.error('Error generating example:', error);
    } finally {
      generatingExampleFor = null;
    }
  }

  function toggleTranslation(word: string) {
    if (showTranslationFor.has(word)) {
      showTranslationFor.delete(word);
    } else {
      showTranslationFor.add(word);
    }
    showTranslationFor = new Set(showTranslationFor); // trigger reactivity
  }

  async function handleEditWord(word: any) {
    editingWord = word;
    tempWord = { ...word };
  }

  async function handleSaveWord() {
    if (!editingWord) return;

    try {
      const { error } = await supabase
        .from('vocabulary_words')
        .update({
          word: tempWord.word,
          part_of_speech: tempWord.part_of_speech,
          meaning: tempWord.meaning,
          example: tempWord.example,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingWord.id);

      if (error) throw error;

      vocabularyData = vocabularyData.map(item =>
        item.id === editingWord.id ? { ...item, ...tempWord } : item
      );
      editingWord = null;
    } catch (error) {
      console.error('Error updating word:', error);
      alert('단어 수정 중 오류가 발생했습니다.');
    }
  }

  async function handleDeleteWord(wordId: string) {
    if (!confirm('정말로 이 단어를 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('vocabulary_words')
        .delete()
        .eq('id', wordId);

      if (error) throw error;

      vocabularyData = vocabularyData.filter(item => item.id !== wordId);
    } catch (error) {
      console.error('Error deleting word:', error);
      alert('단어 삭제 중 오류가 발생했습니다.');
    }
  }

  // 새로운 단어가 추가되었을 때의 이벤트 핸들러
  function handleNewWords(event: CustomEvent) {
    const newWordIds = event.detail;
    newWordIds.forEach(id => newlyAddedWords.add(id));
    newlyAddedWords = newlyAddedWords; // trigger reactivity
    
    // 2초 후에 강조 표시 제거
    setTimeout(() => {
      newWordIds.forEach(id => newlyAddedWords.delete(id));
      newlyAddedWords = newlyAddedWords; // trigger reactivity
    }, 2000);
  }

  onMount(() => {
    // 컴포넌트가 마운트되면 이벤트 리스너 추가
    const element = document.querySelector('vocabulary-table');
    if (element) {
      element.addEventListener('newWords', handleNewWords);
    }

    return () => {
      // 컴포넌트가 언마운트되면 이벤트 리스너 제거
      if (element) {
        element.removeEventListener('newWords', handleNewWords);
      }
    };
  });
</script>

<div class="bg-white rounded-lg shadow-sm p-6">
  {#if selectedListId}
    <!-- List Info Header -->
    <div class="mb-6">
      <div class="flex items-center text-sm text-gray-600 mb-1">
        <span class="mr-2">📁</span>
        {#if selectedList?.vocabulary_groups}
          {selectedList.vocabulary_groups.title}
        {/if}
        <span class="mx-2">›</span>
        {#if selectedList}
          {selectedList.title}
        {/if}
      </div>
      {#if selectedList?.description}
        <p class="text-gray-600 text-sm">{selectedList.description}</p>
      {/if}
    </div>

    {#if vocabularyData.length > 0}
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-bold text-gray-800">
          단어 목록 ({filteredData.length}개)
        </h3>
        <button
          on:click={() => dispatch('quiz')}
          class="bg-pink-100 hover:bg-pink-200 text-pink-600 px-4 py-2 rounded-full text-sm flex items-center"
        >
          <i class="fas fa-graduation-cap mr-2"></i>퀴즈 시작하기
        </button>
      </div>

      <!-- Search and Filter -->
      <div class="flex gap-4 mb-4">
        <div class="flex-1">
          <input
            type="text"
            bind:value={searchQuery}
            placeholder="단어나 의미로 검색..."
            class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-pink-500"
          />
        </div>
        <div class="w-48">
          <select
            bind:value={selectedPartOfSpeech}
            class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-pink-500"
          >
            {#each partsOfSpeech as pos}
              <option value={pos.value}>{pos.label}</option>
            {/each}
          </select>
        </div>
      </div>

      <!-- Table -->
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="w-[25%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">단어</th>
              <th class="w-[20%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">품사</th>
              <th class="w-[25%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">의미</th>
              <th class="w-[20%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">예문</th>
              <th class="w-[10%] px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">작업</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {#each paginatedData as item}
              <tr class="border-t hover:bg-pink-50 group {item.isNew ? 'bg-pink-50/50' : ''}">
                {#if editingWord?.id === item.id}
                  <td class="px-4 py-3">
                    <input
                      type="text"
                      bind:value={tempWord.word}
                      class="w-full p-2 border rounded-lg"
                    />
                  </td>
                  <td class="px-4 py-3">
                    <select
                      bind:value={tempWord.part_of_speech}
                      class="w-full p-2 border rounded-lg"
                    >
                      <option value="">선택해주세요</option>
                      {#each partsOfSpeech as pos}
                        <option value={pos.value}>{pos.label}</option>
                      {/each}
                    </select>
                  </td>
                  <td class="px-4 py-3">
                    <input
                      type="text"
                      bind:value={tempWord.meaning}
                      class="w-full p-2 border rounded-lg"
                    />
                  </td>
                  <td class="px-4 py-3 space-x-2">
                    <button
                      on:click={handleSaveWord}
                      class="text-pink-500 hover:text-pink-600 text-sm"
                    >
                      저장
                    </button>
                    <button
                      on:click={() => editingWord = null}
                      class="text-gray-500 hover:text-gray-600 text-sm"
                    >
                      취소
                    </button>
                  </td>
                {:else}
                  <td class="px-4 py-3">
                    <div class="flex items-center">
                      {#if item.isNew}
                        <span class="inline-block w-2 h-2 bg-pink-500 rounded-full mr-2"></span>
                      {/if}
                      {item.word}
                    </div>
                  </td>
                  <td class="px-4 py-3 text-gray-600">{item.part_of_speech || '-'}</td>
                  <td class="px-4 py-3">{item.meaning}</td>
                  <td class="px-4 py-3 text-gray-600">
                    {#if item.example}
                      <div class="flex items-start justify-between min-h-[4rem]">
                        <div class="flex-1">
                          <p class="text-gray-800">{item.example}</p>
                          <button
                            on:click={() => toggleTranslation(item.word)}
                            class="text-pink-500 hover:text-pink-600 text-sm mt-1"
                          >
                            {showTranslationFor.has(item.word) ? '해석 숨기기' : '해석 보기'} 👀
                          </button>
                          {#if showTranslationFor.has(item.word) && item.example_translation}
                            <p class="text-gray-600 mt-1">{item.example_translation}</p>
                          {/if}
                        </div>
                      </div>
                    {:else}
                      <div class="min-h-[4rem]">
                        {#if examples.has(item.word)}
                          <div class="mt-2">
                            <p class="text-gray-800">{examples.get(item.word).english}</p>
                            <button
                              on:click={() => toggleTranslation(item.word)}
                              class="text-pink-500 hover:text-pink-600 text-sm mt-1"
                            >
                              {showTranslationFor.has(item.word) ? '해석 숨기기' : '해석 보기'} 👀
                            </button>
                            {#if showTranslationFor.has(item.word)}
                              <p class="text-gray-600 mt-1">{examples.get(item.word).korean}</p>
                            {/if}
                          </div>
                        {/if}
                      </div>
                    {/if}
                  </td>
                  <td class="px-4 py-3 text-right space-x-2">
                    <div class="relative inline-block group/tooltip">
                      <button
                        on:click={() => handleEditWord(item)}
                        class="text-gray-400 hover:text-pink-500 hover:bg-pink-50 p-1.5 rounded-full hidden group-hover:inline-block transition-colors duration-200"
                      >
                        ✏️
                        <span class="absolute top-1/2 -translate-y-1/2 right-full mr-1 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover/tooltip:opacity-100 whitespace-nowrap pointer-events-none">
                          단어 수정
                        </span>
                      </button>
                    </div>
                    <div class="relative inline-block group/tooltip">
                      <button
                        on:click={() => generateExample(item.word)}
                        class="text-gray-400 hover:text-pink-500 hover:bg-pink-50 p-1.5 rounded-full hidden group-hover:inline-block transition-colors duration-200"
                        disabled={generatingExampleFor === item.word}
                      >
                        {#if generatingExampleFor === item.word}
                          <span class="animate-spin inline-block">🔄</span>
                        {:else}
                          {item.example ? '🔄' : '✨'}
                        {/if}
                        <span class="absolute top-1/2 -translate-y-1/2 right-full mr-1 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover/tooltip:opacity-100 whitespace-nowrap pointer-events-none">
                          {item.example ? '예문 다시 생성' : '예문 생성하기'}
                        </span>
                      </button>
                    </div>
                    <div class="relative inline-block group/tooltip">
                      <button
                        on:click={() => handleDeleteWord(item.id)}
                        class="text-gray-400 hover:text-pink-500 hover:bg-pink-50 p-1.5 rounded-full hidden group-hover:inline-block transition-colors duration-200"
                      >
                        🗑️
                        <span class="absolute top-1/2 -translate-y-1/2 right-full mr-1 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover/tooltip:opacity-100 whitespace-nowrap pointer-events-none">
                          단어 삭제
                        </span>
                      </button>
                    </div>
                  </td>
                {/if}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      {#if totalPages > 1}
        <div class="flex justify-center items-center space-x-2 mt-4">
          <button
            on:click={handlePrevPage}
            class="px-3 py-1 rounded-md text-gray-600 hover:text-pink-600 disabled:text-gray-400"
            disabled={currentPage === 1}
          >
            ◀
          </button>
          
          {#each pageNumbers as page}
            {#if typeof page === 'number'}
              <button
                on:click={() => handlePageClick(page)}
                class="px-3 py-1 rounded-md {currentPage === page ? 'bg-pink-500 text-white' : 'text-gray-600 hover:text-pink-600'}"
              >
                {page}
              </button>
            {:else}
              <span class="px-2">...</span>
            {/if}
          {/each}
          
          <button
            on:click={handleNextPage}
            class="px-3 py-1 rounded-md text-gray-600 hover:text-pink-600 disabled:text-gray-400"
            disabled={currentPage === totalPages}
          >
            ▶
          </button>
        </div>
      {/if}
    {:else}
      <div class="text-center py-12 text-gray-500">
        <p class="mb-2">아직 단어가 없습니다</p>
        <p class="text-sm">엑셀 파일을 업로드하거나 직접 입력해보세요!</p>
      </div>
    {/if}
  {:else}
    <div class="text-center py-12 text-gray-500">
      <p class="mb-2">단어장을 선택해주세요</p>
      <p class="text-sm">왼쪽 목록에서 단어장을 선택하면 단어 목록이 표시됩니다</p>
    </div>
  {/if}
</div> 