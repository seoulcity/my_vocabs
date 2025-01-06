<!-- src/routes/wrong-answers/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { createClient } from '@supabase/supabase-js';
  import { browser } from '$app/environment';
  import CorrectAnswerButton from '../../components/wrong-answers/CorrectAnswerButton.svelte';
  import ScoreAnimation from '../../components/wrong-answers/ScoreAnimation.svelte';
  import QuizModal from '../../components/Quiz/QuizModal.svelte';
  import WrongAnswersStats from '../../components/wrong-answers/WrongAnswersStats.svelte';

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Required environment variables are missing');
  }

  const supabase = browser && SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  type QuizHistory = {
    id: string;
    list_id: string;
    score: number;
    total_questions: number;
    created_at: string;
    vocabulary_lists: {
      title: string;
      vocabulary_groups: {
        id: string;
        title: string;
      };
    };
  };

  type Group = {
    id: string;
    title: string;
    description?: string;
  };

  type QuizAnswer = {
    id: string;
    quiz_id: string;
    word_id: string;
    user_answer: string;
    is_correct: boolean;
    explanation: string;
    quiz_title?: string;
    quiz_date?: string;
    vocabulary_words: {
      word: string;
      meaning: string;
      part_of_speech: string;
    };
  };

  let quizHistory: QuizHistory[] = [];
  let wrongAnswers: Record<string, QuizAnswer[]> = {};
  let selectedQuizId: string | null = null;
  let isLoading = true;
  let showOnlyIncorrect = true;
  let showDeleteConfirm = false;
  let quizToDelete: string | null = null;
  let showAllWrongAnswers = false;
  let showQuizModal = false;
  let showQuizSettingsModal = false;
  let quizMode: 'all' | 'group' | 'list' = 'all';
  let selectedGroupId: string | null = null;
  let quizVocabularyData: any[] = [];
  let groups: Group[] = [];
  let uniqueWrongAnswers = new Set();

  onMount(async () => {
    await loadGroups();
    await loadQuizHistory();
    if (showAllWrongAnswers) {
      await loadAllWrongAnswers();
    }
  });

  async function loadQuizHistory() {
    if (!browser || !supabase) return;

    try {
      // 퀴즈 기록 로드 (그룹 정보 포함)
      const { data: historyData, error: historyError } = await supabase
        .from('quiz_history')
        .select(`
          *,
          vocabulary_lists (
            title,
            vocabulary_groups (
              id,
              title
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (historyError) throw historyError;
      console.log('Loaded quiz history:', historyData);
      quizHistory = historyData;

      // 모든 퀴즈의 오답을 바로 로드
      if (historyData.length > 0) {
        const quizIds = historyData.map(quiz => quiz.id);
        const { data: answersData, error: answersError } = await supabase
          .from('quiz_answers')
          .select(`
            *,
            vocabulary_words!inner (
              word,
              meaning,
              part_of_speech
            )
          `)
          .in('quiz_id', quizIds)
          .eq('is_correct', false);

        if (answersError) throw answersError;

        // 퀴즈 ID별로 오답을 그룹화
        const groupedAnswers = answersData.reduce((acc, answer) => {
          if (!acc[answer.quiz_id]) {
            acc[answer.quiz_id] = [];
          }
          acc[answer.quiz_id].push({
            id: answer.id,
            quiz_id: answer.quiz_id,
            word_id: answer.word_id,
            user_answer: answer.user_answer,
            is_correct: answer.is_correct,
            explanation: answer.explanation,
            vocabulary_words: answer.vocabulary_words
          });
          return acc;
        }, {});

        console.log('Loaded wrong answers:', groupedAnswers);
        wrongAnswers = groupedAnswers;
      }
    } catch (error) {
      console.error('Error loading quiz history:', error);
    } finally {
      isLoading = false;
    }
  }

  // 선택된 퀴즈의 답안만 로드하는 함수
  async function loadQuizAnswers(quizId: string) {
    if (!browser || !supabase) return;

    try {
      console.log('Loading answers for quiz:', quizId);
      
      const { data: answersData, error: answersError } = await supabase
        .from('quiz_answers')
        .select(`
          *,
          vocabulary_words!inner (
            word,
            meaning,
            part_of_speech
          )
        `)
        .eq('quiz_id', quizId)
        .eq('is_correct', false);

      if (answersError) {
        console.error('Error loading answers:', answersError);
        throw answersError;
      }

      console.log('Raw answers data:', answersData);

      // 틀린 답안만 필터링
      const wrongAnswersForQuiz = answersData.map(answer => ({
        id: answer.id,
        quiz_id: answer.quiz_id,
        word_id: answer.word_id,
        user_answer: answer.user_answer,
        is_correct: answer.is_correct,
        explanation: answer.explanation,
        vocabulary_words: answer.vocabulary_words
      }));

      console.log('Filtered wrong answers:', wrongAnswersForQuiz);

      // 상태 업데이트
      wrongAnswers = {
        ...wrongAnswers,
        [quizId]: wrongAnswersForQuiz
      };
    } catch (error) {
      console.error('Error loading quiz answers:', error);
    }
  }

  // 퀴즈 선택 시 해당 퀴즈의 답안 로드
  async function handleQuizSelect(quizId: string) {
    selectedQuizId = quizId;
    await loadQuizAnswers(quizId);
  }

  async function handleDeleteQuiz() {
    if (!quizToDelete || !supabase) return;

    try {
      // quiz_answers는 CASCADE로 자동 삭제됨
      const { error } = await supabase
        .from('quiz_history')
        .delete()
        .eq('id', quizToDelete);

      if (error) throw error;

      // UI 업데이트
      quizHistory = quizHistory.filter(quiz => quiz.id !== quizToDelete);
      delete wrongAnswers[quizToDelete];
      
      if (selectedQuizId === quizToDelete) {
        selectedQuizId = null;
      }

      showDeleteConfirm = false;
      quizToDelete = null;
    } catch (error) {
      console.error('Error deleting quiz:', error);
      alert('시험 기록 삭제 중 오류가 발생했습니다.');
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // 모든 틀린 답안을 로드하는 함수
  async function loadAllWrongAnswers() {
    if (!browser || !supabase) return;

    try {
      const { data: answersData, error: answersError } = await supabase
        .from('quiz_answers')
        .select(`
          *,
          vocabulary_words!inner (
            word,
            meaning,
            part_of_speech
          ),
          quiz_history!inner (
            created_at,
            list_id,
            vocabulary_lists (
              title,
              vocabulary_groups (
                id,
                title
              )
            )
          )
        `)
        .eq('is_correct', false)
        .order('created_at', { ascending: false });

      if (answersError) throw answersError;

      // 모든 틀린 답안을 퀴즈 ID별로 그룹화
      const groupedAnswers = answersData.reduce((acc, answer) => {
        if (!acc[answer.quiz_id]) {
          acc[answer.quiz_id] = [];
        }
        acc[answer.quiz_id].push({
          id: answer.id,
          quiz_id: answer.quiz_id,
          word_id: answer.word_id,
          user_answer: answer.user_answer,
          is_correct: answer.is_correct,
          explanation: answer.explanation,
          vocabulary_words: answer.vocabulary_words,
          quiz_date: answer.quiz_history.created_at,
          quiz_title: answer.quiz_history.vocabulary_lists.title
        });
        return acc;
      }, {});

      wrongAnswers = groupedAnswers;
      console.log('Loaded wrong answers:', wrongAnswers);
    } catch (error) {
      console.error('Error loading all wrong answers:', error);
    }
  }

  // 오답 시험 모달 열기 함수
  async function openQuizModal() {
    await loadAllWrongAnswers();  // 오답 데이터 로드
    showQuizSettingsModal = true;
  }

  // 보기 모드 변경 처리
  async function handleViewModeChange(allMode: boolean) {
    showAllWrongAnswers = allMode;
    if (allMode) {
      selectedQuizId = null;
      await loadAllWrongAnswers();
    } else {
      wrongAnswers = {};
    }
  }

  async function updateQuizScore(quizId: string) {
    const quiz = quizHistory.find(q => q.id === quizId);
    if (quiz) {
      quiz.score += 1;
      quizHistory = quizHistory;
    }
  }

  // 시험이 치러진 단어장 목록을 중복 없이 가져오는 함수
  function getUniqueVocabularyLists() {
    // 단어장 ID를 키로 사용하여 중복 제거
    const listsMap = new Map();
    
    quizHistory.forEach(quiz => {
      if (!listsMap.has(quiz.list_id)) {
        listsMap.set(quiz.list_id, {
          id: quiz.list_id,
          title: quiz.vocabulary_lists.title,
          groupTitle: quiz.vocabulary_lists.vocabulary_groups?.title,
          groupId: quiz.vocabulary_lists.vocabulary_groups?.id
        });
      }
    });

    return Array.from(listsMap.values());
  }

  // 모드 변경 시 자동 선택 처리
  function handleModeChange(newMode: 'all' | 'group' | 'list') {
    quizMode = newMode;
    
    // 모드 변경 시 자동 선택 처리
    if (newMode === 'group') {
      if (groups.length > 0 && Object.keys(wrongAnswers).length > 0) {
        const groupWithWrongAnswers = groups.find(group => 
          getUniqueWrongAnswersCount('group', group.id) > 0
        );
        if (groupWithWrongAnswers) {
          selectedGroupId = groupWithWrongAnswers.id;
        }
      }
    } else if (newMode === 'list') {
      const lists = getUniqueVocabularyLists();
      if (lists.length > 0 && Object.keys(wrongAnswers).length > 0) {
        const listWithWrongAnswers = lists.find(list => 
          getUniqueWrongAnswersCount('list', list.id) > 0
        );
        if (listWithWrongAnswers) {
          selectedQuizId = listWithWrongAnswers.id;
        }
      }
    }
  }

  function prepareQuizData() {
    let wrongAnswersArray: any[] = [];

    if (quizMode === 'all') {
      // 모든 오답을 하나의 배열로 합치기
      wrongAnswersArray = Object.values(wrongAnswers).flat();
    } else if (quizMode === 'group' && selectedGroupId) {
      // 선택된 그룹의 단어장들의 오답만 필터링
      wrongAnswersArray = Object.values(wrongAnswers)
        .flat()
        .filter(answer => {
          const quiz = quizHistory.find(q => q.id === answer.quiz_id);
          return quiz?.vocabulary_lists.vocabulary_groups.id === selectedGroupId;
        });
    } else if (quizMode === 'list' && selectedQuizId) {
      // 선택된 단어장의 모든 시험에서의 오답 필터링
      wrongAnswersArray = Object.values(wrongAnswers)
        .flat()
        .filter(answer => {
          const quiz = quizHistory.find(q => q.id === answer.quiz_id);
          return quiz?.list_id === selectedQuizId;
        });
    }

    // 중복 제거를 위해 word를 키로 사용하여 Set 생성
    const uniqueWords = new Map();
    wrongAnswersArray.forEach(answer => {
      if (!uniqueWords.has(answer.vocabulary_words.word)) {
        uniqueWords.set(answer.vocabulary_words.word, {
          word: answer.vocabulary_words.word,
          meaning: answer.vocabulary_words.meaning,
          part_of_speech: answer.vocabulary_words.part_of_speech,
          id: answer.word_id
        });
      }
    });

    const result = Array.from(uniqueWords.values());
    console.log('Prepared quiz data:', result);
    return result;
  }

  function startQuiz() {
    quizVocabularyData = prepareQuizData();
    showQuizSettingsModal = false;
    showQuizModal = true;
  }

  $: filteredAnswers = showAllWrongAnswers 
    ? Object.values(wrongAnswers).flat()
    : (wrongAnswers[selectedQuizId] || []);

  // 중복 없는 오답 개수를 계산하는 함수
  function getUniqueWrongAnswersCount(mode: 'all' | 'group' | 'list', targetId?: string) {
    let wrongAnswersArray = Object.values(wrongAnswers).flat();
    console.log('전체 오답 배열:', wrongAnswersArray);
    
    if (mode === 'group' && targetId) {
      // 1. 해당 그룹에 속한 단어장 목록 찾기
      const groupLists = quizHistory
        .filter(quiz => quiz.vocabulary_lists.vocabulary_groups?.id === targetId)
        .map(quiz => ({
          list_id: quiz.list_id,
          title: quiz.vocabulary_lists.title
        }));
      console.log(`그룹 ${targetId}에 속한 단어장 목록:`, groupLists);

      // 2. 해당 단어장들의 시험 기록 ID 찾기
      const quizIds = quizHistory
        .filter(quiz => groupLists.some(list => list.list_id === quiz.list_id))
        .map(quiz => quiz.id);
      console.log('관련된 시험 기록 ID들:', quizIds);

      // 3. 해당 시험들의 오답 필터링
      wrongAnswersArray = wrongAnswersArray.filter(answer => {
        const quiz = quizHistory.find(q => q.id === answer.quiz_id);
        const isInGroup = groupLists.some(list => list.list_id === quiz?.list_id);
        return isInGroup;
      });
      console.log('그룹의 오답들:', wrongAnswersArray);

      // 4. 중복 제거를 위해 단어 목록 만들기
      const uniqueWords = new Set(wrongAnswersArray.map(answer => answer.vocabulary_words.word));
      console.log('중복 제거된 단어 목록:', Array.from(uniqueWords));
      
      return uniqueWords.size;
    } else if (mode === 'list' && targetId) {
      wrongAnswersArray = wrongAnswersArray.filter(answer => {
        const quiz = quizHistory.find(q => q.id === answer.quiz_id);
        return quiz?.list_id === targetId;
      });
    }

    // 중복 제거를 위해 word를 키로 사용
    const uniqueWords = new Set(wrongAnswersArray.map(answer => answer.vocabulary_words.word));
    return uniqueWords.size;
  }

  // 그룹 로드 후 기본 그룹 설정
  async function loadGroups() {
    if (!browser || !supabase) return;

    const { data, error } = await supabase
      .from('vocabulary_groups')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error loading groups:', error);
      return;
    }

    groups = data;
    
    // 오답이 있는 첫 번째 그룹을 찾아 기본값으로 설정
    if (groups.length > 0 && Object.keys(wrongAnswers).length > 0) {
      const groupWithWrongAnswers = groups.find(group => 
        getUniqueWrongAnswersCount('group', group.id) > 0
      );
      if (groupWithWrongAnswers) {
        selectedGroupId = groupWithWrongAnswers.id;
      }
    }
  }
</script>

<div class="min-h-screen bg-pink-50 py-12">
  <div class="container mx-auto px-4">
    <div class="flex justify-between items-center mb-8">
      <h1 class="text-3xl font-bold text-center text-pink-600">
        📝 오답 노트
      </h1>
      <button
        on:click={openQuizModal}
        class="bg-white border-2 border-pink-500 text-pink-500 hover:bg-pink-50 px-4 py-2 rounded-full transition-colors duration-200"
      >
        오답 시험 보기 ✍️
      </button>
    </div>

    {#if !isLoading && quizHistory.length > 0}
      <WrongAnswersStats {wrongAnswers} {quizHistory} {groups} />
    {/if}

    <!-- Quiz Mode Selection Modal -->
    {#if showQuizSettingsModal}
      <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div class="bg-white rounded-lg p-6 max-w-md w-full">
          <h2 class="text-xl font-bold mb-6 text-pink-600">오답 시험 설정</h2>
          
          <div class="space-y-6">
            <div>
              <p class="text-sm font-medium text-gray-700 mb-2">시험 범위 선택</p>
              <div class="grid grid-cols-3 gap-2">
                <button
                  class="px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 
                    {quizMode === 'all' ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
                  on:click={() => handleModeChange('all')}
                >
                  전체 오답
                  {#if Object.keys(wrongAnswers).length > 0}
                    <span class="text-xs">
                      ({getUniqueWrongAnswersCount('all')}개)
                    </span>
                  {/if}
                </button>
                <button
                  class="px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 
                    {quizMode === 'group' ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
                  on:click={() => handleModeChange('group')}
                >
                  그룹별
                </button>
                <button
                  class="px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 
                    {quizMode === 'list' ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
                  on:click={() => handleModeChange('list')}
                >
                  단어장별
                </button>
              </div>
            </div>

            {#if quizMode === 'group'}
              <div>
                <p class="text-sm font-medium text-gray-700 mb-2">그룹 선택</p>
                <select
                  bind:value={selectedGroupId}
                  class="w-full p-2 border rounded-lg"
                >
                  <option value="">그룹을 선택하세요</option>
                  {#each groups as group}
                    <option value={group.id}>
                      {group.title}
                      {#if Object.keys(wrongAnswers).length > 0}
                        ({getUniqueWrongAnswersCount('group', group.id)}개의 오답)
                      {/if}
                    </option>
                  {/each}
                </select>
              </div>
            {/if}

            {#if quizMode === 'list'}
              <div>
                <p class="text-sm font-medium text-gray-700 mb-2">단어장 선택</p>
                <select
                  bind:value={selectedQuizId}
                  class="w-full p-2 border rounded-lg"
                >
                  <option value="">단어장을 선택하세요</option>
                  {#each getUniqueVocabularyLists() as list}
                    <option value={list.id}>
                      {list.groupTitle ? `${list.groupTitle} - ` : ''}{list.title}
                      ({Object.values(wrongAnswers)
                        .flat()
                        .filter(answer => {
                          const quiz = quizHistory.find(q => q.id === answer.quiz_id);
                          return quiz?.list_id === list.id;
                        })
                        .reduce((uniqueWords, answer) => {
                          uniqueWords.add(answer.vocabulary_words.word);
                          return uniqueWords;
                        }, new Set()).size}개의 오답)
                    </option>
                  {/each}
                </select>
              </div>
            {/if}

            <div class="flex justify-end space-x-2 pt-4">
              <button
                on:click={() => showQuizSettingsModal = false}
                class="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                취소
              </button>
              <button
                on:click={startQuiz}
                disabled={
                  (quizMode === 'group' && !selectedGroupId) ||
                  (quizMode === 'list' && !selectedQuizId)
                }
                class="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                시험 시작하기
              </button>
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Quiz Modal -->
    <QuizModal
      show={showQuizModal}
      vocabularyData={quizVocabularyData}
      isWrongAnswersQuiz={true}
      quizTitle={`오답 노트 - ${
        quizMode === 'all' ? '전체 오답' :
        quizMode === 'group' ? groups.find(g => g.id === selectedGroupId)?.title :
        quizHistory.find(q => q.id === selectedQuizId)?.vocabulary_lists.title
      } 시험`}
      on:close={() => {
        showQuizModal = false;
        quizVocabularyData = [];
      }}
      on:batchCorrect={async (event) => {
        const { words } = event.detail;
        
        // 각 단어에 대해 정답 처리
        for (const word of words) {
          // 해당 단어의 모든 오답 찾기
          const wrongAnswersToCorrect = Object.values(wrongAnswers)
            .flat()
            .filter(answer => answer.vocabulary_words.word === word.word);

          // 각 오답을 정답으로 처리
          for (const answer of wrongAnswersToCorrect) {
            const quiz = quizHistory.find(q => q.id === answer.quiz_id);
            if (quiz) {
              // 퀴즈 점수 업데이트
              await updateQuizScore(answer.quiz_id);
            }

            // 오답 목록에서 제거
            Object.keys(wrongAnswers).forEach(quizId => {
              wrongAnswers[quizId] = wrongAnswers[quizId].filter(a => a.id !== answer.id);
            });
          }

          // Supabase에서 해당 답안들을 정답으로 업데이트
          if (supabase) {
            const { error } = await supabase
              .from('quiz_answers')
              .update({ is_correct: true })
              .in('id', wrongAnswersToCorrect.map(a => a.id));

            if (error) {
              console.error('Error updating answers:', error);
            }
          }
        }

        // UI 업데이트
        wrongAnswers = wrongAnswers;
        
        // 모달 닫기
        showQuizModal = false;
        quizVocabularyData = [];
      }}
    />

    {#if isLoading}
      <div class="text-center text-gray-600">
        <p>로딩 중...</p>
      </div>
    {:else if quizHistory.length === 0}
      <div class="text-center text-gray-600">
        <p>아직 시험 기록이 없습니다.</p>
      </div>
    {:else}
      <div class="grid gap-6 md:grid-cols-2">
        <!-- 퀴즈 목록 -->
        <div class="bg-white rounded-lg shadow-md p-6">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold text-pink-600">시험 기록</h2>
            <div class="flex items-center space-x-2">
              <button
                class="px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 {!showAllWrongAnswers ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
                on:click={() => handleViewModeChange(false)}
              >
                개별 보기
              </button>
              <button
                class="px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 {showAllWrongAnswers ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
                on:click={() => handleViewModeChange(true)}
              >
                전체 보기
              </button>
            </div>
          </div>
          <div class="space-y-4 {showAllWrongAnswers ? 'opacity-50' : ''}">
            {#each quizHistory as quiz}
              <div class="relative">
                <div
                  class="w-full text-left p-4 rounded-lg border-2 transition-colors duration-200 cursor-pointer group
                    {selectedQuizId === quiz.id
                      ? 'border-pink-500 bg-pink-50'
                      : 'border-gray-200 hover:border-pink-300 hover:bg-pink-50'}"
                  on:click={() => !showAllWrongAnswers && handleQuizSelect(quiz.id)}
                  on:keydown={(e) => e.key === 'Enter' && !showAllWrongAnswers && handleQuizSelect(quiz.id)}
                  role="button"
                  tabindex="0"
                >
                  <div class="flex justify-between items-start">
                    <div>
                      {#if quiz.vocabulary_lists.vocabulary_groups?.title}
                        <p class="text-xs text-gray-500 mb-1">
                          {quiz.vocabulary_lists.vocabulary_groups.title}
                        </p>
                      {/if}
                      <p class="font-medium text-gray-800">{quiz.vocabulary_lists.title}</p>
                      <p class="text-sm text-gray-600 mt-1">
                        {formatDate(quiz.created_at)}
                      </p>
                    </div>
                    <div class="text-right">
                      <ScoreAnimation score={quiz.score} total={quiz.total_questions} />
                    </div>
                  </div>
                </div>
                <button
                  class="absolute top-2 right-2 p-2 text-gray-400 hover:text-pink-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  on:click|stopPropagation={() => {
                    quizToDelete = quiz.id;
                    showDeleteConfirm = true;
                  }}
                  title="시험 기록 삭제"
                  type="button"
                >
                  🗑️
                </button>
              </div>
            {/each}
          </div>
        </div>

        <!-- 틀린 답안 목록 -->
        <div class="bg-white rounded-lg shadow-md p-6">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold text-pink-600">
              {showAllWrongAnswers ? '전체 틀린 답안' : '틀린 답안'}
            </h2>
            {#if filteredAnswers.length > 0}
              <div class="text-sm text-gray-600">
                총 {filteredAnswers.length}개의 틀린 답안
              </div>
            {/if}
          </div>

          {#if !selectedQuizId && !showAllWrongAnswers}
            <p class="text-center text-gray-600">
              시험을 선택하면 틀린 답안을 볼 수 있습니다.
            </p>
          {:else if filteredAnswers.length === 0}
            <p class="text-center text-gray-600">
              {showAllWrongAnswers ? '아직 틀린 답안이 없습니다.' : '이 시험에서는 틀린 답안이 없습니다! 🎉'}
            </p>
          {:else}
            <div class="space-y-4">
              {#each filteredAnswers as answer}
                <div class="p-4 rounded-lg bg-pink-50 border border-pink-200">
                  <div class="flex justify-between items-start">
                    <div class="flex-1">
                      <div class="flex items-center gap-2">
                        <p class="font-bold text-gray-800">{answer.vocabulary_words.word}</p>
                        {#if answer.vocabulary_words.part_of_speech}
                          <span class="text-xs px-2 py-1 bg-pink-100 text-pink-600 rounded-full">
                            {answer.vocabulary_words.part_of_speech}
                          </span>
                        {/if}
                      </div>
                      {#if showAllWrongAnswers}
                        <p class="text-xs text-gray-500 mt-1">
                          {answer.quiz_title} ({formatDate(answer.quiz_date)})
                        </p>
                      {/if}
                      <div class="mt-2">
                        <p class="text-sm text-gray-600">내 답: {answer.user_answer || '미입력'}</p>
                        <p class="text-sm text-pink-600 font-medium">정답: {answer.vocabulary_words.meaning}</p>
                        {#if answer.explanation}
                          <p class="text-xs text-gray-500 mt-2 bg-white p-2 rounded-lg">
                            💡 {answer.explanation}
                          </p>
                        {/if}
                      </div>
                    </div>
                    <div>
                      <CorrectAnswerButton
                        answerId={answer.id}
                        quizId={answer.quiz_id}
                        onAnswerMarkedCorrect={() => {
                          if (showAllWrongAnswers) {
                            Object.keys(wrongAnswers).forEach(quizId => {
                              wrongAnswers[quizId] = wrongAnswers[quizId].filter(a => a.id !== answer.id);
                            });
                            wrongAnswers = wrongAnswers;
                          } else {
                            wrongAnswers[selectedQuizId] = wrongAnswers[selectedQuizId].filter(a => a.id !== answer.id);
                            wrongAnswers = wrongAnswers;
                          }
                        }}
                        onQuizScoreUpdate={updateQuizScore}
                      />
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

{#if showDeleteConfirm}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
    <div class="bg-white rounded-lg p-6 max-w-sm w-full shadow-xl text-center">
      <h3 class="text-xl font-bold mb-4 text-gray-800">시험 기록을 삭제하시겠습니까?</h3>
      <p class="text-gray-600 mb-6">
        이 작업은 되돌릴 수 없으며, 관련된 모든 답안 기록도 함께 삭제됩니다.
      </p>
      <div class="flex justify-center space-x-4">
        <button
          on:click={() => {
            showDeleteConfirm = false;
            quizToDelete = null;
          }}
          class="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full"
        >
          취소
        </button>
        <button
          on:click={handleDeleteQuiz}
          class="px-6 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-full"
        >
          삭제
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .container {
    max-width: 1200px;
  }
</style> 