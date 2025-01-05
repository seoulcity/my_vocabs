<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  export let vocabularyLists: any[] = [];
  export let selectedListId: string | null = null;
  export let showNewListModal = false;

  function handleNewList() {
    showNewListModal = true;
  }
</script>

<div class="mb-8">
  <div class="flex justify-between items-center mb-4">
    <h2 class="text-xl font-bold text-pink-600">📚 단어장</h2>
    <button
      on:click={handleNewList}
      class="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-full text-sm"
    >
      ✨ 새 단어장 만들기
    </button>
  </div>
  
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {#each vocabularyLists as list}
      <button
        on:click={() => {
          selectedListId = list.id;
          dispatch('select', list.id);
        }}
        class="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow
          {selectedListId === list.id ? 'ring-2 ring-pink-500' : ''}"
      >
        <h3 class="font-bold text-gray-800">{list.title}</h3>
        {#if list.description}
          <p class="text-sm text-gray-600 mt-1">{list.description}</p>
        {/if}
      </button>
    {/each}
  </div>
</div> 