<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { createClient } from '@supabase/supabase-js';
  import { slide } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { flip } from 'svelte/animate';
  
  const dispatch = createEventDispatcher();
  
  export let vocabularyLists: any[] = [];
  export let selectedListId: string | null = null;
  export let showNewListModal = false;
  export let showNewGroupModal = false;
  export let groups: any[] = [];

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  let editingList: any = null;
  let editingGroup: any = null;
  let expandedGroups: Set<string> = new Set();
  let movingList: any = null;
  let showMoveModal = false;

  async function loadGroups() {
    if (!supabase) return;

    const { data, error } = await supabase
      .from('vocabulary_groups')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error loading groups:', error);
      return;
    }

    groups = data;

    // 그룹이 없으면 기본 그룹 생성
    if (groups.length === 0) {
      const { data: defaultGroup, error: createError } = await supabase
        .from('vocabulary_groups')
        .insert([{
          title: '기본 그룹',
          description: '기본 단어장 그룹',
          display_order: 0
        }])
        .select()
        .single();

      if (createError) {
        console.error('Error creating default group:', createError);
        return;
      }

      groups = [defaultGroup];
      expandedGroups.add(defaultGroup.id);
    }
  }

  // 컴포넌트 마운트 시 그룹 로드
  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  });

  function handleNewList() {
    dispatch('newList');
  }

  function handleNewGroup() {
    dispatch('newGroup');
  }

  function handleEdit(list: any) {
    editingList = { ...list };
  }

  function handleEditGroup(group: any) {
    editingGroup = { ...group };
  }

  async function handleDelete(id: string) {
    if (confirm('정말로 이 단어장을 삭제하시겠습니까?')) {
      dispatch('delete', id);
    }
  }

  async function handleDeleteGroup(id: string) {
    if (confirm('정말로 이 그룹을 삭제하시겠습니까? 그룹 내의 모든 단어장도 함께 삭제됩니다.')) {
      const { error } = await supabase
        .from('vocabulary_groups')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting group:', error);
        alert('그룹 삭제 중 오류가 발생했습니다.');
        return;
      }

      await loadGroups();
    }
  }

  async function handleSaveEdit() {
    if (editingList) {
      dispatch('edit', editingList);
      editingList = null;
    }
  }

  async function handleSaveGroupEdit() {
    if (!editingGroup) return;

    const { error } = await supabase
      .from('vocabulary_groups')
      .update({
        title: editingGroup.title,
        description: editingGroup.description,
        updated_at: new Date().toISOString()
      })
      .eq('id', editingGroup.id);

    if (error) {
      console.error('Error updating group:', error);
      alert('그룹 수정 중 오류가 발생했습니다.');
      return;
    }

    editingGroup = null;
    await loadGroups();
  }

  function toggleGroup(groupId: string) {
    if (expandedGroups.has(groupId)) {
      expandedGroups.delete(groupId);
    } else {
      expandedGroups.add(groupId);
    }
    expandedGroups = expandedGroups; // trigger reactivity
  }

  async function handleGroupDndConsider(event: CustomEvent<any>) {
    const { items } = event.detail;
    groups = items;
  }

  async function handleGroupDndFinalize(event: CustomEvent<any>) {
    const { items } = event.detail;
    groups = items;

    // Update display order in database
    const updates = groups.map((group, index) => ({
      id: group.id,
      display_order: index
    }));

    const { error } = await supabase
      .from('vocabulary_groups')
      .upsert(updates);

    if (error) {
      console.error('Error updating group order:', error);
      alert('그룹 순서 저장 중 오류가 발생했습니다.');
    }
  }

  async function handleListDndConsider(event: CustomEvent<any>, groupId: string) {
    const { items } = event.detail;
    vocabularyLists = vocabularyLists.map(list => 
      list.group_id === groupId ? items.find((item: any) => item.id === list.id) : list
    );
  }

  async function handleListDndFinalize(event: CustomEvent<any>, groupId: string) {
    const { items } = event.detail;
    vocabularyLists = vocabularyLists.map(list => 
      list.group_id === groupId ? items.find((item: any) => item.id === list.id) : list
    );

    // Update display order in database
    const updates = items.map((list: any, index: number) => ({
      id: list.id,
      display_order: index
    }));

    const { error } = await supabase
      .from('vocabulary_lists')
      .upsert(updates);

    if (error) {
      console.error('Error updating list order:', error);
      alert('단어장 순서 저장 중 오류가 발생했습니다.');
    }
  }

  async function handleMoveList(list: any) {
    movingList = { ...list };
    showMoveModal = true;
  }

  async function handleMoveConfirm(targetGroupId: string) {
    if (!movingList || !targetGroupId) return;

    const { error } = await supabase
      .from('vocabulary_lists')
      .update({
        group_id: targetGroupId,
        display_order: 999999, // Will be reordered when dropped
        updated_at: new Date().toISOString()
      })
      .eq('id', movingList.id);

    if (error) {
      console.error('Error moving list:', error);
      alert('단어장 이동 중 오류가 발생했습니다.');
      return;
    }

    vocabularyLists = vocabularyLists.map(list =>
      list.id === movingList.id ? { ...list, group_id: targetGroupId } : list
    );

    movingList = null;
    showMoveModal = false;
  }

  // Add ESC key handler
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && showMoveModal) {
      movingList = null;
      showMoveModal = false;
    }
  }

  async function moveListUp(list: any) {
    const groupLists = vocabularyLists
      .filter(l => l.group_id === list.group_id)
      .sort((a, b) => a.display_order - b.display_order);
    
    const currentIndex = groupLists.findIndex(l => l.id === list.id);
    if (currentIndex <= 0) return;

    const newOrder = groupLists[currentIndex - 1].display_order;
    const oldOrder = list.display_order;

    // Update local state first for immediate feedback
    vocabularyLists = vocabularyLists.map(l => {
      if (l.id === list.id) return { ...l, display_order: newOrder };
      if (l.id === groupLists[currentIndex - 1].id) return { ...l, display_order: oldOrder };
      return l;
    });
    // Sort the list after updating display_order
    vocabularyLists = vocabularyLists.sort((a, b) => a.display_order - b.display_order);

    // Update first item
    const { error: error1 } = await supabase
      .from('vocabulary_lists')
      .update({ display_order: newOrder })
      .eq('id', list.id);

    if (error1) {
      console.error('Error updating first item:', error1);
      alert('순서 변경 중 오류가 발생했습니다.');
      // Revert local state on error
      vocabularyLists = vocabularyLists.map(l => {
        if (l.id === list.id) return { ...l, display_order: oldOrder };
        if (l.id === groupLists[currentIndex - 1].id) return { ...l, display_order: newOrder };
        return l;
      });
      // Sort the list after reverting
      vocabularyLists = vocabularyLists.sort((a, b) => a.display_order - b.display_order);
      return;
    }

    // Update second item
    const { error: error2 } = await supabase
      .from('vocabulary_lists')
      .update({ display_order: oldOrder })
      .eq('id', groupLists[currentIndex - 1].id);

    if (error2) {
      console.error('Error updating second item:', error2);
      alert('순서 변경 중 오류가 발생했습니다.');
      // Revert local state on error
      vocabularyLists = vocabularyLists.map(l => {
        if (l.id === list.id) return { ...l, display_order: oldOrder };
        if (l.id === groupLists[currentIndex - 1].id) return { ...l, display_order: newOrder };
        return l;
      });
      // Sort the list after reverting
      vocabularyLists = vocabularyLists.sort((a, b) => a.display_order - b.display_order);
    }
  }

  async function moveListDown(list: any) {
    const groupLists = vocabularyLists
      .filter(l => l.group_id === list.group_id)
      .sort((a, b) => a.display_order - b.display_order);
    
    const currentIndex = groupLists.findIndex(l => l.id === list.id);
    if (currentIndex >= groupLists.length - 1) return;

    const newOrder = groupLists[currentIndex + 1].display_order;
    const oldOrder = list.display_order;

    // Update local state first for immediate feedback
    vocabularyLists = vocabularyLists.map(l => {
      if (l.id === list.id) return { ...l, display_order: newOrder };
      if (l.id === groupLists[currentIndex + 1].id) return { ...l, display_order: oldOrder };
      return l;
    });
    // Sort the list after updating display_order
    vocabularyLists = vocabularyLists.sort((a, b) => a.display_order - b.display_order);

    // Update first item
    const { error: error1 } = await supabase
      .from('vocabulary_lists')
      .update({ display_order: newOrder })
      .eq('id', list.id);

    if (error1) {
      console.error('Error updating first item:', error1);
      alert('순서 변경 중 오류가 발생했습니다.');
      // Revert local state on error
      vocabularyLists = vocabularyLists.map(l => {
        if (l.id === list.id) return { ...l, display_order: oldOrder };
        if (l.id === groupLists[currentIndex + 1].id) return { ...l, display_order: newOrder };
        return l;
      });
      // Sort the list after reverting
      vocabularyLists = vocabularyLists.sort((a, b) => a.display_order - b.display_order);
      return;
    }

    // Update second item
    const { error: error2 } = await supabase
      .from('vocabulary_lists')
      .update({ display_order: oldOrder })
      .eq('id', groupLists[currentIndex + 1].id);

    if (error2) {
      console.error('Error updating second item:', error2);
      alert('순서 변경 중 오류가 발생했습니다.');
      // Revert local state on error
      vocabularyLists = vocabularyLists.map(l => {
        if (l.id === list.id) return { ...l, display_order: oldOrder };
        if (l.id === groupLists[currentIndex + 1].id) return { ...l, display_order: newOrder };
        return l;
      });
      // Sort the list after reverting
      vocabularyLists = vocabularyLists.sort((a, b) => a.display_order - b.display_order);
    }
  }

  async function moveGroupUp(group: any) {
    const sortedGroups = [...groups].sort((a, b) => a.display_order - b.display_order);
    const currentIndex = sortedGroups.findIndex(g => g.id === group.id);
    if (currentIndex <= 0) return;

    const newOrder = sortedGroups[currentIndex - 1].display_order;
    const oldOrder = group.display_order;

    // Update local state first for immediate feedback
    groups = groups.map(g => {
      if (g.id === group.id) return { ...g, display_order: newOrder };
      if (g.id === sortedGroups[currentIndex - 1].id) return { ...g, display_order: oldOrder };
      return g;
    });
    // Sort groups after updating display_order
    groups = groups.sort((a, b) => a.display_order - b.display_order);

    // Update first item
    const { error: error1 } = await supabase
      .from('vocabulary_groups')
      .update({ display_order: newOrder })
      .eq('id', group.id);

    if (error1) {
      console.error('Error updating first item:', error1);
      alert('순서 변경 중 오류가 발생했습니다.');
      // Revert local state on error
      groups = groups.map(g => {
        if (g.id === group.id) return { ...g, display_order: oldOrder };
        if (g.id === sortedGroups[currentIndex - 1].id) return { ...g, display_order: newOrder };
        return g;
      });
      // Sort groups after reverting
      groups = groups.sort((a, b) => a.display_order - b.display_order);
      return;
    }

    // Update second item
    const { error: error2 } = await supabase
      .from('vocabulary_groups')
      .update({ display_order: oldOrder })
      .eq('id', sortedGroups[currentIndex - 1].id);

    if (error2) {
      console.error('Error updating second item:', error2);
      alert('순서 변경 중 오류가 발생했습니다.');
      // Revert local state on error
      groups = groups.map(g => {
        if (g.id === group.id) return { ...g, display_order: oldOrder };
        if (g.id === sortedGroups[currentIndex - 1].id) return { ...g, display_order: newOrder };
        return g;
      });
      // Sort groups after reverting
      groups = groups.sort((a, b) => a.display_order - b.display_order);
    }
  }

  async function moveGroupDown(group: any) {
    const sortedGroups = [...groups].sort((a, b) => a.display_order - b.display_order);
    const currentIndex = sortedGroups.findIndex(g => g.id === group.id);
    if (currentIndex >= sortedGroups.length - 1) return;

    const newOrder = sortedGroups[currentIndex + 1].display_order;
    const oldOrder = group.display_order;

    // Update local state first for immediate feedback
    groups = groups.map(g => {
      if (g.id === group.id) return { ...g, display_order: newOrder };
      if (g.id === sortedGroups[currentIndex + 1].id) return { ...g, display_order: oldOrder };
      return g;
    });
    // Sort groups after updating display_order
    groups = groups.sort((a, b) => a.display_order - b.display_order);

    // Update first item
    const { error: error1 } = await supabase
      .from('vocabulary_groups')
      .update({ display_order: newOrder })
      .eq('id', group.id);

    if (error1) {
      console.error('Error updating first item:', error1);
      alert('순서 변경 중 오류가 발생했습니다.');
      // Revert local state on error
      groups = groups.map(g => {
        if (g.id === group.id) return { ...g, display_order: oldOrder };
        if (g.id === sortedGroups[currentIndex + 1].id) return { ...g, display_order: newOrder };
        return g;
      });
      // Sort groups after reverting
      groups = groups.sort((a, b) => a.display_order - b.display_order);
      return;
    }

    // Update second item
    const { error: error2 } = await supabase
      .from('vocabulary_groups')
      .update({ display_order: oldOrder })
      .eq('id', sortedGroups[currentIndex + 1].id);

    if (error2) {
      console.error('Error updating second item:', error2);
      alert('순서 변경 중 오류가 발생했습니다.');
      // Revert local state on error
      groups = groups.map(g => {
        if (g.id === group.id) return { ...g, display_order: oldOrder };
        if (g.id === sortedGroups[currentIndex + 1].id) return { ...g, display_order: newOrder };
        return g;
      });
      // Sort groups after reverting
      groups = groups.sort((a, b) => a.display_order - b.display_order);
    }
  }

  async function handleAddGroup(event: CustomEvent) {
    const newGroup = event.detail;
    // Update local state immediately
    groups = [...groups, newGroup].sort((a, b) => a.display_order - b.display_order);
    // Automatically expand the new group
    expandedGroups.add(newGroup.id);
    expandedGroups = expandedGroups; // trigger reactivity
    
    // Reload all groups to ensure we have the latest data
    await loadGroups();
  }
</script>

<div class="mb-8">
  <div class="flex justify-between items-center mb-4">
    <div>
      <h2 class="text-xl font-bold text-pink-600">📚 단어장</h2>
      <p class="text-sm text-gray-600 mt-1">나만의 단어장을 만들고 관리해보세요!</p>
    </div>
    <div class="space-x-2">
      <button
        on:click={() => dispatch('newGroup')}
        class="bg-white hover:bg-pink-50 text-pink-600 border-2 border-pink-400 px-4 py-2 rounded-full text-sm transition-colors duration-200"
      >
        ✨ 새 그룹 만들기
      </button>
      <button
        on:click={() => dispatch('newList')}
        class="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-full text-sm"
      >
        ✨ 새 단어장 만들기
      </button>
    </div>
  </div>
  
  <section class="space-y-4">
    {#each groups as group (group.id)}
      <div
        class="bg-white rounded-lg shadow-sm p-4 transform transition-transform duration-200"
        animate:flip={{ duration: 300 }}
      >
        {#if editingGroup?.id === group.id}
          <div class="space-y-2">
            <input
              type="text"
              bind:value={editingGroup.title}
              class="w-full p-2 border rounded-lg text-gray-800 font-bold"
            />
            <textarea
              bind:value={editingGroup.description}
              class="w-full p-2 border rounded-lg text-gray-600 text-sm"
              rows="2"
            ></textarea>
            <div class="flex justify-end space-x-2">
              <button
                on:click={() => editingGroup = null}
                class="text-sm text-gray-500 hover:text-gray-700"
              >
                취소
              </button>
              <button
                on:click={handleSaveGroupEdit}
                class="text-sm text-pink-500 hover:text-pink-700"
              >
                저장
              </button>
            </div>
          </div>
        {:else}
          <div class="flex justify-between items-start group">
            <button
              on:click={() => toggleGroup(group.id)}
              class="flex items-center space-x-2 text-left flex-1"
            >
              <span 
                class="transform transition-transform duration-300 ease-out {expandedGroups.has(group.id) ? 'rotate-90' : ''}"
              >
                ▶
              </span>
              <div class="flex-1">
                <div class="flex items-center space-x-2">
                  <h3 class="font-bold text-gray-800">{group.title}</h3>
                  <span class="text-sm text-gray-500">
                    ({vocabularyLists.filter(list => list.group_id === group.id).length}개 단어장, 
                    {vocabularyLists
                      .filter(list => list.group_id === group.id)
                      .reduce((sum, list) => sum + (list.word_count || 0), 0)}개 단어)
                  </span>
                </div>
                {#if group.description}
                  <p class="text-sm text-gray-600 mt-1">{group.description}</p>
                {/if}
              </div>
            </button>
            <div class="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {#if groups.length > 1}
                <button
                  on:click={() => moveGroupUp(group)}
                  class="p-1 text-gray-400 hover:text-pink-500"
                  title="위로 이동"
                  disabled={groups.indexOf(group) === 0}
                >
                  <i class="fas fa-chevron-up"></i>
                </button>
                <button
                  on:click={() => moveGroupDown(group)}
                  class="p-1 text-gray-400 hover:text-pink-500"
                  title="아래로 이동"
                  disabled={groups.indexOf(group) === groups.length - 1}
                >
                  <i class="fas fa-chevron-down"></i>
                </button>
              {/if}
              <button
                on:click={() => handleEditGroup(group)}
                class="p-1 text-gray-400 hover:text-pink-500"
                title="그룹 수정"
              >
                ✏️
              </button>
              <button
                on:click={() => handleDeleteGroup(group.id)}
                class="p-1 text-gray-400 hover:text-pink-500"
                title="그룹 삭제"
              >
                🗑️
              </button>
            </div>
          </div>

          {#if expandedGroups.has(group.id)}
            <div
              transition:slide={{ duration: 300, easing: quintOut }}
              class="mt-4 space-y-2 pl-6"
            >
              {#if vocabularyLists.filter(list => list.group_id === group.id).length === 0}
                <div
                  transition:slide={{ duration: 300, easing: quintOut }}
                  class="text-center py-8 text-gray-500"
                >
                  <p class="mb-2">아직 단어장이 없습니다</p>
                  <button
                    on:click={() => dispatch('newList')}
                    class="text-pink-500 hover:text-pink-600 text-sm"
                  >
                    ✨ 새 단어장 만들기
                  </button>
                </div>
              {:else}
                {#each vocabularyLists.filter(list => list.group_id === group.id) as list (list.id)}
                  <div
                    class="relative bg-white rounded-lg shadow-sm border border-gray-100 hover:border-pink-200 transition-all duration-200 hover:shadow-md group"
                    animate:flip={{ duration: 300 }}
                  >
                    {#if editingList?.id === list.id}
                      <div class="p-4 space-y-2">
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
                        class="w-full p-4 text-left"
                      >
                        <h3 class="font-bold text-gray-800">
                          {list.title}
                          <span class="text-sm font-normal text-gray-500 ml-2">
                            ({list.word_count || 0}개 단어)
                          </span>
                        </h3>
                        {#if list.description}
                          <p class="text-sm text-gray-600 mt-1">{list.description}</p>
                        {/if}
                      </button>
                      <div class="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        {#if vocabularyLists.filter(l => l.group_id === group.id).length > 1}
                          <button
                            on:click={() => moveListUp(list)}
                            class="p-1 text-gray-400 hover:text-pink-500"
                            title="위로 이동"
                          >
                            <i class="fas fa-chevron-up"></i>
                          </button>
                          <button
                            on:click={() => moveListDown(list)}
                            class="p-1 text-gray-400 hover:text-pink-500"
                            title="아래로 이동"
                          >
                            <i class="fas fa-chevron-down"></i>
                          </button>
                        {/if}
                        <button
                          on:click={() => handleMoveList(list)}
                          class="p-1 text-gray-400 hover:text-pink-500"
                          title="다른 그룹으로 이동"
                        >
                          🔄
                        </button>
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
              {/if}
            </div>
          {/if}
        {/if}
      </div>
    {/each}
  </section>
</div> 

<!-- Move List Modal -->
{#if showMoveModal}
  <div
    transition:slide={{ duration: 200 }}
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
  >
    <div
      class="bg-white rounded-lg p-6 w-full max-w-md transform transition-all duration-200 relative"
      in:slide={{ duration: 200, delay: 100 }}
    >
      <button
        on:click={() => {
          movingList = null;
          showMoveModal = false;
        }}
        class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors duration-200"
        title="닫기"
      >
        ✕
      </button>
      
      <h2 class="text-xl font-bold mb-4">단어장 이동</h2>
      <p class="text-gray-600 mb-4">"{movingList?.title}"을(를) 이동할 그룹을 선택하세요:</p>
      
      <div class="space-y-2">
        {#each groups.filter(g => g.id !== movingList?.group_id) as group}
          <button
            on:click={() => handleMoveConfirm(group.id)}
            class="w-full p-3 text-left border rounded-lg hover:bg-pink-50 hover:border-pink-200 transition-colors duration-200"
          >
            <h3 class="font-medium text-gray-800">{group.title}</h3>
            {#if group.description}
              <p class="text-sm text-gray-600 mt-1">{group.description}</p>
            {/if}
          </button>
        {/each}
      </div>

      <div class="flex justify-end mt-4">
        <button
          on:click={() => {
            movingList = null;
            showMoveModal = false;
          }}
          class="px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          취소
        </button>
      </div>
    </div>
  </div>
{/if} 