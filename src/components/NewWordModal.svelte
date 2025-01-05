<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let show = false;
  
  const dispatch = createEventDispatcher();
  
  let newWord = {
    word: '',
    part_of_speech: '',
    meaning: '',
    example: ''
  };

  function handleClose() {
    dispatch('close');
  }

  function handleAdd() {
    dispatch('add', newWord);
    newWord = { word: '', part_of_speech: '', meaning: '', example: '' };
  }
</script>

{#if show}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl p-8 max-w-lg w-full shadow-xl">
      <h2 class="text-2xl font-bold text-pink-600 mb-6">✏️ 새 단어 추가</h2>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">단어</label>
          <input
            type="text"
            bind:value={newWord.word}
            class="w-full p-2 border rounded-lg"
            placeholder="단어를 입력하세요"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">품사</label>
          <input
            type="text"
            bind:value={newWord.part_of_speech}
            class="w-full p-2 border rounded-lg"
            placeholder="품사를 입력하세요 (선택사항)"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">의미</label>
          <input
            type="text"
            bind:value={newWord.meaning}
            class="w-full p-2 border rounded-lg"
            placeholder="단어의 의미를 입력하세요"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">예문</label>
          <textarea
            bind:value={newWord.example}
            class="w-full p-2 border rounded-lg"
            placeholder="예문을 입력하세요 (선택사항)"
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
            on:click={handleAdd}
            class="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600"
            disabled={!newWord.word || !newWord.meaning}
          >
            추가하기
          </button>
        </div>
      </div>
    </div>
  </div>
{/if} 