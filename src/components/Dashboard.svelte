<script lang="ts">
  import { createClient } from '@supabase/supabase-js';
  import { browser } from '$app/environment';
  import DashboardLearningStatus from './DashboardLearningStatus.svelte';
  import DashboardQuizStats from './DashboardQuizStats.svelte';
  import DashboardTotalStats from './DashboardTotalStats.svelte';
  import StudyCalendar from './StudyCalendar.svelte';

  // 환경 변수 체크
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const supabase = browser && SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  // 대시보드 데이터 타입 정의
  type DashboardStats = {
    recentWords: {
      count: number;
      trend: number;
    };
    quizStats: {
      totalQuizzes: number;
      totalWords: number;
      averageScore: number;
      scoresTrend: number[];
    };
    totalStats: {
      totalWords: number;
      totalLists: number;
      studyDays: number;
    };
    studyDates: Date[];
  };

  let dashboardStats: DashboardStats | null = null;

  // 대시보드 데이터 로드
  async function loadDashboardStats() {
    if (!browser || !supabase) return;

    try {
      // 1. 최근 7일간 추가된 단어 수
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const { data: recentWords, error: recentWordsError } = await supabase
        .from('vocabulary_words')
        .select('created_at')
        .gte('created_at', sevenDaysAgo.toISOString());

      const { data: previousWords, error: previousWordsError } = await supabase
        .from('vocabulary_words')
        .select('created_at')
        .gte('created_at', fourteenDaysAgo.toISOString())
        .lt('created_at', sevenDaysAgo.toISOString());

      // 2. 퀴즈 통계
      const { data: quizzes, error: quizzesError } = await supabase
        .from('quiz_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      // 3. 전체 통계
      const { data: totalWords, error: totalWordsError } = await supabase
        .from('vocabulary_words')
        .select('created_at');

      const { data: totalLists, error: totalListsError } = await supabase
        .from('vocabulary_lists')
        .select('id');

      if (recentWordsError || previousWordsError || quizzesError || totalWordsError || totalListsError) {
        throw new Error('Error loading dashboard stats');
      }

      // 학습일 계산 (단어 추가 또는 퀴즈를 푼 날짜의 unique 개수)
      const studyDates = new Set<string>();
      const allStudyDates: Date[] = [];
      
      totalWords?.forEach(word => {
        const date = new Date(word.created_at);
        const dateString = date.toDateString();
        if (!studyDates.has(dateString)) {
          studyDates.add(dateString);
          allStudyDates.push(date);
        }
      });
      
      quizzes?.forEach(quiz => {
        const date = new Date(quiz.created_at);
        const dateString = date.toDateString();
        if (!studyDates.has(dateString)) {
          studyDates.add(dateString);
          allStudyDates.push(date);
        }
      });

      // 퀴즈 점수 계산
      const quizScores = quizzes?.map(quiz => (quiz.score / quiz.total_questions) * 100) || [];
      const averageScore = quizScores.length > 0
        ? quizScores.reduce((a, b) => a + b, 0) / quizScores.length
        : 0;

      dashboardStats = {
        recentWords: {
          count: recentWords?.length || 0,
          trend: previousWords?.length
            ? ((recentWords?.length || 0) - previousWords.length) / previousWords.length * 100
            : 0
        },
        quizStats: {
          totalQuizzes: quizzes?.length || 0,
          totalWords: quizzes?.reduce((sum, quiz) => sum + quiz.total_questions, 0) || 0,
          averageScore,
          scoresTrend: quizScores.reverse()
        },
        totalStats: {
          totalWords: totalWords?.length || 0,
          totalLists: totalLists?.length || 0,
          studyDays: studyDates.size
        },
        studyDates: allStudyDates
      };
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }
  }

  // 컴포넌트 마운트 시 데이터 로드
  import { onMount } from 'svelte';
  onMount(loadDashboardStats);
</script>

<div class="mb-8 grid grid-cols-1 md:grid-cols-4 gap-6">
  {#if dashboardStats}
    <DashboardLearningStatus
      totalWords={dashboardStats.totalStats.totalWords}
      recentWords={dashboardStats.recentWords}
    />
    <DashboardQuizStats
      quizStats={dashboardStats.quizStats}
    />
    <DashboardTotalStats
      totalStats={{
        totalLists: dashboardStats.totalStats.totalLists,
        studyDays: dashboardStats.totalStats.studyDays
      }}
    />

    <!-- 학습 캘린더 -->
    <StudyCalendar studyDates={dashboardStats.studyDates} />
  {:else}
    <!-- 스켈레톤 UI -->
    <div class="bg-white rounded-lg shadow-sm p-6 relative overflow-hidden">
      <div class="animate-pulse">
        <div class="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div class="space-y-3">
          <div class="h-8 bg-gray-200 rounded w-2/3"></div>
          <div class="h-4 bg-gray-200 rounded w-1/2"></div>
          <div class="h-2 bg-gray-200 rounded w-full"></div>
          <div class="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
      <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent skeleton-loading"></div>
    </div>
    <div class="bg-white rounded-lg shadow-sm p-6 relative overflow-hidden">
      <div class="animate-pulse">
        <div class="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div class="space-y-3">
          <div class="h-8 bg-gray-200 rounded w-2/3"></div>
          <div class="h-4 bg-gray-200 rounded w-1/2"></div>
          <div class="space-y-1 mt-4">
            <div class="h-8 bg-gray-200 rounded w-full"></div>
            <div class="flex justify-between">
              <div class="h-3 bg-gray-200 rounded w-12"></div>
              <div class="h-3 bg-gray-200 rounded w-12"></div>
            </div>
          </div>
        </div>
      </div>
      <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent skeleton-loading"></div>
    </div>
    <div class="bg-white rounded-lg shadow-sm p-6 relative overflow-hidden">
      <div class="animate-pulse">
        <div class="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div class="grid grid-cols-7 gap-1">
          {#each Array(7) as _}
            <div class="h-4 bg-gray-200 rounded"></div>
          {/each}
          {#each Array(35) as _}
            <div class="aspect-square bg-gray-200 rounded"></div>
          {/each}
        </div>
      </div>
      <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent skeleton-loading"></div>
    </div>
  {/if}
</div>

<style>
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