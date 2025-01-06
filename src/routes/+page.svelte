<!-- src/routes/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { createClient } from '@supabase/supabase-js';
  import NewListModal from '../components/NewListModal.svelte';
  import NewWordModal from '../components/NewWordModal.svelte';
  import QuizModal from '../components/QuizModal.svelte';
  import ColumnMappingModal from '../components/ColumnMappingModal.svelte';
  import VocabularyLists from '../components/VocabularyLists.svelte';
  import { browser } from '$app/environment';
  import NewGroupModal from '../components/NewGroupModal.svelte';
  import VocabularyManager from '../components/VocabularyManager.svelte';
  import Dashboard from '../components/Dashboard.svelte';

  // 환경 변수 체크
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Required environment variables are missing');
  }

  const supabase = browser && SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  // 로그는 브라우저에서만 출력
  if (browser && supabase) {
    console.log('Supabase connection initialized');
  }

  let fileInput: HTMLInputElement;
  let vocabularyData: Record<string, any>[] = [];
  let headers: string[] = [];
  let showModal = false;
  let showResults = false;
  let scores: { correct: boolean }[] = [];
  
  // 단어장 관련 상태
  let vocabularyLists: any[] = [];
  let selectedListId: string | null = null;
  let showNewListModal = false;
  let showNewWordModal = false;
  let showNewGroupModal = false;
  let selectedList: any = null;
  let groups: any[] = [];

  // 기존 상태 변수들 아래에 추가
  let showMappingModal = false;
  let columnMapping = {
    word: '',
    partOfSpeech: '',
    meaning: '',
    example: ''
  };

  let quizTitle = '단어 시험';

  onMount(async () => {
    await loadGroups();
    await loadVocabularyLists();
  });

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
  }

  async function handleAddGroup(event: CustomEvent) {
    const newGroup = event.detail;
    console.log('Adding new group:', newGroup);
    
    try {
      await loadGroups();  // 전체 그룹 목록을 새로 로드
      console.log('Groups loaded successfully');
      
      await loadVocabularyLists();  // 단어장 목록도 함께 새로 로드
      console.log('Vocabulary lists loaded successfully');
    } catch (error) {
      console.error('Error in handleAddGroup:', error);
    }
  }

  // 단어장 목록 로드
  const loadVocabularyList = async () => {
    if (!browser || !supabase) return;

    const { data, error } = await supabase
      .from('vocabulary_words')
      .select(`
        id,
        word,
        part_of_speech,
        meaning,
        example
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading vocabulary:', error);
      return;
    }

    vocabularyData = data;
    headers = ['word', 'part_of_speech', 'meaning', 'example'];
  };

  const generateQuiz = () => {
    if (vocabularyData.length === 0) return;
    quizTitle = selectedList ? `${selectedList.title} - 단어 시험` : '단어 시험';
    showModal = true;
  };

  const generateGroupQuiz = async (event: CustomEvent<any>) => {
    const group = event.detail;
    
    // 그룹 내의 모든 단어장에서 단어 로드
    const { data, error } = await supabase
      .from('vocabulary_words')
      .select('*')
      .in('list_id', vocabularyLists
        .filter(list => list.group_id === group.id)
        .map(list => list.id)
      );

    if (error) {
      console.error('Error loading group words:', error);
      alert('단어 로드 중 오류가 발생했습니다.');
      return;
    }

    if (!data || data.length === 0) {
      alert('퀴즈를 생성할 단어가 없습니다.');
      return;
    }

    vocabularyData = data;
    quizTitle = `${group.title} - 그룹 단어 시험`;
    showModal = true;
  };

  async function handleSelectList(event: CustomEvent<string>) {
    const listId = event.detail;
    selectedListId = listId;
    await loadVocabularyWords(listId);
  }

  // 단어장 목록 로드
  const loadVocabularyLists = async () => {
    if (!browser || !supabase) return;
    
    console.log('Loading vocabulary lists...');
    const { data, error } = await supabase
      .from('vocabulary_lists')
      .select(`
        *,
        vocabulary_groups (
          id,
          title,
          description
        ),
        vocabulary_words (count)
      `)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error loading vocabulary lists:', error);
      return;
    }

    vocabularyLists = data.map(list => ({
      ...list,
      word_count: list.vocabulary_words[0]?.count || 0
    }));
    vocabularyLists = [...vocabularyLists];
  };

  // 단어장 삭제 처리
  const handleDeleteList = async (event: CustomEvent<string>) => {
    const listId = event.detail;
    if (!confirm('정말로 이 단어장을 삭제하시겠습니까?')) {
      return;
    }

    const { error } = await supabase
      .from('vocabulary_lists')
      .delete()
      .eq('id', listId);

    if (error) {
      console.error('Error deleting list:', error);
      alert('단어장 삭제 중 오류가 발생했습니다.');
      return;
    }

    vocabularyLists = vocabularyLists.filter(list => list.id !== listId);
    if (selectedListId === listId) {
      selectedListId = null;
      selectedList = null;
    }
  };

  // 단어장 수정 처리
  const handleEditList = async (event: CustomEvent<any>) => {
    const updatedList = event.detail;
    const { error } = await supabase
      .from('vocabulary_lists')
      .update({
        title: updatedList.title,
        description: updatedList.description,
        updated_at: new Date().toISOString()
      })
      .eq('id', updatedList.id);

    if (error) {
      console.error('Error updating list:', error);
      alert('단어장 수정 중 오류가 발생했습니다.');
      return;
    }

    vocabularyLists = vocabularyLists.map(list =>
      list.id === updatedList.id ? { ...list, ...updatedList } : list
    );
  };

  // 선택된 단어장의 단어들 로드
  const loadVocabularyWords = async (listId: string) => {
    if (!browser || !supabase) return;

    // 단어장 정보 로드
    const { data: listData, error: listError } = await supabase
      .from('vocabulary_lists')
      .select(`
        *,
        vocabulary_groups (
          id,
          title
        )
      `)
      .eq('id', listId)
      .single();

    if (listError) {
      console.error('Error loading list:', listError);
      return;
    }

    selectedList = listData;

    // 단어 목록 로드
    const { data, error } = await supabase
      .from('vocabulary_words')
      .select('*')
      .eq('list_id', listId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading words:', error);
      return;
    }

    vocabularyData = data;
    headers = ['word', 'part_of_speech', 'meaning', 'example'];
  };

  // 여러 단어 추가 처리
  const handleAddWords = async (event: CustomEvent) => {
    if (!browser || !supabase || !selectedListId) return;

    const { words } = event.detail;
    const wordsToInsert = words.map(word => ({
      ...word,
      list_id: selectedListId,
      created_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from('vocabulary_words')
      .insert(wordsToInsert)
      .select();

    if (error) {
      console.error('Error adding words:', error);
      alert('단어 추가 중 오류가 발생했습니다.');
      return;
    }

    showNewWordModal = false;
    
    // 새로 추가된 단어들을 vocabularyData의 앞부분에 추가
    if (data) {
      vocabularyData = [...data, ...vocabularyData];
    }
  };
</script>

<div class="container mx-auto px-4 py-8">
  <!-- 대시보드 섹션 -->
  <Dashboard />

  <!-- 메인 콘텐츠 영역 -->
  <div class="flex gap-6">
    <!-- 왼쪽: 단어장 네비게이션 -->
    <div class="w-80 flex-shrink-0">
      <VocabularyLists
        {vocabularyLists}
        {selectedListId}
        {showNewListModal}
        {showNewGroupModal}
        {groups}
        on:select={handleSelectList}
        on:delete={handleDeleteList}
        on:edit={handleEditList}
        on:newGroup={() => showNewGroupModal = true}
        on:newList={() => showNewListModal = true}
        on:groupQuiz={generateGroupQuiz}
      />
    </div>

    <!-- 오른쪽: 단어 관리 영역 -->
    <VocabularyManager
      {selectedList}
      {selectedListId}
      {vocabularyData}
      {headers}
      on:newword={() => showNewWordModal = true}
      on:newlist={() => showNewListModal = true}
      on:quiz={generateQuiz}
      on:fileupload={(event) => {
        vocabularyData = event.detail.data;
        headers = event.detail.headers;
        showMappingModal = true;
      }}
    />
  </div>
</div>

<!-- Modals -->
<NewListModal
  show={showNewListModal}
  on:close={() => showNewListModal = false}
  on:create={async (event) => {
    if (!browser || !supabase) return;

    const { data, error } = await supabase
      .from('vocabulary_lists')
      .insert([event.detail])
      .select()
      .single();

    if (error) {
      console.error('Error creating list:', error.message, error.details, error.hint);
      alert('단어장 생성 중 오류가 발생했습니다: ' + error.message);
      return;
    }

    console.log('Created new list:', data);
    showNewListModal = false;
    await loadVocabularyLists();
  }}
/>

<NewWordModal
  show={showNewWordModal}
  on:close={() => showNewWordModal = false}
  on:add={event => handleAddWords(event)}
/>

<QuizModal
  show={showModal}
  {vocabularyData}
  {selectedListId}
  {quizTitle}
  on:close={() => showModal = false}
/>

<ColumnMappingModal
  show={showMappingModal}
  {headers}
  {selectedListId}
  bind:columnMapping
  on:close={() => showMappingModal = false}
  on:save={async () => {
    showMappingModal = false;
    await loadVocabularyWords(selectedListId);
  }}
/>

<NewGroupModal
  bind:show={showNewGroupModal}
  on:add={handleAddGroup}
/>

<style>
  :global(.container) {
    max-width: 1200px;
  }

  input[type="file"]::file-selector-button {
    cursor: pointer;
  }

  @keyframes loading {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }

  .skeleton-loading {
    animation: loading 1.5s infinite;
  }
</style>
