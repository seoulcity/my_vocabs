<script lang="ts">
  import { onMount } from 'svelte';
  import * as XLSX from 'xlsx';
  import { createClient } from '@supabase/supabase-js';
  import NewListModal from '../components/NewListModal.svelte';
  import NewWordModal from '../components/NewWordModal.svelte';
  import QuizModal from '../components/QuizModal.svelte';
  import ColumnMappingModal from '../components/ColumnMappingModal.svelte';

  const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );

  console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
  console.log('Supabase connection initialized');

  let fileInput: HTMLInputElement;
  let vocabularyData: Record<string, any>[] = [];
  let headers: string[] = [];
  let showModal = false;
  let quizWords: { word: string; answer: string; userInput: string }[] = [];
  let currentQuizIndex = 0;
  let showResults = false;
  let scores: { correct: boolean }[] = [];
  
  // 단어장 관련 상태
  let vocabularyLists = [];
  let selectedListId: string | null = null;
  let showNewListModal = false;
  let showNewWordModal = false;

  // 기존 상태 변수들 아래에 추가
  let showMappingModal = false;
  let columnMapping = {
    word: '',
    partOfSpeech: '',
    meaning: '',
    example: ''
  };

  // 단어장 목록 로드
  const loadVocabularyLists = async () => {
    console.log('Loading vocabulary lists...');
    const { data, error } = await supabase
      .from('vocabulary_lists')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading lists:', error.message, error.details, error.hint);
      return;
    }

    console.log('Loaded vocabulary lists:', data);
    vocabularyLists = data;
  };

  // 선택된 단어장의 단어들 로드
  const loadVocabularyWords = async (listId: string) => {
    const { data, error } = await supabase
      .from('vocabulary_words')
      .select('*')
      .eq('list_id', listId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading words:', error);
      return;
    }

    vocabularyData = data;
    headers = ['word', 'part_of_speech', 'meaning', 'example'];
  };

  onMount(() => {
    loadVocabularyLists();
  });

  const handleFileUpload = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (!file || !selectedListId) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];
      vocabularyData = jsonData;
      
      if (jsonData.length > 0) {
        headers = Object.keys(jsonData[0]);
        // 컬럼 매핑 초기화
        columnMapping = {
          word: '',
          partOfSpeech: '',
          meaning: '',
          example: ''
        };
        showMappingModal = true;
      }
    };
    
    reader.readAsArrayBuffer(file);
  };

  // 데이터베이스에 단어장 저장
  const saveVocabularyList = async () => {
    try {
      if (!selectedListId) return;

      // 매핑된 컬럼을 사용하여 단어 데이터 변환
      const wordsToInsert = vocabularyData.map(row => ({
        list_id: selectedListId,
        word: row[columnMapping.word],
        part_of_speech: row[columnMapping.partOfSpeech] || null,
        meaning: row[columnMapping.meaning],
        example: row[columnMapping.example] || null
      }));

      // 단어 데이터 저장
      const { error: wordsError } = await supabase
        .from('vocabulary_words')
        .insert(wordsToInsert);

      if (wordsError) throw wordsError;

      alert('단어가 성공적으로 추가되었습니다!');
      showMappingModal = false;
      
      // 테이블 새로고침을 위한 데이터 다시 로드
      await loadVocabularyWords(selectedListId);
    } catch (error) {
      console.error('Error saving vocabulary:', error);
      alert('단어 저장 중 오류가 발생했습니다.');
    }
  };

  // 단어장 목록 로드
  const loadVocabularyList = async () => {
    const { data, error } = await supabase
      .from('vocabulary_words')
      .select(`
        id,
        word,
        part_of_speech,
        meaning,
        example
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading vocabulary:', error);
      return;
    }

    vocabularyData = data;
    headers = ['word', 'part_of_speech', 'meaning', 'example'];
  };

  const generateQuiz = () => {
    if (vocabularyData.length === 0) return;

    const shuffled = [...vocabularyData]
      .sort(() => Math.random() - 0.5)
      .slice(0, 10)
      .map(item => ({
        word: item.word,
        answer: item.meaning,
        userInput: ''
      }));

    quizWords = shuffled;
    currentQuizIndex = 0;
    showResults = false;
    scores = [];
    showModal = true;
  };

  const handleNext = () => {
    if (currentQuizIndex < quizWords.length - 1) {
      currentQuizIndex++;
    }
  };

  const handlePrevious = () => {
    if (currentQuizIndex > 0) {
      currentQuizIndex--;
    }
  };

  const checkAnswers = () => {
    scores = quizWords.map(word => ({
      correct: word.userInput.toLowerCase().trim() === word.answer.toLowerCase().trim()
    }));
    showResults = true;
  };

  const closeModal = () => {
    showModal = false;
    quizWords = [];
    currentQuizIndex = 0;
    showResults = false;
    scores = [];
  };

  const handleKeyPress = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      if (currentQuizIndex < quizWords.length - 1) {
        handleNext();
      } else {
        checkAnswers();
      }
    }
  };
</script>

<div class="min-h-screen bg-pink-50 flex flex-col">
  <div class="container mx-auto px-4 py-12 flex-1">
    <h1 class="text-3xl font-bold mb-12 text-center text-pink-600">
      ✨ 꾜리의 Power 단어공부 ✨
    </h1>
    
    <!-- 단어장 선택 및 생성 섹션 -->
    <div class="mb-8">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-bold text-pink-600">📚 단어장</h2>
        <button
          on:click={() => showNewListModal = true}
          class="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-full text-sm"
        >
          ✨ 새 단어장 만들기
        </button>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {#each vocabularyLists as list}
          <button
            on:click={() => {
              selectedListId = list.id;
              loadVocabularyWords(list.id);
            }}
            class="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow
              {selectedListId === list.id ? 'ring-2 ring-pink-500' : ''}"
          >
            <h3 class="font-bold text-gray-800">{list.title}</h3>
            {#if list.description}
              <p class="text-sm text-gray-600 mt-1">{list.description}</p>
            {/if}
          </button>
        {/each}
      </div>
    </div>

    <!-- 파일 업로드 섹션 -->
    {#if selectedListId}
      <div class="mb-8">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold text-pink-600">📝 단어 관리</h2>
          <div class="space-x-4">
            <button
              on:click={() => showNewWordModal = true}
              class="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-full text-sm"
            >
              ✏️ 단어 추가
            </button>
            <label class="inline-block">
              <span class="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-full text-sm cursor-pointer">
                📥 엑셀 파일로 추가
              </span>
              <input
                type="file"
                accept=".xlsx,.xls"
                on:change={handleFileUpload}
                bind:this={fileInput}
                class="hidden"
              />
            </label>
          </div>
        </div>
      </div>
    {/if}

    <!-- 단어 목록 및 시험 섹션 -->
    {#if vocabularyData.length > 0}
      <div class="mb-12 text-center">
        <button
          on:click={generateQuiz}
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
  </div>
</div>

<!-- 새 단어장 생성 모달 -->
<NewListModal
  show={showNewListModal}
  on:close={() => showNewListModal = false}
  on:create={async (event) => {
    const { data, error } = await supabase
      .from('vocabulary_lists')
      .insert([event.detail])
      .select()
      .single();

    if (error) {
      console.error('Error creating list:', error.message, error.details, error.hint);
      alert('단어장 생성 중 오류가 발생했습니다: ' + error.message);
      return;
    }

    console.log('Created new list:', data);
    showNewListModal = false;
    await loadVocabularyLists();
  }}
/>

<!-- 새 단어 추가 모달 -->
<NewWordModal
  show={showNewWordModal}
  on:close={() => showNewWordModal = false}
  on:add={async (event) => {
    if (!selectedListId) return;

    const { error } = await supabase
      .from('vocabulary_words')
      .insert([{ ...event.detail, list_id: selectedListId }]);

    if (error) {
      console.error('Error adding word:', error);
      alert('단어 추가 중 오류가 발생했습니다.');
      return;
    }

    showNewWordModal = false;
    await loadVocabularyWords(selectedListId);
  }}
/>

<!-- 단어 시험 모달 -->
<QuizModal
  show={showModal}
  {quizWords}
  {currentQuizIndex}
  {showResults}
  {scores}
  on:close={closeModal}
  on:next={handleNext}
  on:previous={handlePrevious}
  on:check={checkAnswers}
/>

<!-- 컬럼 매핑 모달 -->
<ColumnMappingModal
  show={showMappingModal}
  {headers}
  bind:columnMapping
  on:close={() => showMappingModal = false}
  on:save={saveVocabularyList}
/>

<style>
  .container {
    max-width: 1200px;
  }

  input[type="file"] {
    position: relative;
  }

  input[type="file"]::file-selector-button {
    cursor: pointer;
  }

  :global(body) {
    background-color: #fdf2f8;
  }
</style>
