<script lang="ts">
  import { onMount } from 'svelte';
  import * as XLSX from 'xlsx';
  import { createClient } from '@supabase/supabase-js';
  import NewListModal from '../components/NewListModal.svelte';
  import NewWordModal from '../components/NewWordModal.svelte';
  import QuizModal from '../components/QuizModal.svelte';
  import ColumnMappingModal from '../components/ColumnMappingModal.svelte';
  import VocabularyLists from '../components/VocabularyLists.svelte';
  import VocabularyTable from '../components/VocabularyTable.svelte';
  import { browser } from '$app/environment';

  // 환경 변수 체크
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Required environment variables are missing');
  }

  const supabase = browser && SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  // 로그는 브라우저에서만 출력
  if (browser && supabase) {
    console.log('Supabase connection initialized');
  }

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
    if (!browser || !supabase) return;
    
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

  // 단어장 삭제 처리
  const handleDeleteList = async (id: string) => {
    if (!browser || !supabase) return;

    const { error } = await supabase
      .from('vocabulary_lists')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting list:', error);
      alert('단어장 삭제 중 오류가 발생했습니다.');
      return;
    }

    if (selectedListId === id) {
      selectedListId = null;
      vocabularyData = [];
    }

    await loadVocabularyLists();
  };

  // 단어장 수정 처리
  const handleEditList = async (updatedList: any) => {
    if (!browser || !supabase) return;

    const { error } = await supabase
      .from('vocabulary_lists')
      .update({
        title: updatedList.title,
        description: updatedList.description,
        updated_at: new Date().toISOString()
      })
      .eq('id', updatedList.id);

    if (error) {
      console.error('Error updating list:', error);
      alert('단어장 수정 중 오류가 발생했습니다.');
      return;
    }

    await loadVocabularyLists();
  };

  // 여러 단어 추가 처리
  const handleAddWords = async (words: any[]) => {
    if (!browser || !supabase || !selectedListId) return;

    const wordsToInsert = words.map(word => ({
      ...word,
      list_id: selectedListId
    }));

    const { error } = await supabase
      .from('vocabulary_words')
      .insert(wordsToInsert);

    if (error) {
      console.error('Error adding words:', error);
      alert('단어 추가 중 오류가 발생했습니다.');
      return;
    }

    showNewWordModal = false;
    await loadVocabularyWords(selectedListId);
  };

  // 선택된 단어장의 단어들 로드
  const loadVocabularyWords = async (listId: string) => {
    if (!browser || !supabase) return;

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
    if (browser) {
      loadVocabularyLists();
    }
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
    if (!browser || !supabase) return;
    
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
    if (!browser || !supabase) return;

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

  const checkAnswers = async () => {
    try {
      const results = await Promise.all(
        quizWords.map(async (word) => {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`
            },
            body: JSON.stringify({
              model: "gpt-3.5-turbo",
              messages: [{
                role: "system",
                content: "You are a vocabulary test grader. You should compare the user's answer with the correct answer and determine if they are semantically similar enough to be considered correct. Respond with just 'true' for correct or 'false' for incorrect."
              }, {
                role: "user",
                content: `Compare these two meanings and determine if they are semantically similar enough to be considered the same:\nCorrect answer: "${word.answer}"\nUser's answer: "${word.userInput}"`
              }]
            })
          });

          if (!response.ok) {
            throw new Error('GPT API call failed');
          }

          const data = await response.json();
          const isCorrect = data.choices[0].message.content.trim().toLowerCase() === 'true';

          return { correct: isCorrect };
        })
      );

      scores = results;
    } catch (error) {
      console.error('Error checking answers:', error);
      // GPT API 호출 실패 시 기존 방식으로 채점
      scores = quizWords.map(word => ({
        correct: word.userInput.toLowerCase().trim() === word.answer.toLowerCase().trim()
      }));
    }
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
    
    <!-- 단어장 목록 섹션 -->
    <VocabularyLists
      bind:vocabularyLists
      bind:selectedListId
      bind:showNewListModal
      on:select={(event) => loadVocabularyWords(event.detail)}
      on:delete={event => handleDeleteList(event.detail)}
      on:edit={event => handleEditList(event.detail)}
    />

    <!-- 파일 업로드 섹션 -->
    {#if selectedListId}
      <div class="mb-8">
        <div class="flex justify-between items-center mb-4">
          <div>
            <h2 class="text-xl font-bold text-pink-600">📝 단어 관리</h2>
            <p class="text-sm text-gray-600 mt-1">엑셀 파일로 한 번에 여러 단어를 추가하거나, 직접 입력할 수 있어요!</p>
          </div>
          <div class="space-x-4">
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
            <button
              on:click={() => showNewWordModal = true}
              class="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-full text-sm"
            >
              ✏️ 직접 입력하기
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- 단어 목록 섹션 -->
    <VocabularyTable
      {vocabularyData}
      {headers}
      {selectedListId}
      on:quiz={generateQuiz}
    />
  </div>
</div>

<!-- Modals -->
<NewListModal
  show={showNewListModal}
  on:close={() => showNewListModal = false}
  on:create={async (event) => {
    if (!browser || !supabase) return;

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

<NewWordModal
  show={showNewWordModal}
  on:close={() => showNewWordModal = false}
  on:add={event => handleAddWords(event.detail)}
/>

<QuizModal
  show={showModal}
  {quizWords}
  {currentQuizIndex}
  {showResults}
  {scores}
  on:close={closeModal}
  on:next={handleNext}
  on:previous={handlePrevious}
  on:check={async () => await checkAnswers()}
/>

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
