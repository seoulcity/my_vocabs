<!-- src/components/wrong-answers/ScoreAnimation.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { flip } from 'svelte/animate';
  import { fade } from 'svelte/transition';

  export let score: number;
  export let total: number;

  let showPlusOne = false;
  let previousScore = score;

  $: {
    if (score > previousScore) {
      showPlusOne = true;
      setTimeout(() => {
        showPlusOne = false;
      }, 1000);
    }
    previousScore = score;
  }

  $: percentage = Math.round((score / total) * 100);
  $: scoreData = [{ id: 'score', value: score }];
  $: percentageData = [{ id: 'percentage', value: percentage }];
</script>

<div class="relative">
  <div class="flex flex-col items-end">
    <p class="font-bold text-pink-600">
      {#each scoreData as data (data.id)}
        <span class="inline-block" animate:flip={{ duration: 500 }}>
          {data.value}
        </span>
      {/each}
      <span class="text-gray-600 font-normal"> / {total}</span>
    </p>
    {#each percentageData as data (data.id)}
      <p class="text-sm text-gray-600 mt-1" animate:flip={{ duration: 500 }}>
        {data.value}%
      </p>
    {/each}
  </div>

  {#if showPlusOne}
    <div
      class="absolute -top-6 right-4 text-green-500 font-bold"
      transition:fade={{ duration: 300 }}
    >
      +1
    </div>
  {/if}
</div> 