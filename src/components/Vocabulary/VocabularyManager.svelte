<!-- src/components/VocabularyManager.svelte -->
<script lang="ts">
  import * as XLSX from 'xlsx';
  import VocabularyTable from './VocabularyTable.svelte';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let selectedList: any;
  export let selectedListId: string | null;
  export let vocabularyData: Record<string, any>[];
  export let headers: string[];

  let fileInput: HTMLInputElement;

  const handleFileUpload = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (!file || !selectedListId) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];
      
      if (jsonData.length > 0) {
        dispatch('fileupload', {
          data: jsonData,
          headers: Object.keys(jsonData[0])
        });
      }
    };
    
    reader.readAsArrayBuffer(file);
  };
</script>

<div class="flex-1">
  {#if selectedListId}
    <div class="bg-white rounded-lg shadow-sm p-6">
      <!-- 단어장 헤더 -->
      <div class="flex justify-between items-center mb-6">
        <div>
          <h2 class="text-xl font-bold text-gray-800">
            {selectedList?.title}
            <span class="text-sm font-normal text-gray-500 ml-2">
              ({vocabularyData.length}개 단어)
            </span>
          </h2>
          {#if selectedList?.description}
            <p class="text-sm text-gray-600 mt-1">{selectedList.description}</p>
          {/if}
        </div>
        <div class="flex items-center gap-3">
          <button
            on:click={() => dispatch('newword')}
            class="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-full text-sm flex items-center"
          >
            <i class="fas fa-plus mr-2"></i>단어 추가
          </button>
          <label class="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-full text-sm flex items-center cursor-pointer">
            <i class="fas fa-file-import mr-2"></i>엑셀 가져오기
            <input
              type="file"
              accept=".xlsx,.xls"
              on:change={handleFileUpload}
              bind:this={fileInput}
              class="hidden"
            />
          </label>
        </div>
      </div>

      <!-- 단어 테이블 -->
      <VocabularyTable
        {vocabularyData}
        {headers}
        {selectedListId}
        {selectedList}
        on:quiz
      />
    </div>
  {:else}
    <div class="bg-white rounded-lg shadow-sm p-6 text-center">
      <div class="max-w-md mx-auto">
        <i class="fas fa-book text-6xl text-gray-300 mb-4"></i>
        <h2 class="text-xl font-bold text-gray-800 mb-2">단어장을 선택해주세요</h2>
        <p class="text-gray-600 mb-6">왼쪽 목록에서 단어장을 선택하면 단어 목록이 표시됩니다</p>
        <button
          on:click={() => dispatch('newlist')}
          class="bg-pink-500 hover:bg-pink-600 text-white px-6 py-3 rounded-full text-sm inline-flex items-center"
        >
          <i class="fas fa-plus mr-2"></i>새 단어장 만들기
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  input[type="file"]::file-selector-button {
    cursor: pointer;
  }
</style> 