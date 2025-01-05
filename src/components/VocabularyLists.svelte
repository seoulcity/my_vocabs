<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  export let vocabularyLists: any[] = [];
  export let selectedListId: string | null = null;
  export let showNewListModal = false;

  let editingList: any = null;

  function handleNewList() {
    showNewListModal = true;
  }

  function handleEdit(list: any) {
    editingList = { ...list };
  }

  async function handleDelete(id: string) {
    if (confirm('정말로 이 단어장을 삭제하시겠습니까?')) {
      dispatch('delete', id);
    }
  }

  async function handleSaveEdit() {
    if (editingList) {
      dispatch('edit', editingList);
      editingList = null;
    }
  }
</script>

<div class="mb-8">
  <div class="flex justify-between items-center mb-4">
    <div>
      <h2 class="text-xl font-bold text-pink-600">📚 단어장</h2>
      <p class="text-sm text-gray-600 mt-1">나만의 단어장을 만들고 관리해보세요!</p>
    </div>
    <button
      on:click={handleNewList}
      class="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-full text-sm"
    >
      ✨ 새 단어장 만들기
    </button>
  </div>
  
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {#each vocabularyLists as list}
      <div class="relative p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow
        {selectedListId === list.id ? 'ring-2 ring-pink-500' : ''}">
        {#if editingList?.id === list.id}
          <div class="space-y-2">
            <input
              type="text"
              bind:value={editingList.title}
              class="w-full p-2 border rounded-lg text-gray-800 font-bold"
            />
            <textarea
              bind:value={editingList.description}
              class="w-full p-2 border rounded-lg text-gray-600 text-sm"
              rows="2"
            ></textarea>
            <div class="flex justify-end space-x-2">
              <button
                on:click={() => editingList = null}
                class="text-sm text-gray-500 hover:text-gray-700"
              >
                취소
              </button>
              <button
                on:click={handleSaveEdit}
                class="text-sm text-pink-500 hover:text-pink-700"
              >
                저장
              </button>
            </div>
          </div>
        {:else}
          <button
            on:click={() => {
              selectedListId = list.id;
              dispatch('select', list.id);
            }}
            class="w-full text-left"
          >
            <h3 class="font-bold text-gray-800">{list.title}</h3>
            {#if list.description}
              <p class="text-sm text-gray-600 mt-1">{list.description}</p>
            {/if}
          </button>
          <div class="absolute top-2 right-2 flex space-x-1">
            <button
              on:click={() => handleEdit(list)}
              class="p-1 text-gray-400 hover:text-pink-500"
              title="단어장 수정"
            >
              ✏️
            </button>
            <button
              on:click={() => handleDelete(list.id)}
              class="p-1 text-gray-400 hover:text-pink-500"
              title="단어장 삭제"
            >
              🗑️
            </button>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div> 