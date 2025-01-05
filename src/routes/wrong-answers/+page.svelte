<script lang="ts">
  import { onMount } from 'svelte';
  import { createClient } from '@supabase/supabase-js';
  import { browser } from '$app/environment';

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Required environment variables are missing');
  }

  const supabase = browser && SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  type QuizHistory = {
    id: string;
    list_id: string;
    score: number;
    total_questions: number;
    created_at: string;
    vocabulary_lists: {
      title: string;
    };
  };

  type QuizAnswer = {
    id: string;
    quiz_id: string;
    word_id: string;
    user_answer: string;
    is_correct: boolean;
    explanation: string;
    vocabulary_words: {
      word: string;
      meaning: string;
      part_of_speech: string;
    };
  };

  let quizHistory: QuizHistory[] = [];
  let wrongAnswers: Record<string, QuizAnswer[]> = {};
  let selectedQuizId: string | null = null;
  let isLoading = true;
  let showOnlyIncorrect = true;
  let showDeleteConfirm = false;
  let quizToDelete: string | null = null;
  let showAllWrongAnswers = false;

  onMount(async () => {
    await loadQuizHistory();
    if (showAllWrongAnswers) {
      await loadAllWrongAnswers();
    }
  });

  async function loadQuizHistory() {
    if (!browser || !supabase) return;

    try {
      // 퀴즈 기록 로드
      const { data: historyData, error: historyError } = await supabase
        .from('quiz_history')
        .select(`
          *,
          vocabulary_lists (
            title
          )
        `)
        .order('created_at', { ascending: false });

      if (historyError) throw historyError;
      quizHistory = historyData;
    } catch (error) {
      console.error('Error loading quiz history:', error);
    } finally {
      isLoading = false;
    }
  }

  // 선택된 퀴즈의 답안만 로드하는 함수
  async function loadQuizAnswers(quizId: string) {
    if (!browser || !supabase) return;

    try {
      console.log('Loading answers for quiz:', quizId);
      
      const { data: answersData, error: answersError } = await supabase
        .from('quiz_answers')
        .select(`
          *,
          vocabulary_words!inner (
            word,
            meaning,
            part_of_speech
          )
        `)
        .eq('quiz_id', quizId);

      if (answersError) {
        console.error('Error loading answers:', answersError);
        throw answersError;
      }

      console.log('Raw answers data:', answersData);

      // 틀린 답안만 필터링
      const wrongAnswersForQuiz = answersData
        .filter(answer => !answer.is_correct)
        .map(answer => ({
          id: answer.id,
          quiz_id: answer.quiz_id,
          word_id: answer.word_id,
          user_answer: answer.user_answer,
          is_correct: answer.is_correct,
          explanation: answer.explanation,
          vocabulary_words: answer.vocabulary_words
        }));

      console.log('Filtered wrong answers:', wrongAnswersForQuiz);

      // 상태 업데이트
      wrongAnswers = {
        [quizId]: wrongAnswersForQuiz
      };
    } catch (error) {
      console.error('Error loading quiz answers:', error);
    }
  }

  // 퀴즈 선택 시 해당 퀴즈의 답안 로드
  async function handleQuizSelect(quizId: string) {
    selectedQuizId = quizId;
    await loadQuizAnswers(quizId);
  }

  async function handleDeleteQuiz() {
    if (!quizToDelete || !supabase) return;

    try {
      // quiz_answers는 CASCADE로 자동 삭제됨
      const { error } = await supabase
        .from('quiz_history')
        .delete()
        .eq('id', quizToDelete);

      if (error) throw error;

      // UI 업데이트
      quizHistory = quizHistory.filter(quiz => quiz.id !== quizToDelete);
      delete wrongAnswers[quizToDelete];
      
      if (selectedQuizId === quizToDelete) {
        selectedQuizId = null;
      }

      showDeleteConfirm = false;
      quizToDelete = null;
    } catch (error) {
      console.error('Error deleting quiz:', error);
      alert('시험 기록 삭제 중 오류가 발생했습니다.');
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // 모든 틀린 답안을 로드하는 함수
  async function loadAllWrongAnswers() {
    if (!browser || !supabase) return;

    try {
      const { data: answersData, error: answersError } = await supabase
        .from('quiz_answers')
        .select(`
          *,
          vocabulary_words!inner (
            word,
            meaning,
            part_of_speech
          ),
          quiz_history!inner (
            created_at,
            vocabulary_lists (
              title
            )
          )
        `)
        .eq('is_correct', false)
        .order('created_at', { ascending: false });

      if (answersError) {
        console.error('Error loading all wrong answers:', answersError);
        throw answersError;
      }

      console.log('All wrong answers:', answersData);

      // 모든 틀린 답안을 퀴즈 ID별로 그룹화
      const groupedAnswers = answersData.reduce((acc, answer) => {
        if (!acc[answer.quiz_id]) {
          acc[answer.quiz_id] = [];
        }
        acc[answer.quiz_id].push({
          id: answer.id,
          quiz_id: answer.quiz_id,
          word_id: answer.word_id,
          user_answer: answer.user_answer,
          is_correct: answer.is_correct,
          explanation: answer.explanation,
          vocabulary_words: answer.vocabulary_words,
          quiz_date: answer.quiz_history.created_at,
          quiz_title: answer.quiz_history.vocabulary_lists.title
        });
        return acc;
      }, {});

      wrongAnswers = groupedAnswers;
    } catch (error) {
      console.error('Error loading all wrong answers:', error);
    }
  }

  // 보기 모드 변경 처리
  async function handleViewModeChange(allMode: boolean) {
    showAllWrongAnswers = allMode;
    if (allMode) {
      selectedQuizId = null;
      await loadAllWrongAnswers();
    } else {
      wrongAnswers = {};
    }
  }

  $: filteredAnswers = showAllWrongAnswers 
    ? Object.values(wrongAnswers).flat()
    : (wrongAnswers[selectedQuizId] || []);
</script>

<div class="min-h-screen bg-pink-50 py-12">
  <div class="container mx-auto px-4">
    <h1 class="text-3xl font-bold mb-8 text-center text-pink-600">
      📝 오답 노트
    </h1>

    {#if isLoading}
      <div class="text-center text-gray-600">
        <p>로딩 중...</p>
      </div>
    {:else if quizHistory.length === 0}
      <div class="text-center text-gray-600">
        <p>아직 시험 기록이 없습니다.</p>
      </div>
    {:else}
      <div class="grid gap-6 md:grid-cols-2">
        <!-- 퀴즈 목록 -->
        <div class="bg-white rounded-lg shadow-md p-6">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold text-pink-600">시험 기록</h2>
            <div class="flex items-center space-x-2">
              <button
                class="px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 {!showAllWrongAnswers ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
                on:click={() => handleViewModeChange(false)}
              >
                개별 보기
              </button>
              <button
                class="px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 {showAllWrongAnswers ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
                on:click={() => handleViewModeChange(true)}
              >
                전체 보기
              </button>
            </div>
          </div>
          <div class="space-y-4 {showAllWrongAnswers ? 'opacity-50' : ''}">
            {#each quizHistory as quiz}
              <div
                class="relative w-full text-left p-4 rounded-lg border-2 transition-colors duration-200 cursor-pointer group
                  {selectedQuizId === quiz.id
                    ? 'border-pink-500 bg-pink-50'
                    : 'border-gray-200 hover:border-pink-300 hover:bg-pink-50'}"
                on:click={() => !showAllWrongAnswers && handleQuizSelect(quiz.id)}
              >
                <div class="flex justify-between items-start">
                  <div>
                    <p class="font-medium text-gray-800">{quiz.vocabulary_lists.title}</p>
                    <p class="text-sm text-gray-600 mt-1">
                      {formatDate(quiz.created_at)}
                    </p>
                  </div>
                  <div class="text-right">
                    <p class="font-bold text-pink-600">
                      {quiz.score} / {quiz.total_questions}
                    </p>
                    <p class="text-sm text-gray-600 mt-1">
                      {Math.round((quiz.score / quiz.total_questions) * 100)}%
                    </p>
                  </div>
                </div>
                <button
                  class="absolute top-2 right-2 p-2 text-gray-400 hover:text-pink-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  on:click|stopPropagation={() => {
                    quizToDelete = quiz.id;
                    showDeleteConfirm = true;
                  }}
                  title="시험 기록 삭제"
                >
                  🗑️
                </button>
              </div>
            {/each}
          </div>
        </div>

        <!-- 틀린 답안 목록 -->
        <div class="bg-white rounded-lg shadow-md p-6">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold text-pink-600">
              {showAllWrongAnswers ? '전체 틀린 답안' : '틀린 답안'}
            </h2>
            {#if filteredAnswers.length > 0}
              <div class="text-sm text-gray-600">
                총 {filteredAnswers.length}개의 틀린 답안
              </div>
            {/if}
          </div>

          {#if !selectedQuizId && !showAllWrongAnswers}
            <p class="text-center text-gray-600">
              시험을 선택하면 틀린 답안을 볼 수 있습니다.
            </p>
          {:else if filteredAnswers.length === 0}
            <p class="text-center text-gray-600">
              {showAllWrongAnswers ? '아직 틀린 답안이 없습니다.' : '이 시험에서는 틀린 답안이 없습니다! 🎉'}
            </p>
          {:else}
            <div class="space-y-4">
              {#each filteredAnswers as answer}
                <div class="p-4 rounded-lg bg-pink-50 border border-pink-200">
                  <div class="flex justify-between items-start">
                    <div class="flex-1">
                      <div class="flex items-center gap-2">
                        <p class="font-bold text-gray-800">{answer.vocabulary_words.word}</p>
                        {#if answer.vocabulary_words.part_of_speech}
                          <span class="text-xs px-2 py-1 bg-pink-100 text-pink-600 rounded-full">
                            {answer.vocabulary_words.part_of_speech}
                          </span>
                        {/if}
                      </div>
                      {#if showAllWrongAnswers}
                        <p class="text-xs text-gray-500 mt-1">
                          {answer.quiz_title} ({formatDate(answer.quiz_date)})
                        </p>
                      {/if}
                      <div class="mt-2">
                        <p class="text-sm text-gray-600">내 답: {answer.user_answer || '미입력'}</p>
                        <p class="text-sm text-pink-600 font-medium">정답: {answer.vocabulary_words.meaning}</p>
                        {#if answer.explanation}
                          <p class="text-xs text-gray-500 mt-2 bg-white p-2 rounded-lg">
                            💡 {answer.explanation}
                          </p>
                        {/if}
                      </div>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

{#if showDeleteConfirm}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-lg p-6 max-w-sm w-full shadow-xl text-center">
      <h3 class="text-xl font-bold mb-4 text-gray-800">시험 기록을 삭제하시겠습니까?</h3>
      <p class="text-gray-600 mb-6">
        이 작업은 되돌릴 수 없으며, 관련된 모든 답안 기록도 함께 삭제됩니다.
      </p>
      <div class="flex justify-center space-x-4">
        <button
          on:click={() => {
            showDeleteConfirm = false;
            quizToDelete = null;
          }}
          class="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full"
        >
          취소
        </button>
        <button
          on:click={handleDeleteQuiz}
          class="px-6 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-full"
        >
          삭제
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .container {
    max-width: 1200px;
  }
</style> 