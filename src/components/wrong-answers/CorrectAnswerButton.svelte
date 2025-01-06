<script lang="ts">
  import { createClient } from '@supabase/supabase-js';
  import { browser } from '$app/environment';

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const supabase = browser && SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  export let answerId: string;
  export let quizId: string;
  export let onAnswerMarkedCorrect: () => void;
  export let onQuizScoreUpdate: (quizId: string) => void;

  let showConfirmModal = false;

  async function markAsCorrect() {
    if (!supabase) return;

    try {
      // 답안을 정답으로 업데이트
      const { error: answerError } = await supabase
        .from('quiz_answers')
        .update({ is_correct: true })
        .eq('id', answerId);

      if (answerError) throw answerError;

      // 퀴즈 점수 업데이트
      const { data: quizData, error: quizError } = await supabase
        .from('quiz_history')
        .select('score')
        .eq('id', quizId)
        .single();

      if (quizError) throw quizError;

      const { error: updateError } = await supabase
        .from('quiz_history')
        .update({ score: quizData.score + 1 })
        .eq('id', quizId);

      if (updateError) throw updateError;

      showConfirmModal = false;
      onAnswerMarkedCorrect();
      onQuizScoreUpdate(quizId);
    } catch (error) {
      console.error('Error marking answer as correct:', error);
      alert('답안을 정답 처리하는 중 오류가 발생했습니다.');
    }
  }
</script>

<button
  class="text-sm px-3 py-1 bg-white border border-pink-500 text-pink-500 hover:bg-pink-50 rounded-full transition-colors duration-200"
  on:click={() => showConfirmModal = true}
  type="button"
>
  정답 처리
</button>

{#if showConfirmModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-lg p-6 max-w-sm w-full shadow-xl text-center">
      <h3 class="text-xl font-bold mb-4 text-gray-800">정답 처리하시겠습니까?</h3>
      <p class="text-gray-600 mb-6">
        이 답안을 정답으로 처리하면 오답 노트에서 제거됩니다.
      </p>
      <div class="flex justify-center space-x-4">
        <button
          on:click={() => showConfirmModal = false}
          class="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full"
        >
          취소
        </button>
        <button
          on:click={markAsCorrect}
          class="px-6 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-full"
        >
          확인
        </button>
      </div>
    </div>
  </div>
{/if} 