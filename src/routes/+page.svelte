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
  import StudyCalendar from '../components/StudyCalendar.svelte';
  import DashboardLearningStatus from '../components/DashboardLearningStatus.svelte';
  import DashboardQuizStats from '../components/DashboardQuizStats.svelte';

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

  // 대시보드 데이터 타입 정의
  type DashboardStats = {
    recentWords: {
      count: number;
      trend: number;
    };
    quizStats: {
      totalQuizzes: number;
      totalWords: number;
      averageScore: number;
      scoresTrend: number[];
    };
    totalStats: {
      totalWords: number;
      totalLists: number;
      studyDays: number;
    };
    studyDates: Date[];
  };

  let dashboardStats: DashboardStats | null = null;

  // 대시보드 데이터 로드
  async function loadDashboardStats() {
    if (!browser || !supabase) return;

    try {
      // 1. 최근 7일간 추가된 단어 수
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const { data: recentWords, error: recentWordsError } = await supabase
        .from('vocabulary_words')
        .select('created_at')
        .gte('created_at', sevenDaysAgo.toISOString());

      const { data: previousWords, error: previousWordsError } = await supabase
        .from('vocabulary_words')
        .select('created_at')
        .gte('created_at', fourteenDaysAgo.toISOString())
        .lt('created_at', sevenDaysAgo.toISOString());

      // 2. 퀴즈 통계
      const { data: quizzes, error: quizzesError } = await supabase
        .from('quiz_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      // 3. 전체 통계
      const { data: totalWords, error: totalWordsError } = await supabase
        .from('vocabulary_words')
        .select('created_at');

      const { data: totalLists, error: totalListsError } = await supabase
        .from('vocabulary_lists')
        .select('id');

      if (recentWordsError || previousWordsError || quizzesError || totalWordsError || totalListsError) {
        throw new Error('Error loading dashboard stats');
      }

      // 학습일 계산 (단어 추가 또는 퀴즈를 푼 날짜의 unique 개수)
      const studyDates = new Set<string>();
      const allStudyDates: Date[] = [];
      
      totalWords?.forEach(word => {
        const date = new Date(word.created_at);
        const dateString = date.toDateString();
        if (!studyDates.has(dateString)) {
          studyDates.add(dateString);
          allStudyDates.push(date);
        }
      });
      
      quizzes?.forEach(quiz => {
        const date = new Date(quiz.created_at);
        const dateString = date.toDateString();
        if (!studyDates.has(dateString)) {
          studyDates.add(dateString);
          allStudyDates.push(date);
        }
      });

      // 퀴즈 점수 계산
      const quizScores = quizzes?.map(quiz => (quiz.score / quiz.total_questions) * 100) || [];
      const averageScore = quizScores.length > 0
        ? quizScores.reduce((a, b) => a + b, 0) / quizScores.length
        : 0;

      dashboardStats = {
        recentWords: {
          count: recentWords?.length || 0,
          trend: previousWords?.length
            ? ((recentWords?.length || 0) - previousWords.length) / previousWords.length * 100
            : 0
        },
        quizStats: {
          totalQuizzes: quizzes?.length || 0,
          totalWords: quizzes?.reduce((sum, quiz) => sum + quiz.total_questions, 0) || 0,
          averageScore,
          scoresTrend: quizScores.reverse()
        },
        totalStats: {
          totalWords: totalWords?.length || 0,
          totalLists: totalLists?.length || 0,
          studyDays: studyDates.size
        },
        studyDates: allStudyDates
      };

      console.log('Dashboard stats:', dashboardStats);
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }
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

  onMount(async () => {
    await loadGroups();
    await loadVocabularyLists();
    await loadDashboardStats();
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
    showModal = true;
  };

  const updateQuizCount = (event: CustomEvent<number>) => {
    const count = event.detail;
    const shuffled = [...vocabularyData]
      .sort(() => Math.random() - 0.5)
      .slice(0, count)
      .map(item => ({
        word: item.word,
        answer: item.meaning,
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
</script>

<div class="container mx-auto px-4 py-8">
  <!-- 대시보드 섹션 -->
  <div class="mb-8 grid grid-cols-1 md:grid-cols-4 gap-6">
    {#if dashboardStats}
      <DashboardLearningStatus
        totalWords={dashboardStats.totalStats.totalWords}
        recentWords={dashboardStats.recentWords}
      />
      <DashboardQuizStats
        quizStats={dashboardStats.quizStats}
      />

      <!-- 누적 통계 -->
      <div class="bg-white rounded-lg shadow-sm p-6">
        <h3 class="text-lg font-bold text-pink-600 mb-4">
          <i class="fas fa-bullseye mr-2"></i>전체 현황
        </h3>
        <div class="space-y-4">
          <div>
            <p class="text-3xl font-bold text-gray-800">
              {dashboardStats.totalStats.totalLists}개
              <span class="text-sm font-normal text-gray-500">단어장</span>
            </p>
          </div>
          <div class="pt-4 border-t border-gray-100">
            <p class="text-3xl font-bold text-gray-800">
              {dashboardStats.totalStats.studyDays}일
              <span class="text-sm font-normal text-gray-500">학습일</span>
            </p>
          </div>
        </div>
      </div>

      <!-- 학습 캘린더 -->
      <StudyCalendar studyDates={dashboardStats.studyDates} />
    {:else}
      <!-- 스켈레톤 UI -->
      <div class="bg-white rounded-lg shadow-sm p-6 relative overflow-hidden">
        <div class="animate-pulse">
          <div class="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div class="space-y-3">
            <div class="h-8 bg-gray-200 rounded w-2/3"></div>
            <div class="h-4 bg-gray-200 rounded w-1/2"></div>
            <div class="h-2 bg-gray-200 rounded w-full"></div>
            <div class="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
        <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent skeleton-loading"></div>
      </div>
      <div class="bg-white rounded-lg shadow-sm p-6 relative overflow-hidden">
        <div class="animate-pulse">
          <div class="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div class="space-y-3">
            <div class="h-8 bg-gray-200 rounded w-2/3"></div>
            <div class="h-4 bg-gray-200 rounded w-1/2"></div>
            <div class="space-y-1 mt-4">
              <div class="h-8 bg-gray-200 rounded w-full"></div>
              <div class="flex justify-between">
                <div class="h-3 bg-gray-200 rounded w-12"></div>
                <div class="h-3 bg-gray-200 rounded w-12"></div>
              </div>
            </div>
          </div>
        </div>
        <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent skeleton-loading"></div>
      </div>
      <div class="bg-white rounded-lg shadow-sm p-6 relative overflow-hidden">
        <div class="animate-pulse">
          <div class="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div class="grid grid-cols-7 gap-1">
            {#each Array(7) as _}
              <div class="h-4 bg-gray-200 rounded"></div>
            {/each}
            {#each Array(35) as _}
              <div class="aspect-square bg-gray-200 rounded"></div>
            {/each}
          </div>
        </div>
        <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent skeleton-loading"></div>
      </div>
    {/if}
  </div>

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
      />
    </div>

    <!-- 오른쪽: 단어 관리 영역 -->
    <div class="flex-1">
      {#if selectedListId}
        <div class="bg-white rounded-lg shadow-sm p-6">
          <!-- 단어장 헤더 -->
          <div class="flex justify-between items-center mb-6">
            <div>
              <h2 class="text-xl font-bold text-gray-800">
                {selectedList?.title}
                <span class="text-sm font-normal text-gray-500 ml-2">
                  ({vocabularyData.length}개 단어)
                </span>
              </h2>
              {#if selectedList?.description}
                <p class="text-sm text-gray-600 mt-1">{selectedList.description}</p>
              {/if}
            </div>
            <div class="flex items-center gap-3">
              <button
                on:click={() => showNewWordModal = true}
                class="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-full text-sm flex items-center"
              >
                <i class="fas fa-plus mr-2"></i>단어 추가
              </button>
              <label class="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-full text-sm flex items-center cursor-pointer">
                <i class="fas fa-file-import mr-2"></i>엑셀 가져오기
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

          <!-- 단어 테이블 -->
          <VocabularyTable
            {vocabularyData}
            {headers}
            {selectedListId}
            {selectedList}
            on:quiz={generateQuiz}
          />
        </div>
      {:else}
        <div class="bg-white rounded-lg shadow-sm p-6 text-center">
          <div class="max-w-md mx-auto">
            <i class="fas fa-book text-6xl text-gray-300 mb-4"></i>
            <h2 class="text-xl font-bold text-gray-800 mb-2">단어장을 선택해주세요</h2>
            <p class="text-gray-600 mb-6">왼쪽 목록에서 단어장을 선택하면 단어 목록이 표시됩니다</p>
            <button
              on:click={() => showNewListModal = true}
              class="bg-pink-500 hover:bg-pink-600 text-white px-6 py-3 rounded-full text-sm inline-flex items-center"
            >
              <i class="fas fa-plus mr-2"></i>새 단어장 만들기
            </button>
          </div>
        </div>
      {/if}
    </div>
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
