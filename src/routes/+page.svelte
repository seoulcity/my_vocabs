<script lang="ts">
  import { onMount } from 'svelte';
  import * as XLSX from 'xlsx';

  let fileInput: HTMLInputElement;
  let vocabularyData: Record<string, any>[] = [];
  let headers: string[] = [];
  let showModal = false;
  let quizWords: { word: string; answer: string; userInput: string }[] = [];
  let currentQuizIndex = 0;
  let showResults = false;
  let scores: { correct: boolean }[] = [];

  const handleFileUpload = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (!file) return;

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
      }
    };
    
    reader.readAsArrayBuffer(file);
  };

  const generateQuiz = () => {
    if (vocabularyData.length === 0 || headers.length < 3) return;

    const shuffled = [...vocabularyData]
      .sort(() => Math.random() - 0.5)
      .slice(0, 10)
      .map(item => ({
        word: item[headers[0]],
        answer: item[headers[2]],
        userInput: ''
      }));

    quizWords = shuffled;
    currentQuizIndex = 0;
    showResults = false;
    scores = [];
    showModal = true;
  };

  const handleNext = () => {
    if (currentQuizIndex < quizWords.length - 1) {
      currentQuizIndex++;
    }
  };

  const handlePrevious = () => {
    if (currentQuizIndex > 0) {
      currentQuizIndex--;
    }
  };

  const checkAnswers = () => {
    scores = quizWords.map(word => ({
      correct: word.userInput.toLowerCase().trim() === word.answer.toLowerCase().trim()
    }));
    showResults = true;
  };

  const closeModal = () => {
    showModal = false;
    quizWords = [];
    currentQuizIndex = 0;
    showResults = false;
    scores = [];
  };
</script>

<div class="min-h-screen bg-pink-50 flex flex-col">
  <div class="container mx-auto px-4 py-12 flex-1">
    <h1 class="text-3xl font-bold mb-12 text-center text-pink-600">
      ✨ 꾜리의 Power 단어공부 ✨
    </h1>
    
    <div class="mb-12 max-w-md mx-auto">
      <label class="block text-center">
        <span class="text-lg text-pink-700 font-medium mb-3 block">📚 단어장 파일 올리기</span>
        <input
          type="file"
          accept=".xlsx,.xls"
          on:change={handleFileUpload}
          bind:this={fileInput}
          class="block w-full text-sm text-pink-500
            file:mr-4 file:py-2 file:px-6
            file:rounded-full file:border-0
            file:text-sm file:font-medium
            file:bg-pink-100 file:text-pink-600
            hover:file:bg-pink-200
            cursor-pointer"
        />
      </label>
    </div>

    {#if vocabularyData.length > 0}
      <div class="mb-12 text-center">
        <button
          on:click={generateQuiz}
          class="bg-pink-500 hover:bg-pink-600 text-white font-medium py-3 px-8 rounded-full transform hover:scale-105 transition-transform duration-200 shadow-md"
        >
          ✏️ 단어 시험 시작하기
        </button>
      </div>

      <div class="overflow-x-auto bg-white rounded-lg shadow-md">
        <table class="min-w-full">
          <thead>
            <tr>
              {#each headers as header}
                <th class="px-6 py-3 border-b-2 border-pink-100 bg-pink-50 text-left text-sm font-medium text-pink-600 uppercase tracking-wider">
                  {header}
                </th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each vocabularyData as row}
              <tr class="hover:bg-pink-50 transition-colors duration-150">
                {#each headers as header}
                  <td class="px-6 py-4 border-b border-pink-100">
                    {row[header]}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <div class="text-center text-pink-600 text-lg">
        <p>📝 엑셀 파일을 올려주시면 예쁘게 정리해드릴게요!</p>
      </div>
    {/if}
  </div>
</div>

{#if showModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl p-8 max-w-lg w-full shadow-xl">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold text-pink-600">🌟 단어 시험</h2>
        <button
          on:click={closeModal}
          class="text-pink-400 hover:text-pink-600 text-xl"
        >
          ✕
        </button>
      </div>

      {#if !showResults}
        <div class="space-y-6">
          <div class="text-center">
            <p class="text-lg text-pink-600 font-medium mb-2">
              {currentQuizIndex + 1}번째 문제 / 총 {quizWords.length}문제
            </p>
            <p class="text-2xl font-bold mb-6 text-gray-800">{quizWords[currentQuizIndex]?.word}</p>
          </div>
          <input
            type="text"
            bind:value={quizWords[currentQuizIndex].userInput}
            placeholder="정답을 입력해주세요 💭"
            class="w-full p-3 border-2 border-pink-200 rounded-lg focus:border-pink-400 focus:ring focus:ring-pink-200 focus:ring-opacity-50 text-center"
          />
          
          <div class="flex justify-between pt-4">
            <button
              on:click={handlePrevious}
              disabled={currentQuizIndex === 0}
              class="bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium py-2 px-6 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ◀️ 이전
            </button>
            
            {#if currentQuizIndex === quizWords.length - 1}
              <button
                on:click={checkAnswers}
                class="bg-pink-500 hover:bg-pink-600 text-white font-medium py-2 px-6 rounded-full"
              >
                채점하기 ✨
              </button>
            {:else}
              <button
                on:click={handleNext}
                class="bg-pink-500 hover:bg-pink-600 text-white font-medium py-2 px-6 rounded-full"
              >
                다음 ▶️
              </button>
            {/if}
          </div>
        </div>
      {:else}
        <div>
          <h3 class="text-xl font-bold mb-6 text-center text-pink-600">✨ 시험 결과 ✨</h3>
          <div class="space-y-3">
            {#each quizWords as word, i}
              <div class="p-4 rounded-lg {scores[i].correct ? 'bg-green-50 border-2 border-green-100' : 'bg-pink-50 border-2 border-pink-100'}">
                <p class="font-bold text-gray-800">{word.word}</p>
                <div class="mt-2 text-sm">
                  <p>
                    나의 답: <span class={scores[i].correct ? 'text-green-600 font-medium' : 'text-pink-600'}>{word.userInput}</span>
                  </p>
                  {#if !scores[i].correct}
                    <p class="text-gray-600">정답: {word.answer}</p>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
          <div class="mt-6 text-center">
            <p class="text-2xl font-bold text-pink-600">
              총점: {scores.filter(s => s.correct).length} / {scores.length}
            </p>
            <p class="mt-2 text-gray-600">
              {#if scores.filter(s => s.correct).length === scores.length}
                🎉 완벽해요! 정말 잘했어요! 🎉
              {:else if scores.filter(s => s.correct).length >= scores.length * 0.7}
                ⭐ 잘했어요! 조금만 더 노력해봐요! ⭐
              {:else}
                💪 다음에는 더 잘할 수 있을 거예요! 💪
              {/if}
            </p>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .container {
    max-width: 1200px;
  }

  input[type="file"] {
    position: relative;
  }

  input[type="file"]::file-selector-button {
    cursor: pointer;
  }

  :global(body) {
    background-color: #fdf2f8;
  }
</style>
