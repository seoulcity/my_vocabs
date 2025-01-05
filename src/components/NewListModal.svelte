<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let show = false;
  
  const dispatch = createEventDispatcher();
  
  let newList = {
    title: '',
    description: ''
  };

  function handleClose() {
    dispatch('close');
  }

  function handleCreate() {
    dispatch('create', newList);
    newList = { title: '', description: '' };
  }
</script>

{#if show}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl p-8 max-w-lg w-full shadow-xl">
      <h2 class="text-2xl font-bold text-pink-600 mb-6">✨ 새 단어장 만들기</h2>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">제목</label>
          <input
            type="text"
            bind:value={newList.title}
            class="w-full p-2 border rounded-lg"
            placeholder="단어장 제목을 입력하세요"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">설명</label>
          <textarea
            bind:value={newList.description}
            class="w-full p-2 border rounded-lg"
            placeholder="단어장에 대한 설명을 입력하세요"
            rows="3"
          ></textarea>
        </div>
        <div class="flex justify-end space-x-4 mt-6">
          <button
            on:click={handleClose}
            class="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            취소
          </button>
          <button
            on:click={handleCreate}
            class="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600"
            disabled={!newList.title}
          >
            만들기
          </button>
        </div>
      </div>
    </div>
  </div>
{/if} 