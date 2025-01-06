<!-- src/components/ColumnMappingModal.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { createClient } from '@supabase/supabase-js';
  import * as XLSX from 'xlsx';
  
  export let show = false;
  export let headers: string[] = [];
  export let columnMapping = {
    word: '',
    partOfSpeech: '',
    meaning: '',
    example: ''
  };
  export let selectedListId: string | null = null;
  
  const dispatch = createEventDispatcher();

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  let vocabularyData: Record<string, any>[] = [];

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
      vocabularyData = jsonData;
      
      if (jsonData.length > 0) {
        headers = Object.keys(jsonData[0]);
        // 컬럼 매핑 초기화
        columnMapping = {
          word: '',
          partOfSpeech: '',
          meaning: '',
          example: ''
        };
        show = true;
      }
    };
    
    reader.readAsArrayBuffer(file);
  };

  // 데이터베이스에 단어장 저장
  const saveVocabularyList = async () => {
    try {
      if (!selectedListId) return;

      // 매핑된 컬럼을 사용하여 단어 데이터 변환
      const wordsToInsert = vocabularyData.map(row => ({
        list_id: selectedListId,
        word: row[columnMapping.word],
        part_of_speech: row[columnMapping.partOfSpeech] || null,
        meaning: row[columnMapping.meaning],
        example: row[columnMapping.example] || null
      }));

      // 단어 데이터 저장
      const { error: wordsError } = await supabase
        .from('vocabulary_words')
        .insert(wordsToInsert);

      if (wordsError) throw wordsError;

      alert('단어가 성공적으로 추가되었습니다!');
      show = false;
      dispatch('save');
    } catch (error) {
      console.error('Error saving vocabulary:', error);
      alert('단어 저장 중 오류가 발생했습니다.');
    }
  };

  function handleClose() {
    dispatch('close');
  }

  function handleSave() {
    saveVocabularyList();
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