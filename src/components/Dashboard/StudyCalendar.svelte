<!-- src/components/StudyCalendar.svelte -->
<script lang="ts">
  export let studyDates: Date[] = [];
  
  let currentDate = new Date();
  let currentMonth = currentDate.getMonth();
  let currentYear = currentDate.getFullYear();

  const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
  const MONTHS = [
    '1월', '2월', '3월', '4월', '5월', '6월',
    '7월', '8월', '9월', '10월', '11월', '12월'
  ];

  function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
  }

  function getFirstDayOfMonth(year: number, month: number) {
    return new Date(year, month, 1).getDay();
  }

  function isStudyDay(date: Date) {
    return studyDates.some(studyDate => 
      studyDate.toDateString() === date.toDateString()
    );
  }

  function getConsecutiveStudyDays(date: Date) {
    let consecutiveDays = 0;
    let currentDate = new Date(date);
    
    while (isStudyDay(currentDate)) {
      consecutiveDays++;
      currentDate.setDate(currentDate.getDate() - 1);
    }
    
    return consecutiveDays;
  }

  function previousMonth() {
    if (currentMonth === 0) {
      currentMonth = 11;
      currentYear--;
    } else {
      currentMonth--;
    }
  }

  function nextMonth() {
    if (currentMonth === 11) {
      currentMonth = 0;
      currentYear++;
    } else {
      currentMonth++;
    }
  }

  $: daysInMonth = getDaysInMonth(currentYear, currentMonth);
  $: firstDayOfMonth = getFirstDayOfMonth(currentYear, currentMonth);
  $: calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  $: consecutiveStudyDays = getConsecutiveStudyDays(new Date());
</script>

<div class="bg-white rounded-lg shadow-sm p-6">
  <div class="flex justify-between items-center mb-4">
    <h3 class="text-lg font-bold text-pink-600">
      <i class="fas fa-calendar mr-2"></i>학습 캘린더
    </h3>
    <div class="flex items-center gap-2">
      <button
        on:click={previousMonth}
        class="p-1 text-gray-600 hover:text-pink-600"
      >
        ◀
      </button>
      <span class="font-medium">
        {currentYear}년 {MONTHS[currentMonth]}
      </span>
      <button
        on:click={nextMonth}
        class="p-1 text-gray-600 hover:text-pink-600"
      >
        ▶
      </button>
    </div>
  </div>

  <div class="mb-4">
    <p class="text-2xl font-bold text-gray-800">
      {consecutiveStudyDays}일
      <span class="text-sm font-normal text-gray-500">연속 학습 중</span>
    </p>
  </div>

  <div class="grid grid-cols-7 gap-1">
    {#each DAYS as day}
      <div class="text-center text-sm font-medium text-gray-600 py-2">
        {day}
      </div>
    {/each}
    
    {#each Array(firstDayOfMonth) as _}
      <div></div>
    {/each}
    
    {#each calendarDays as day}
      {@const date = new Date(currentYear, currentMonth, day)}
      {@const isStudy = isStudyDay(date)}
      {@const isToday = date.toDateString() === new Date().toDateString()}
      <div
        class="aspect-square flex items-center justify-center text-sm relative
          {isStudy ? 'bg-pink-100' : ''}
          {isToday ? 'border-2 border-pink-500' : ''}
          rounded-lg transition-colors duration-200"
      >
        <span class={isStudy ? 'text-pink-600 font-medium' : 'text-gray-600'}>
          {day}
        </span>
        {#if isStudy}
          <span class="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-pink-500 rounded-full"></span>
        {/if}
      </div>
    {/each}
  </div>
</div> 