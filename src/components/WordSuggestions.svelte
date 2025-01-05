<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import wd from 'word-definition';
  
  const dispatch = createEventDispatcher();
  
  export let word = '';
  let suggestions: Array<{
    word: string;
    definition?: string;
    partOfSpeech?: string;
  }> = [];
  let loading = false;
  let searchTimeout: NodeJS.Timeout | null = null;

  // 영어 단어 목록 (자주 사용되는 단어들)
  const commonWords = [
    'abandon', 'ability', 'able', 'about', 'above', 'abroad', 'absence', 'absolute',
    'accept', 'accident', 'accompany', 'accomplish', 'according', 'account', 'accurate',
    'accuse', 'achieve', 'acknowledge', 'acquire', 'across', 'act', 'action', 'active',
    'actual', 'adapt', 'add', 'adequate', 'adjust', 'admire', 'admit', 'adopt', 'adult',
    'advance', 'advantage', 'adventure', 'advertise', 'advice', 'advise', 'affair',
    'affect', 'afford', 'afraid', 'after', 'afternoon', 'again', 'against', 'age',
    'agency', 'agenda', 'agent', 'aggressive', 'ago', 'agree', 'agriculture', 'ahead',
    'aid', 'aim', 'air', 'aircraft', 'airline', 'airport', 'alarm', 'alcohol', 'alive',
    'all', 'allow', 'almost', 'alone', 'along', 'already', 'also', 'alter', 'alternative',
    'although', 'always', 'amazing', 'ambition', 'among', 'amount', 'analyse', 'analyze',
    'ancient', 'and', 'anger', 'angle', 'angry', 'animal', 'announce', 'annual', 'another',
    'answer', 'anticipate', 'anxiety', 'any', 'anybody', 'anymore', 'anyone', 'anything',
    'anyway', 'anywhere', 'apart', 'apartment', 'apparent', 'appeal', 'appear', 'appearance',
    'apple', 'application', 'apply', 'appoint', 'appreciate', 'approach', 'appropriate',
    'approve', 'approximate', 'architect', 'area', 'argue', 'argument', 'arise', 'arm',
    'army', 'around', 'arrange', 'arrangement', 'arrest', 'arrive', 'art', 'article',
    'artificial', 'artist', 'as', 'ash', 'aside', 'ask', 'asleep', 'aspect', 'assault',
    'assert', 'assess', 'assessment', 'asset', 'assign', 'assist', 'assistance', 'assistant',
    'associate', 'association', 'assume', 'assure', 'atmosphere', 'attach', 'attack',
    'attempt', 'attend', 'attention', 'attitude', 'attorney', 'attract', 'attractive',
    'attribute', 'audience', 'author', 'authority', 'automatic', 'available', 'average',
    'avoid', 'awake', 'award', 'aware', 'away', 'awful', 'baby', 'back', 'background',
    'bad', 'bag', 'balance', 'ball', 'ban', 'band', 'bank', 'bar', 'bare', 'barely',
    'bargain', 'barrier', 'base', 'basic', 'basis', 'basket', 'battle', 'beach', 'bean',
    'bear', 'beat', 'beautiful', 'beauty', 'because', 'become', 'bed', 'bedroom', 'beer',
    'before', 'begin', 'beginning', 'behavior', 'behind', 'being', 'belief', 'believe',
    'bell', 'belong', 'below', 'belt', 'bench', 'bend', 'beneath', 'benefit', 'beside',
    'besides', 'best', 'bet', 'better', 'between', 'beyond', 'bicycle', 'bid', 'big',
    'bike', 'bill', 'bind', 'bird', 'birth', 'birthday', 'bit', 'bite', 'black',
    'blade', 'blame', 'blank', 'blanket', 'blast', 'blind', 'block', 'blood', 'blow',
    'blue', 'board', 'boat', 'body', 'boil', 'bomb', 'bond', 'bone', 'book', 'boom',
    'boot', 'border', 'born', 'borrow', 'boss', 'both', 'bother', 'bottle', 'bottom',
    'boundary', 'bowl', 'box', 'boy', 'brain', 'branch', 'brand', 'brave', 'bread',
    'break', 'breakfast', 'breast', 'breath', 'breathe', 'brick', 'bridge', 'brief',
    'bright', 'brilliant', 'bring', 'broad', 'broadcast', 'brother', 'brown', 'brush',
    'bubble', 'budget', 'build', 'building', 'bullet', 'bunch', 'burden', 'burn',
    'burst', 'bus', 'business', 'busy', 'but', 'butter', 'button', 'buy', 'buyer'
  ];

    'burst', 'bus', 'business', 'busy', 'but', 'butter', 'button', 'buy', 'buyer'
  ];

  async function searchWord(searchTerm: string) {
    if (!searchTerm.trim()) {
      suggestions = [];
      return;
    }

    loading = true;
    try {
      // 입력된 단어로 시작하는 단어들 찾기
      const searchTermLower = searchTerm.toLowerCase();
      const matchingWords = commonWords
        .filter(word => word.toLowerCase().startsWith(searchTermLower))
        .slice(0, 5);

      // 각 단어의 정의 찾기
      const results = await Promise.all(
        matchingWords.map(async (word) => {
          return new Promise((resolve) => {
            wd.getDef(word, "en", null, (definition: any) => {
              resolve({
                word,
                definition: definition.definition || '정의를 찾을 수 없습니다.',
                partOfSpeech: definition.category || '품사 정보 없음'
              });
            });
          });
        })
      );

      suggestions = results as Array<{
        word: string;
        definition?: string;
        partOfSpeech?: string;
      }>;
    } catch (error) {
      console.error('Error searching word:', error);
    } finally {
      loading = false;
    }
  }

  function handleSelect(suggestion: typeof suggestions[0]) {
    dispatch('select', suggestion);
    suggestions = []; // 선택 후 제안 목록 숨기기
  }

  function clearSearchTimeout() {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
      searchTimeout = null;
    }
  }

  $: {
    clearSearchTimeout();
    if (word) {
      searchTimeout = setTimeout(() => searchWord(word), 300);
    } else {
      suggestions = [];
    }
  }

  onMount(() => {
    return () => {
      clearSearchTimeout();
    };
  });
</script>

{#if suggestions.length > 0}
  <div class="mt-2 bg-white rounded-lg shadow-lg overflow-hidden border border-pink-100 absolute w-full z-10">
    {#each suggestions as suggestion}
      <button
        on:click={() => handleSelect(suggestion)}
        class="w-full px-4 py-2 text-left hover:bg-pink-50 transition-colors duration-150 border-b border-pink-100 last:border-b-0"
      >
        <div class="font-medium text-gray-800">{suggestion.word}</div>
        {#if suggestion.partOfSpeech}
          <div class="text-sm text-pink-600">{suggestion.partOfSpeech}</div>
        {/if}
        {#if suggestion.definition}
          <div class="text-sm text-gray-600 truncate">{suggestion.definition}</div>
        {/if}
      </button>
    {/each}
  </div>
{/if}

{#if loading}
  <div class="mt-2 text-center text-pink-600">
    <span class="inline-block animate-spin mr-2">🔍</span>
    검색 중...
  </div>
{/if} 