<!-- src/components/QuizModal.svelte -->
<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { createChatCompletion, type ChatMessage } from '../lib/services/openai';
  import { createClient } from '@supabase/supabase-js';
  
  export let show = false;
  export let quizWords: { 
    word: string; 
    answer: string; 
    example?: string;
    example_translation?: string;
    userInput: string 
  }[] = [];
  export let currentQuizIndex = 0;
  export let showResults = false;
  export let scores: { correct: boolean; explanation?: string }[] = [];
  export let quizTitle = '단어 시험';
  export let vocabularyData: any[] = [];
  export let selectedListId: string | null = null;
  
  const dispatch = createEventDispatcher();

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  let tempInput = '';
  let isComposing = false;
  let isFocused = false;
  let isChecking = false;
  let quizCount = 5;
  let showQuizSetup = true;
  let showSubmitConfirm = false;
  let showExample = false;
  let generatingExampleFor: string | null = null;

  function handleClose() {
    dispatch('close');
    showQuizSetup = true;
    showSubmitConfirm = false;
  }

  function startQuiz() {
    showQuizSetup = false;
    updateQuizCount(quizCount);
  }

  function updateQuizCount(count: number) {
    const shuffled = [...vocabularyData]
      .sort(() => Math.random() - 0.5)
      .slice(0, count === -1 ? vocabularyData.length : count)
      .map(item => ({
        word: item.word,
        answer: item.meaning,
        example: item.example,
        example_translation: item.example_translation,
        userInput: ''
      }));

    quizWords = shuffled;
    currentQuizIndex = 0;
    showResults = false;
    scores = [];
    dispatch('updateCount', count);
  }

  function handleNext() {
    if (tempInput.trim()) {
      quizWords[currentQuizIndex].userInput = tempInput;
    }
    if (currentQuizIndex < quizWords.length - 1) {
      currentQuizIndex++;
      tempInput = quizWords[currentQuizIndex]?.userInput || '';
    }
    dispatch('next');
  }

  function handlePrevious() {
    if (tempInput.trim()) {
      quizWords[currentQuizIndex].userInput = tempInput;
    }
    if (currentQuizIndex > 0) {
      currentQuizIndex--;
      tempInput = quizWords[currentQuizIndex]?.userInput || '';
    }
    dispatch('previous');
  }

  async function handleSubmitConfirm() {
    showSubmitConfirm = false;
    isChecking = true;
    await checkAnswers();
  }

  async function checkAnswer(word: string, userAnswer: string, correctAnswer: string) {
    const messages: ChatMessage[] = [{
      role: "system",
      content: "You are a vocabulary test grader. Compare the user's answer with the correct answer and determine if they are similar enough to be considered correct. The answer should be considered correct if: 1) it contains any of the key words from the correct answer, or 2) it has a very similar meaning in the dictionary sense. Respond with ONLY a JSON object in this exact format: {\"correct\": boolean, \"explanation\": string}. No markdown formatting or additional text."
    }, {
      role: "user",
      content: `Compare these two meanings and determine if they are similar enough to be considered correct:\nCorrect answer: "${correctAnswer}"\nUser's answer: "${userAnswer}"`
    }];

    try {
      const response = await createChatCompletion(messages);
      
      try {
        // Remove any potential markdown formatting or extra text
        const cleanJson = response.message
          .replace(/```json\n?|\n?```/g, '') // Remove markdown code blocks
          .replace(/^[\s\n]*{/, '{')  // Remove leading whitespace before {
          .replace(/}[\s\n]*$/, '}')  // Remove trailing whitespace after }
          .trim();

        // Try to find a valid JSON object if the response contains additional text
        const jsonMatch = cleanJson.match(/\{[^]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          if (typeof result.correct === 'boolean' && typeof result.explanation === 'string') {
            return result;
          }
        }
        
        // Fallback to simple string comparison if JSON parsing fails
        return {
          correct: userAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim(),
          explanation: '단순 문자열 비교로 채점되었습니다.'
        };
      } catch (error) {
        console.error('Error parsing response:', error);
        console.log('Raw response:', response.message);
        // Fallback to simple string comparison
        return {
          correct: userAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim(),
          explanation: '단순 문자열 비교로 채점되었습니다.'
        };
      }
    } catch (error) {
      console.error('Error checking answer:', error);
      // Fallback to simple string comparison
      return {
        correct: userAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim(),
        explanation: '단순 문자열 비교로 채점되었습니다.'
      };
    }
  }

  async function checkAnswers() {
    // 채점 전에 현재 입력값 저장
    if (tempInput.trim()) {
      quizWords[currentQuizIndex].userInput = tempInput;
    }

    isChecking = true;
    try {
      const results = await Promise.all(
        quizWords.map(word => 
          checkAnswer(word.word, word.userInput || '', word.answer)
        )
      );
      scores = results;

      // 퀴즈 결과 저장
      if (selectedListId) {
        console.log('Saving quiz results...', {
          listId: selectedListId,
          score: results.filter(r => r.correct).length,
          total: results.length
        });

        const { data: quizData, error: quizError } = await supabase
          .from('quiz_history')
          .insert([{
            list_id: selectedListId,
            score: results.filter(r => r.correct).length,
            total_questions: results.length
          }])
          .select()
          .single();

        if (quizError) {
          console.error('Error saving quiz history:', quizError);
        } else {
          console.log('Quiz history saved successfully:', quizData);
          
          // 개별 답안 저장
          const quizAnswers = quizWords.map((word, index) => {
            // 단어 ID 찾기
            const vocabularyWord = vocabularyData.find(v => v.word === word.word);
            
            return {
              quiz_id: quizData.id,
              word_id: vocabularyWord?.id,
              user_answer: word.userInput,
              is_correct: results[index].correct,
              explanation: results[index].explanation
            };
          });

          const { error: answersError } = await supabase
            .from('quiz_answers')
            .insert(quizAnswers);

          if (answersError) {
            console.error('Error saving quiz answers:', answersError);
          }
        }
      }
    } catch (error) {
      console.error('Error checking answers:', error);
      // 에러 발생 시 기존 방식으로 채점
      scores = quizWords.map(word => ({
        correct: word.userInput?.toLowerCase().trim() === word.answer.toLowerCase().trim(),
        explanation: '단순 문자열 비교로 채점되었습니다.'
      }));
    } finally {
      isChecking = false;
      showResults = true;
    }
    dispatch('check');
  }

  function handleCompositionStart() {
    isComposing = true;
  }

  function handleCompositionEnd() {
    isComposing = false;
  }

  function handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !isComposing) {
      event.preventDefault();
      // 엔터를 눌렀을 때만 입력값 저장
      if (tempInput.trim()) {
        quizWords[currentQuizIndex].userInput = tempInput;
      }
      
      if (currentQuizIndex < quizWords.length - 1) {
        handleNext();
      } else {
        showSubmitConfirm = true;
      }
    }
  }

  function handleFocus() {
    isFocused = true;
  }

  function handleBlur() {
    isFocused = false;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && show) {
      handleClose();
    }
  }

  // 현재 문제가 바뀔 때마다 임시 입력값 초기화
  $: {
    if (show && !showResults) {
      tempInput = quizWords[currentQuizIndex]?.userInput || '';
    }
    if (showResults) {
      isChecking = false;
    }
  }

  async function generateExample(word: string) {
    if (generatingExampleFor === word) return;
    
    generatingExampleFor = word;

    try {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: 'You are a helpful assistant that generates example sentences for English words. Provide a natural, modern example that clearly demonstrates the word usage. Respond with a JSON object containing "english" and "korean" fields.'
        },
        {
          role: 'user',
          content: `Generate a simple, natural example sentence using the word "${word}". The sentence should be easy to understand and reflect modern usage.`
        }
      ];

      const response = await createChatCompletion(messages);
      
      try {
        const cleanJson = response.message.replace(/```json\n?|\n?```/g, '').trim();
        const example = JSON.parse(cleanJson);
        
        // 현재 단어의 예문 업데이트
        quizWords[currentQuizIndex] = {
          ...quizWords[currentQuizIndex],
          example: example.english,
          example_translation: example.korean
        };
        quizWords = [...quizWords];
      } catch (error) {
        console.error('Error parsing example:', error);
      }
    } catch (error) {
      console.error('Error generating example:', error);
    } finally {
      generatingExampleFor = null;
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
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl p-8 max-w-lg w-full shadow-xl max-h-[90vh] overflow-y-auto">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold text-pink-600">
          <i class="fas fa-graduation-cap mr-2"></i>{quizTitle}
        </h2>
        <button
          on:click={handleClose}
          class="text-pink-400 hover:text-pink-600 text-xl"
        >
          ✕
        </button>
      </div>

      {#if showQuizSetup}
        <div class="space-y-6">
          <div class="text-center">
            <p class="text-lg text-gray-700 mb-4">몇 개의 문제를 푸시겠습니까?</p>
            <div class="grid grid-cols-3 gap-3 max-w-md mx-auto">
              <button
                class="px-6 py-3 rounded-full {quizCount === -1 ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
                on:click={() => quizCount = -1}
              >
                전체
              </button>
              {#each [5, 10, 15, 20, 25, 30] as count}
                <button
                  class="px-6 py-3 rounded-full {quizCount === count ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
                  on:click={() => quizCount = count}
                >
                  {count}개
                </button>
              {/each}
            </div>
          </div>
          <div class="flex justify-center mt-6">
            <button
              on:click={startQuiz}
              class="bg-pink-500 hover:bg-pink-600 text-white font-medium py-2 px-6 rounded-full"
            >
              시험 시작하기 ✨
            </button>
          </div>
        </div>
      {:else if !showResults}
        <div class="space-y-6">
          <div class="text-center">
            <p class="text-lg text-pink-600 font-medium mb-2">
              {currentQuizIndex + 1}번째 문제 / 총 {quizWords.length}문제
            </p>
            <p class="text-2xl font-bold mb-6 text-gray-800">{quizWords[currentQuizIndex]?.word}</p>
            {#if !showResults}
              <div class="mb-4">
                <button
                  on:click={() => showExample = !showExample}
                  class="text-pink-500 hover:text-pink-600 text-sm"
                >
                  {showExample ? '예문 숨기기' : '예문 보기'} 👀
                </button>
              </div>
              {#if showExample}
                <div class="bg-pink-50 rounded-lg p-4 mb-6 text-left">
                  {#if quizWords[currentQuizIndex]?.example}
                    <p class="text-gray-800">{quizWords[currentQuizIndex].example}</p>
                  {:else}
                    <div class="text-center">
                      <button
                        on:click={() => generateExample(quizWords[currentQuizIndex].word)}
                        class="text-pink-500 hover:text-pink-600 text-sm"
                        disabled={generatingExampleFor === quizWords[currentQuizIndex].word}
                      >
                        {#if generatingExampleFor === quizWords[currentQuizIndex].word}
                          <span class="animate-spin inline-block">🔄</span> 생성 중...
                        {:else}
                          ✨ 예문 생성하기
                        {/if}
                      </button>
                    </div>
                  {/if}
                </div>
              {/if}
            {/if}
          </div>
          <input
            type="text"
            bind:value={tempInput}
            placeholder={isFocused ? '' : '정답을 입력하고 엔터를 눌러주세요 💭'}
            on:keydown={handleKeyPress}
            on:compositionstart={handleCompositionStart}
            on:compositionend={handleCompositionEnd}
            on:focus={handleFocus}
            on:blur={handleBlur}
            class="w-full p-3 border-2 border-pink-200 rounded-lg focus:border-pink-400 focus:ring focus:ring-pink-200 focus:ring-opacity-50 text-center"
          />
          
          <div class="mt-4 space-y-2">
            <p class="text-sm font-medium text-pink-600">현재까지의 답안:</p>
            <div class="bg-pink-50 rounded-lg p-4 max-h-40 overflow-y-auto">
              {#each quizWords as word, i}
                <div class="flex justify-between items-center py-1 {i === currentQuizIndex ? 'text-pink-600 font-medium' : 'text-gray-600'}">
                  <span>{i + 1}. {word.word}</span>
                  <span>{word.userInput || '미입력'}</span>
                </div>
              {/each}
            </div>
          </div>
          
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
                on:click={() => showSubmitConfirm = true}
                disabled={isChecking}
                class="bg-pink-500 hover:bg-pink-600 text-white font-medium py-2 px-6 rounded-full disabled:opacity-50"
              >
                {#if isChecking}
                  <span class="animate-spin inline-block mr-2">🔄</span> 채점 중...
                {:else}
                  채점하기 ✨
                {/if}
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
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {#each quizWords as word, i}
              <div class="p-4 rounded-lg {scores[i].correct ? 'bg-green-50 border border-green-200' : 'bg-pink-50 border border-pink-200'}">
                <div class="flex justify-between items-start">
                  <div class="flex-1">
                    <div class="flex items-center gap-2">
                      <p class="font-bold text-gray-800">{word.word}</p>
                      <span class={scores[i].correct ? 'text-green-600' : 'text-pink-600'}>
                        {scores[i].correct ? '⭕' : '❌'}
                      </span>
                    </div>
                    <div class="mt-2 space-y-1">
                      <p class="text-sm text-gray-600">내 답: {word.userInput || '미입력'}</p>
                      {#if !scores[i].correct}
                        <p class="text-sm text-pink-600 font-medium">정답: {word.answer}</p>
                      {/if}
                      {#if scores[i].explanation}
                        <p class="text-xs text-gray-500 mt-2 bg-white p-2 rounded-lg">
                          💡 {scores[i].explanation}
                        </p>
                      {/if}
                    </div>
                  </div>
                </div>
              </div>
            {/each}
          </div>
          <div class="text-center space-y-4">
            <p class="text-2xl font-bold text-pink-600">
              총점: {scores.filter(s => s.correct).length} / {scores.length}
            </p>
            <p class="text-gray-600">
              {#if scores.filter(s => s.correct).length === scores.length}
                🎉 완벽해요! 정말 잘했어요! 🎉
              {:else if scores.filter(s => s.correct).length >= scores.length * 0.7}
                ⭐ 잘했어요! 조금만 더 더력해봐요! ⭐
              {:else}
                💪 다음에는 더 잘할 수 있을 거예요! 💪
              {/if}
            </p>
          </div>
        </div>
      {/if}
    </div>
  </div>

  {#if showSubmitConfirm}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style="z-index: 60;">
      <div class="bg-white rounded-lg p-6 max-w-sm w-full shadow-xl text-center">
        <h3 class="text-xl font-bold mb-4 text-gray-800">시험을 제출하시겠습니까?</h3>
        <p class="text-gray-600 mb-6">
          모든 문제에 답변을 완료하셨나요?<br>
          제출하면 수정할 수 없습니다.
        </p>
        <div class="flex justify-center space-x-4">
          <button
            on:click={() => showSubmitConfirm = false}
            class="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full"
          >
            돌아가기
          </button>
          <button
            on:click={handleSubmitConfirm}
            class="px-6 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-full"
          >
            제출하기
          </button>
        </div>
      </div>
    </div>
  {/if}
{/if}