<script lang="ts">
  export let totalWords: number;
  export let recentWords: {
    count: number;
    trend: number;
  };
</script>

<div class="bg-white rounded-lg shadow-sm p-6">
  <h3 class="text-lg font-bold text-pink-600 mb-4">
    <i class="fas fa-book mr-2"></i>학습 현황
  </h3>
  <div class="space-y-4">
    <div>
      <p class="text-3xl font-bold text-gray-800 flex items-baseline">
        {totalWords}
        <span class="text-sm font-normal text-gray-500 ml-2">누적 단어</span>
        {#if recentWords.count > 0}
          <span class="ml-2 text-lg font-bold text-green-600">
            +{recentWords.count}
          </span>
        {/if}
      </p>
      {#if recentWords.trend !== 0}
        <p class="text-sm {recentWords.trend > 0 ? 'text-green-600' : 'text-pink-600'} mt-1">
          {recentWords.trend > 0 ? '▲' : '▼'}
          {Math.abs(Math.round(recentWords.trend))}% 전주 대비
        </p>
      {/if}
    </div>
    <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
      <div
        class="h-full bg-gradient-to-r from-pink-500 to-pink-300"
        style="width: 100%"
      ></div>
      <div
        class="h-full bg-gradient-to-r from-green-500 to-green-300 -mt-2"
        style="width: {(recentWords.count / totalWords) * 100}%"
      ></div>
    </div>
    <p class="text-xs text-gray-500">
      최근 7일간 {recentWords.count}개의 새로운 단어를 학습했어요!
    </p>
  </div>
</div> 