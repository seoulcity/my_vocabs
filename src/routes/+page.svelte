<!-- src/routes/+page.svelte -->
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
  import NewGroupModal from '../components/NewGroupModal.svelte';
  import VocabularyManager from '../components/VocabularyManager.svelte';
  import Dashboard from '../components/Dashboard.svelte';

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
  let vocabularyLists: any[] = [];
  let selectedListId: string | null = null;
  let showNewListModal = false;
  let showNewWordModal = false;
  let showNewGroupModal = false;
  let selectedList: any = null;
  let groups: any[] = [];

  // 기존 상태 변수들 아래에 추가
  let showMappingModal = false;
  let columnMapping = {
    word: '',
    partOfSpeech: '',
    meaning: '',
    example: ''
  };

  let quizTitle = '단어 시험';

  onMount(async () => {
    await loadGroups();
    await loadVocabularyLists();
  });

  async function loadGroups() {
    const { data, error } = await supabase
      .from('vocabulary_groups')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error loading groups:', error);
      return;
    }

    groups = data;
  }

  async function handleAddGroup(event: CustomEvent) {
    const newGroup = event.detail;
    console.log('Adding new group:', newGroup);
    
    try {
      await loadGroups();  // 전체 그룹 목록을 새로 로드
      console.log('Groups loaded successfully');
      
      await loadVocabularyLists();  // 단어장 목록도 함께 새로 로드
      console.log('Vocabulary lists loaded successfully');
    } catch (error) {
      console.error('Error in handleAddGroup:', error);
    }
  }

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
    quizTitle = selectedList ? `${selectedList.title} - 단어 시험` : '단어 시험';
    showModal = true;
  };

  const generateGroupQuiz = async (event: CustomEvent<any>) => {
    const group = event.detail;
    
    // 그룹 내의 모든 단어장에서 단어 로드
    const { data, error } = await supabase
      .from('vocabulary_words')
      .select('*')
      .in('list_id', vocabularyLists
        .filter(list => list.group_id === group.id)
        .map(list => list.id)
      );

    if (error) {
      console.error('Error loading group words:', error);
      alert('단어 로드 중 오류가 발생했습니다.');
      return;
    }

    if (!data || data.length === 0) {
      alert('퀴즈를 생성할 단어가 없습니다.');
      return;
    }

    vocabularyData = data;
    quizTitle = `${group.title} - 그룹 단어 시험`;
    showModal = true;
  };

  const updateQuizCount = (event: CustomEvent<number>) => {
    const count = event.detail;
    const shuffled = [...vocabularyData]
      .sort(() => Math.random() - 0.5)
      .slice(0, count === -1 ? vocabularyData.length : count)
      .map(item => ({
        word: item.word,
        answer: item.meaning,
        example: item.example,
        example_translation: item.example_translation,
        userInput: ''
      }));

    quizWords = shuffled;
    currentQuizIndex = 0;
    showResults = false;
    scores = [];
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
                content: "You are a vocabulary test grader. Compare the user's answer with the correct answer and determine if they are similar enough to be considered correct. The answer should be considered correct if: 1) it contains any of the key words from the correct answer, or 2) it has a very similar meaning in the dictionary sense. Respond with a JSON object containing 'correct' (boolean) and 'explanation' (string) fields."
              }, {
                role: "user",
                content: `Compare these two meanings and determine if they are similar enough to be considered correct:\nCorrect answer: "${word.answer}"\nUser's answer: "${word.userInput}"`
              }]
            })
          });

          if (!response.ok) {
            throw new Error('GPT API call failed');
          }

          const data = await response.json();
          const result = JSON.parse(data.choices[0].message.content.trim());

          return {
            correct: result.correct,
            explanation: result.explanation
          };
        })
      );

      scores = results;

      // 퀴즈 결과 저장
      if (browser && supabase) {
        console.log('Saving quiz results...', {
          listId: selectedListId,
          score: results.filter(r => r.correct).length,
          total: results.length
        });

        const { data: quizData, error: quizError } = await supabase
          .from('quiz_history')
          .insert([{
            list_id: selectedListId,
            score: results.filter(r => r.correct).length,
            total_questions: results.length
          }])
          .select()
          .single();

        if (quizError) {
          console.error('Error saving quiz history:', quizError);
        } else {
          console.log('Quiz history saved successfully:', quizData);
          
          // 개별 답안 저장
          const quizAnswers = quizWords.map((word, index) => {
            // 단어 ID 찾기
            const vocabularyWord = vocabularyData.find(v => v.word === word.word);
            console.log('Mapping answer for word:', {
              word: word.word,
              vocabularyWord,
              userAnswer: word.userInput,
              isCorrect: results[index].correct
            });
            
            return {
              quiz_id: quizData.id,
              word_id: vocabularyWord?.id,
              user_answer: word.userInput,
              is_correct: results[index].correct,
              explanation: results[index].explanation
            };
          });

          console.log('Saving quiz answers:', quizAnswers);

          const { error: answersError } = await supabase
            .from('quiz_answers')
            .insert(quizAnswers);

          if (answersError) {
            console.error('Error saving quiz answers:', answersError);
          }
        }
      }
    } catch (error) {
      console.error('Error checking answers:', error);
      // GPT API 호출 실패 시 기존 방식으로 채점
      scores = quizWords.map(word => ({
        correct: word.userInput.toLowerCase().trim() === word.answer.toLowerCase().trim(),
        explanation: '단순 문자열 비교로 채점되었습니다.'
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

  async function handleSelectList(event: CustomEvent<string>) {
    const listId = event.detail;
    selectedListId = listId;
    await loadVocabularyWords(listId);
  }

  // 단어장 목록 로드
  const loadVocabularyLists = async () => {
    if (!browser || !supabase) return;
    
    console.log('Loading vocabulary lists...');
    const { data, error } = await supabase
      .from('vocabulary_lists')
      .select(`
        *,
        vocabulary_groups (
          id,
          title,
          description
        ),
        vocabulary_words (count)
      `)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error loading vocabulary lists:', error);
      return;
    }

    vocabularyLists = data.map(list => ({
      ...list,
      word_count: list.vocabulary_words[0]?.count || 0
    }));
    vocabularyLists = [...vocabularyLists];
  };

  // 단어장 삭제 처리
  const handleDeleteList = async (event: CustomEvent<string>) => {
    const listId = event.detail;
    if (!confirm('정말로 이 단어장을 삭제하시겠습니까?')) {
      return;
    }

    const { error } = await supabase
      .from('vocabulary_lists')
      .delete()
      .eq('id', listId);

    if (error) {
      console.error('Error deleting list:', error);
      alert('단어장 삭제 중 오류가 발생했습니다.');
      return;
    }

    vocabularyLists = vocabularyLists.filter(list => list.id !== listId);
    if (selectedListId === listId) {
      selectedListId = null;
      selectedList = null;
    }
  };

  // 단어장 수정 처리
  const handleEditList = async (event: CustomEvent<any>) => {
    const updatedList = event.detail;
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

    vocabularyLists = vocabularyLists.map(list =>
      list.id === updatedList.id ? { ...list, ...updatedList } : list
    );
  };

  // 선택된 단어장의 단어들 로드
  const loadVocabularyWords = async (listId: string) => {
    if (!browser || !supabase) return;

    // 단어장 정보 로드
    const { data: listData, error: listError } = await supabase
      .from('vocabulary_lists')
      .select(`
        *,
        vocabulary_groups (
          id,
          title
        )
      `)
      .eq('id', listId)
      .single();

    if (listError) {
      console.error('Error loading list:', listError);
      return;
    }

    selectedList = listData;

    // 단어 목록 로드
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
</script>

<div class="container mx-auto px-4 py-8">
  <!-- 대시보드 섹션 -->
  <Dashboard />

  <!-- 메인 콘텐츠 영역 -->
  <div class="flex gap-6">
    <!-- 왼쪽: 단어장 네비게이션 -->
    <div class="w-80 flex-shrink-0">
      <VocabularyLists
        {vocabularyLists}
        {selectedListId}
        {showNewListModal}
        {showNewGroupModal}
        {groups}
        on:select={handleSelectList}
        on:delete={handleDeleteList}
        on:edit={handleEditList}
        on:newGroup={() => showNewGroupModal = true}
        on:newList={() => showNewListModal = true}
        on:groupQuiz={generateGroupQuiz}
      />
    </div>

    <!-- 오른쪽: 단어 관리 영역 -->
    <VocabularyManager
      {selectedList}
      {selectedListId}
      {vocabularyData}
      {headers}
      on:newword={() => showNewWordModal = true}
      on:newlist={() => showNewListModal = true}
      on:quiz={generateQuiz}
      on:fileupload={(event) => {
        vocabularyData = event.detail.data;
        headers = event.detail.headers;
        showMappingModal = true;
      }}
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
  {quizTitle}
  on:close={closeModal}
  on:next={handleNext}
  on:previous={handlePrevious}
  on:check={checkAnswers}
  on:updateCount={updateQuizCount}
/>

<ColumnMappingModal
  show={showMappingModal}
  {headers}
  bind:columnMapping
  on:close={() => showMappingModal = false}
  on:save={saveVocabularyList}
/>

<NewGroupModal
  bind:show={showNewGroupModal}
  on:add={handleAddGroup}
/>

<style>
  :global(.container) {
    max-width: 1200px;
  }

  input[type="file"]::file-selector-button {
    cursor: pointer;
  }

  @keyframes loading {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }

  .skeleton-loading {
    animation: loading 1.5s infinite;
  }
</style>
