<script lang="ts">
  export let totalStats: {
    totalLists: number;
    studyDays: number;
  };
</script>

<div class="bg-white rounded-lg shadow-sm p-6">
  <h3 class="text-lg font-bold text-pink-600 mb-4">
    <i class="fas fa-bullseye mr-2"></i>전체 현황
  </h3>
  <div class="space-y-4">
    <div>
      <p class="text-3xl font-bold text-gray-800">
        {totalStats.totalLists}개
        <span class="text-sm font-normal text-gray-500">단어장</span>
      </p>
    </div>
    <div class="pt-4 border-t border-gray-100">
      <p class="text-3xl font-bold text-gray-800">
        {totalStats.studyDays}일
        <span class="text-sm font-normal text-gray-500">학습일</span>
      </p>
    </div>
  </div>
</div> 