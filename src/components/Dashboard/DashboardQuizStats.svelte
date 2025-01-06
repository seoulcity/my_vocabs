<!-- src/components/Dashboard/DashboardQuizStats.svelte -->
<script lang="ts">
  export let quizStats: {
    totalQuizzes: number;
    totalWords: number;
    averageScore: number;
    scoresTrend: number[];
  };
</script>

<div class="bg-white rounded-lg shadow-sm p-6">
  <h3 class="text-lg font-bold text-pink-600 mb-4">
    <i class="fas fa-chart-bar mr-2"></i>퀴즈 성적
  </h3>
  <div class="space-y-4">
    <div>
      <div class="flex items-baseline gap-2">
        <p class="text-3xl font-bold text-gray-800">
          {Math.round(quizStats.averageScore)}%
        </p>
        <p class="text-sm text-gray-500">누적 평균</p>
        {#if quizStats.scoresTrend.length > 0}
          <p class="text-lg font-bold {quizStats.scoresTrend[0] >= quizStats.averageScore ? 'text-green-600' : 'text-pink-600'}">
            {Math.round(quizStats.scoresTrend[0])}%
          </p>
          <p class="text-sm text-gray-500">최근</p>
        {/if}
      </div>
      <p class="text-sm text-gray-600 mt-1">
        총 {quizStats.totalQuizzes}회 시험,
        {quizStats.totalWords}개 단어
      </p>
    </div>
    {#if quizStats.scoresTrend.length > 1}
      <div class="space-y-1">
        <p class="text-xs text-gray-500">최근 5회 성적 추이</p>
        <div class="h-8 flex items-end gap-1">
          {#each quizStats.scoresTrend as score}
            <div
              class="w-full bg-gradient-to-t rounded-t transition-all duration-300
                {score >= quizStats.averageScore ? 'from-green-500 to-green-300' : 'from-pink-500 to-pink-300'}"
              style="height: {score}%"
              title="{Math.round(score)}%"
            >
              <div class="text-xs text-white text-center mt-1">
                {Math.round(score)}%
              </div>
            </div>
          {/each}
        </div>
        <div class="flex justify-between text-xs text-gray-400">
          <span>5회 전</span>
          <span>최근</span>
        </div>
      </div>
    {/if}
  </div>
</div> 