<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let show = false;
  export let headers: string[] = [];
  export let columnMapping = {
    word: '',
    partOfSpeech: '',
    meaning: '',
    example: ''
  };
  
  const dispatch = createEventDispatcher();

  function handleClose() {
    dispatch('close');
  }

  function handleSave() {
    dispatch('save', columnMapping);
  }
</script>

{#if show}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl p-8 max-w-lg w-full shadow-xl">
      <h2 class="text-2xl font-bold text-pink-600 mb-6">📝 컬럼 매핑</h2>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">단어 컬럼</label>
          <select
            bind:value={columnMapping.word}
            class="w-full p-2 border rounded-lg"
          >
            <option value="">선택해주세요</option>
            {#each headers as header}
              <option value={header}>{header}</option>
            {/each}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">품사 컬럼</label>
          <select
            bind:value={columnMapping.partOfSpeech}
            class="w-full p-2 border rounded-lg"
          >
            <option value="">선택해주세요</option>
            {#each headers as header}
              <option value={header}>{header}</option>
            {/each}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">의미 컬럼</label>
          <select
            bind:value={columnMapping.meaning}
            class="w-full p-2 border rounded-lg"
          >
            <option value="">선택해주세요</option>
            {#each headers as header}
              <option value={header}>{header}</option>
            {/each}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">예문 컬럼</label>
          <select
            bind:value={columnMapping.example}
            class="w-full p-2 border rounded-lg"
          >
            <option value="">선택해주세요</option>
            {#each headers as header}
              <option value={header}>{header}</option>
            {/each}
          </select>
        </div>
        <div class="flex justify-end space-x-4 mt-6">
          <button
            on:click={handleClose}
            class="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            취소
          </button>
          <button
            on:click={handleSave}
            class="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600"
            disabled={!columnMapping.word || !columnMapping.meaning}
          >
            저장하기
          </button>
        </div>
      </div>
    </div>
  </div>
{/if} 