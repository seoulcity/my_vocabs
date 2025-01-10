<!-- src/components/wrong-answers/WrongAnswersStats.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import Chart from 'chart.js/auto';
  import { browser } from '$app/environment';

  export let wrongAnswers: Record<string, any[]>;
  export let quizHistory: any[];
  export let groups: any[];

  let canvas: HTMLCanvasElement;
  let chart: Chart;
  let selectedView: 'all' | 'group' | 'list' = 'all';
  let selectedGroupId: string | null = null;
  let selectedListId: string | null = null;

  // 단어장 목록을 가져오는 함수
  function getVocabularyLists() {
    const lists = new Map();
    quizHistory.forEach(quiz => {
      if (!lists.has(quiz.list_id)) {
        lists.set(quiz.list_id, {
          id: quiz.list_id,
          title: quiz.vocabulary_lists.title,
          groupId: quiz.vocabulary_lists.vocabulary_groups?.id,
          groupTitle: quiz.vocabulary_lists.vocabulary_groups?.title
        });
      }
    });
    return Array.from(lists.values());
  }

  // 선택된 그룹의 단어장 목록을 가져오는 함수
  function getGroupLists(groupId: string) {
    return getVocabularyLists().filter(list => list.groupId === groupId);
  }

  // 단어별 틀린 횟수를 계산하는 함수
  function calculateWrongCounts() {
    const wrongCounts = new Map<string, number>();
    const allAnswers = Object.values(wrongAnswers).flat();
    console.log('All wrong answers:', allAnswers);

    allAnswers.forEach(answer => {
      const word = answer.vocabulary_words.word;
      wrongCounts.set(word, (wrongCounts.get(word) || 0) + 1);
    });

    console.log('Wrong counts:', Array.from(wrongCounts.entries()));
    return wrongCounts;
  }

  // 그룹별 틀린 단어 횟수를 계산하는 함수
  function calculateGroupWrongCounts(targetGroupId?: string) {
    const groupCounts = new Map<string, Map<string, number>>();
    const allAnswers = Object.values(wrongAnswers).flat();
    console.log('Calculating group wrong counts. All answers:', allAnswers);

    allAnswers.forEach(answer => {
      const quiz = quizHistory.find(q => q.id === answer.quiz_id);
      const groupId = quiz?.vocabulary_lists.vocabulary_groups?.id;
      const word = answer.vocabulary_words.word;

      if (groupId && (!targetGroupId || groupId === targetGroupId)) {
        if (!groupCounts.has(groupId)) {
          groupCounts.set(groupId, new Map());
        }
        const wordCounts = groupCounts.get(groupId);
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    });

    console.log('Group counts:', Array.from(groupCounts.entries()));
    return groupCounts;
  }

  // 단어장별 틀린 단어 횟수를 계산하는 함수
  function calculateListWrongCounts(targetListId?: string) {
    const listCounts = new Map<string, Map<string, number>>();
    const allAnswers = Object.values(wrongAnswers).flat();
    console.log('Calculating list wrong counts. All answers:', allAnswers);

    allAnswers.forEach(answer => {
      const quiz = quizHistory.find(q => q.id === answer.quiz_id);
      const listId = quiz?.list_id;
      const word = answer.vocabulary_words.word;

      if (listId && (!targetListId || listId === targetListId)) {
        if (!listCounts.has(listId)) {
          listCounts.set(listId, new Map());
        }
        const wordCounts = listCounts.get(listId);
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    });

    console.log('List counts:', Array.from(listCounts.entries()));
    return listCounts;
  }

  function updateChart() {
    if (!browser || !canvas) {
      console.log('Browser or canvas not ready');
      return;
    }

    console.log('Updating chart with view:', selectedView);
    console.log('Current data:', { wrongAnswers, quizHistory, groups });

    let data;
    let labels;
    let datasets;

    if (selectedView === 'all') {
      const wrongCounts = calculateWrongCounts();
      const sortedEntries = Array.from(wrongCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      data = {
        labels: sortedEntries.map(([word]) => word),
        datasets: [{
          label: '틀린 횟수',
          data: sortedEntries.map(([_, count]) => count),
          backgroundColor: 'rgba(244, 114, 182, 0.6)',
          borderColor: 'rgb(244, 114, 182)',
          borderWidth: 1
        }]
      };
    } else if (selectedView === 'group') {
      if (selectedGroupId) {
        // 선택된 그룹의 단어별 틀린 횟수
        const groupCounts = calculateGroupWrongCounts(selectedGroupId);
        const groupData = Array.from(groupCounts.get(selectedGroupId)?.entries() || [])
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);

        data = {
          labels: groupData.map(([word]) => word),
          datasets: [{
            label: '틀린 횟수',
            data: groupData.map(([_, count]) => count),
            backgroundColor: 'rgba(244, 114, 182, 0.6)',
            borderColor: 'rgb(244, 114, 182)',
            borderWidth: 1
          }]
        };
      } else {
        // 모든 그룹의 통계
        const groupCounts = calculateGroupWrongCounts();
        const groupData = Array.from(groupCounts.entries()).map(([groupId, wordCounts]) => {
          const group = groups.find(g => g.id === groupId);
          const totalCount = Array.from(wordCounts.values()).reduce((sum, count) => sum + count, 0);
          const uniqueWords = wordCounts.size;
          return {
            groupId,
            groupTitle: group?.title || 'Unknown',
            totalCount,
            uniqueWords
          };
        }).sort((a, b) => b.totalCount - a.totalCount);

        data = {
          labels: groupData.map(g => g.groupTitle),
          datasets: [
            {
              label: '총 틀린 횟수',
              data: groupData.map(g => g.totalCount),
              backgroundColor: 'rgba(244, 114, 182, 0.6)',
              borderColor: 'rgb(244, 114, 182)',
              borderWidth: 1
            },
            {
              label: '고유 단어 수',
              data: groupData.map(g => g.uniqueWords),
              backgroundColor: 'rgba(167, 139, 250, 0.6)',
              borderColor: 'rgb(167, 139, 250)',
              borderWidth: 1
            }
          ]
        };
      }
    } else {
      if (selectedListId) {
        // 선택된 단어장의 단어별 틀린 횟수
        const listCounts = calculateListWrongCounts(selectedListId);
        const listData = Array.from(listCounts.get(selectedListId)?.entries() || [])
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);

        data = {
          labels: listData.map(([word]) => word),
          datasets: [{
            label: '틀린 횟수',
            data: listData.map(([_, count]) => count),
            backgroundColor: 'rgba(244, 114, 182, 0.6)',
            borderColor: 'rgb(244, 114, 182)',
            borderWidth: 1
          }]
        };
      } else {
        // 모든 단어장의 통계
        const listCounts = calculateListWrongCounts();
        const listData = Array.from(listCounts.entries()).map(([listId, wordCounts]) => {
          const quiz = quizHistory.find(q => q.list_id === listId);
          const totalCount = Array.from(wordCounts.values()).reduce((sum, count) => sum + count, 0);
          const uniqueWords = wordCounts.size;
          return {
            listId,
            listTitle: quiz?.vocabulary_lists.title || 'Unknown',
            totalCount,
            uniqueWords
          };
        }).sort((a, b) => b.totalCount - a.totalCount)
          .slice(0, 10);

        data = {
          labels: listData.map(l => l.listTitle),
          datasets: [
            {
              label: '총 틀린 횟수',
              data: listData.map(l => l.totalCount),
              backgroundColor: 'rgba(244, 114, 182, 0.6)',
              borderColor: 'rgb(244, 114, 182)',
              borderWidth: 1
            },
            {
              label: '고유 단어 수',
              data: listData.map(l => l.uniqueWords),
              backgroundColor: 'rgba(167, 139, 250, 0.6)',
              borderColor: 'rgb(167, 139, 250)',
              borderWidth: 1
            }
          ]
        };
      }
    }

    console.log('Chart data:', data);

    if (chart) {
      chart.destroy();
    }

    chart = new Chart(canvas, {
      type: 'bar',
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: selectedView === 'all' ? '가장 많이 틀린 단어 TOP 10' :
                  selectedView === 'group' ? (selectedGroupId ? '그룹 내 가장 많이 틀린 단어 TOP 10' : '그룹별 오답 통계') :
                  (selectedListId ? '단어장 내 가장 많이 틀린 단어 TOP 10' : '단어장별 오답 통계 TOP 10'),
            font: {
              size: 16,
              weight: 'bold'
            }
          },
          legend: {
            position: 'top'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          },
          x: {
            ticks: {
              maxRotation: 45,
              minRotation: 45
            }
          }
        }
      }
    });
  }

  function handleViewChange(view: 'all' | 'group' | 'list') {
    selectedView = view;
    selectedGroupId = null;
    selectedListId = null;
    updateChart();
  }

  function handleGroupSelect(event: Event) {
    const select = event.target as HTMLSelectElement;
    selectedGroupId = select.value;
    selectedListId = null;
    updateChart();
  }

  function handleListSelect(event: Event) {
    const select = event.target as HTMLSelectElement;
    selectedListId = select.value;
    updateChart();
  }

  $: if (browser && canvas && wrongAnswers) {
    console.log('Dependencies changed, updating chart');
    updateChart();
  }

  onMount(() => {
    if (browser && canvas) {
      console.log('Component mounted, initializing chart');
      updateChart();
    }
  });
</script>

<div class="bg-white rounded-lg shadow-md p-6 mb-6">
  <div class="flex flex-col space-y-4">
    <div class="flex justify-between items-center">
      <h2 class="text-xl font-bold text-pink-600">오답 통계</h2>
      <div class="flex items-center space-x-2">
        <button
          class="px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 
            {selectedView === 'all' ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
          on:click={() => handleViewChange('all')}
        >
          전체
        </button>
        <button
          class="px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 
            {selectedView === 'group' ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
          on:click={() => handleViewChange('group')}
        >
          그룹별
        </button>
        <button
          class="px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 
            {selectedView === 'list' ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
          on:click={() => handleViewChange('list')}
        >
          단어장별
        </button>
      </div>
    </div>

    {#if selectedView === 'group'}
      <div class="flex justify-end">
        <select
          class="w-64 p-2 border rounded-lg text-sm"
          on:change={handleGroupSelect}
          value={selectedGroupId || ''}
        >
          <option value="">전체 그룹 통계</option>
          {#each groups as group}
            <option value={group.id}>{group.title}</option>
          {/each}
        </select>
      </div>
    {/if}

    {#if selectedView === 'list'}
      <div class="flex justify-end space-x-2">
        {#if selectedGroupId}
          <select
            class="w-64 p-2 border rounded-lg text-sm"
            on:change={handleListSelect}
            value={selectedListId || ''}
          >
            <option value="">그룹의 모든 단어장</option>
            {#each getGroupLists(selectedGroupId) as list}
              <option value={list.id}>{list.title}</option>
            {/each}
          </select>
        {:else}
          <select
            class="w-64 p-2 border rounded-lg text-sm"
            on:change={handleListSelect}
            value={selectedListId || ''}
          >
            <option value="">전체 단어장 통계</option>
            {#each getVocabularyLists() as list}
              <option value={list.id}>{list.groupTitle ? `${list.groupTitle} - ` : ''}{list.title}</option>
            {/each}
          </select>
        {/if}
      </div>
    {/if}
  </div>

  <div class="h-[400px] mt-4">
    <canvas bind:this={canvas}></canvas>
  </div>
</div> 