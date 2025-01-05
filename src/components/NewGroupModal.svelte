<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { createClient } from '@supabase/supabase-js';

  const dispatch = createEventDispatcher();

  export let show = false;

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  let title = '';
  let description = '';

  async function handleSubmit() {
    if (!title.trim()) {
      alert('그룹 이름을 입력해주세요.');
      return;
    }

    const { data, error } = await supabase
      .from('vocabulary_groups')
      .insert([
        {
          title: title.trim(),
          description: description.trim(),
          display_order: 999999 // Will be reordered on the client side
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating group:', error);
      alert('그룹 생성 중 오류가 발생했습니다.');
      return;
    }

    dispatch('add', data);
    resetForm();
  }

  function resetForm() {
    title = '';
    description = '';
    show = false;
  }

  function handleClose() {
    resetForm();
  }
</script>

{#if show}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-6 w-full max-w-md">
      <h2 class="text-xl font-bold mb-4">새 그룹 만들기</h2>
      
      <form on:submit|preventDefault={handleSubmit} class="space-y-4">
        <div>
          <label for="title" class="block text-sm font-medium text-gray-700 mb-1">
            그룹 이름
          </label>
          <input
            type="text"
            id="title"
            bind:value={title}
            placeholder="그룹 이름을 입력하세요"
            class="w-full p-2 border rounded-lg"
          />
        </div>

        <div>
          <label for="description" class="block text-sm font-medium text-gray-700 mb-1">
            설명 (선택사항)
          </label>
          <textarea
            id="description"
            bind:value={description}
            placeholder="그룹에 대한 설명을 입력하세요"
            rows="3"
            class="w-full p-2 border rounded-lg"
          ></textarea>
        </div>

        <div class="flex justify-end space-x-2 pt-4">
          <button
            type="button"
            on:click={handleClose}
            class="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            취소
          </button>
          <button
            type="submit"
            class="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600"
          >
            만들기
          </button>
        </div>
      </form>
    </div>
  </div>
{/if} 