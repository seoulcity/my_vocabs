<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { createClient } from '@supabase/supabase-js';
  import { slide } from 'svelte/transition';

  const dispatch = createEventDispatcher();

  export let show = false;

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  let title = '';
  let description = '';
  let selectedGroupId = '';
  let groups: any[] = [];

  $: if (show) {
    loadGroups();
  }

  async function loadGroups() {
    const { data, error } = await supabase
      .from('vocabulary_groups')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error loading groups:', error);
      return;
    }

    groups = data;
    if (groups.length > 0 && !selectedGroupId) {
      selectedGroupId = groups[0].id;
    }
  }

  function handleSubmit() {
    if (!title.trim()) {
      alert('단어장 이름을 입력해주세요.');
      return;
    }

    if (!selectedGroupId) {
      alert('그룹을 선택해주세요.');
      return;
    }

    dispatch('create', {
      title: title.trim(),
      description: description.trim(),
      group_id: selectedGroupId,
      display_order: 999999 // Will be reordered on the client side
    });

    resetForm();
  }

  function resetForm() {
    title = '';
    description = '';
    selectedGroupId = groups[0]?.id || '';
    show = false;
  }

  function handleClose() {
    resetForm();
    dispatch('close');
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && show) {
      handleClose();
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  });
</script>

{#if show}
  <div
    transition:slide={{ duration: 200 }}
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
  >
    <div
      class="bg-white rounded-lg p-6 w-full max-w-md transform transition-all duration-200 relative"
      in:slide={{ duration: 200, delay: 100 }}
    >
      <button
        on:click={handleClose}
        class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors duration-200"
        title="닫기"
      >
        ✕
      </button>
      
      <h2 class="text-xl font-bold mb-4">새 단어장 만들기</h2>
      
      <form on:submit|preventDefault={handleSubmit} class="space-y-4">
        <div>
          <label for="group" class="block text-sm font-medium text-gray-700 mb-1">
            그룹 선택
          </label>
          <select
            id="group"
            bind:value={selectedGroupId}
            class="w-full p-2 border rounded-lg"
          >
            {#each groups as group}
              <option value={group.id}>{group.title}</option>
            {/each}
          </select>
        </div>

        <div>
          <label for="title" class="block text-sm font-medium text-gray-700 mb-1">
            단어장 이름
          </label>
          <input
            type="text"
            id="title"
            bind:value={title}
            placeholder="단어장 이름을 입력하세요"
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
            placeholder="단어장에 대한 설명을 입력하세요"
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