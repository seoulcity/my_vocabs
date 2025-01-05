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

  onMount(async () => {
    await loadQuizHistory();
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

      // 틀린 답안 로드
      const { data: answersData, error: answersError } = await supabase
        .from('quiz_answers')
        .select(`
          *,
          vocabulary_words (
            word,
            meaning,
            part_of_speech
          )
        `)
        .eq('is_correct', false);

      if (answersError) throw answersError;

      // 퀴즈 ID별로 틀린 답안 그룹화
      wrongAnswers = answersData.reduce((acc, answer) => {
        if (!acc[answer.quiz_id]) {
          acc[answer.quiz_id] = [];
        }
        acc[answer.quiz_id].push(answer);
        return acc;
      }, {});
    } catch (error) {
      console.error('Error loading quiz history:', error);
    } finally {
      isLoading = false;
    }
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

  $: filteredAnswers = wrongAnswers[selectedQuizId] || [];
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
          <h2 class="text-xl font-bold mb-4 text-pink-600">시험 기록</h2>
          <div class="space-y-4">
            {#each quizHistory as quiz}
              <div
                class="relative w-full text-left p-4 rounded-lg border-2 transition-colors duration-200 cursor-pointer group
                  {selectedQuizId === quiz.id
                    ? 'border-pink-500 bg-pink-50'
                    : 'border-gray-200 hover:border-pink-300 hover:bg-pink-50'}"
                on:click={() => selectedQuizId = quiz.id}
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
            <h2 class="text-xl font-bold text-pink-600">틀린 답안</h2>
            {#if filteredAnswers.length > 0}
              <div class="text-sm text-gray-600">
                총 {filteredAnswers.length}개의 틀린 답안
              </div>
            {/if}
          </div>

          {#if !selectedQuizId}
            <p class="text-center text-gray-600">
              시험을 선택하면 틀린 답안을 볼 수 있습니다.
            </p>
          {:else if filteredAnswers.length === 0}
            <p class="text-center text-gray-600">
              이 시험에서는 틀린 답안이 없습니다! 🎉
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
                      <p class="text-sm text-gray-600 mt-2">정답: {answer.vocabulary_words.meaning}</p>
                      <p class="text-sm text-pink-600 mt-1">내 답: {answer.user_answer}</p>
                      {#if answer.explanation}
                        <p class="text-xs text-gray-500 mt-2 bg-white p-2 rounded-lg">
                          💡 {answer.explanation}
                        </p>
                      {/if}
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