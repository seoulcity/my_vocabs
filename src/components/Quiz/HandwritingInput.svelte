<!-- src/components/Quiz/HandwritingInput.svelte -->
<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { recognizeText } from '../../lib/services/naverOcr';
  import { fade, fly } from 'svelte/transition';
  
  export let width = 400;
  export let height = 200;
  export let word: string = '';
  
  let inputLang: 'ko' | 'en' = 'ko'; // 기본값은 한국어
  const dispatch = createEventDispatcher();
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;
  let isRecognizing = false;
  let recognizedText = '';
  let showRecognitionResult = false;
  let hasDrawing = false;
  let recognitionTimeout: NodeJS.Timeout;
  
  // 캐시 구현
  const recognitionCache = new Map<string, string>();

  // 실제 픽셀 크기는 표시 크기의 1/2로 설정
  const SCALE_FACTOR = 0.5;
  const actualWidth = width * SCALE_FACTOR;
  const actualHeight = height * SCALE_FACTOR;

  onMount(() => {
    setupCanvas();
    return () => {
      if (recognitionTimeout) clearTimeout(recognitionTimeout);
    };
  });

  function setupCanvas() {
    ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    
    canvas.width = actualWidth;
    canvas.height = actualHeight;
    
    // 흰 배경 설정
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, actualWidth, actualHeight);
    
    // 모눈 그리기
    drawGrid();
  }

  // 모눈 그리기 함수 추가
  function drawGrid() {
    const gridSize = actualHeight / 4; // 4등분 (3줄)
    
    ctx.beginPath();
    ctx.strokeStyle = '#e5e7eb'; // 연한 회색
    ctx.lineWidth = 0.5;

    // 가로선 (받침선)
    ctx.beginPath();
    ctx.moveTo(0, actualHeight * 0.75);
    ctx.lineTo(actualWidth, actualHeight * 0.75);
    ctx.stroke();

    // 가운데 기준선 (점선)
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(0, actualHeight * 0.5);
    ctx.lineTo(actualWidth, actualHeight * 0.5);
    ctx.stroke();

    // 세로 모눈
    ctx.setLineDash([]);
    for (let x = gridSize; x < actualWidth; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, actualHeight);
      ctx.stroke();
    }

    // 원래 펜 설정 복구
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
  }

  // 디바운스된 인식 함수
  function debounceRecognition() {
    if (recognitionTimeout) clearTimeout(recognitionTimeout);
    if (!hasDrawing) return;

    recognitionTimeout = setTimeout(async () => {
      await recognizeHandwriting();
    }, 380); // 사용자가 그리기를 멈추고 0.38초 후 자동 인식
  }

  function draw(e: MouseEvent | TouchEvent) {
    if (!isDrawing) return;
    e.preventDefault();
    
    const pos = getPosition(e);
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    
    lastX = pos.x;
    lastY = pos.y;
    hasDrawing = true;

    // 그리는 동안 디바운스된 인식 실행
    debounceRecognition();
  }

  function startDrawing(e: MouseEvent | TouchEvent) {
    isDrawing = true;
    const pos = getPosition(e);
    lastX = pos.x;
    lastY = pos.y;
  }

  function stopDrawing() {
    isDrawing = false;
    if (hasDrawing) {
      debounceRecognition();
    }
  }

  function getPosition(e: MouseEvent | TouchEvent) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = actualWidth / rect.width;
    const scaleY = actualHeight / rect.height;
    
    if (e instanceof MouseEvent) {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    } else {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
      };
    }
  }

  function clearCanvas() {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, actualWidth, actualHeight);
    drawGrid(); // 모눈 다시 그리기
    hasDrawing = false;
    showRecognitionResult = false;
    recognizedText = '';
    dispatch('clear');
  }

  function submit() {
    // Canvas 데이터를 base64 문자열로 변환
    const imageData = canvas.toDataURL('image/jpeg', 0.5);
    dispatch('submit', { imageData });
    clearCanvas();
  }

  function downloadImage() {
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0,19).replace(/[:]/g, '-');
    
    // JPEG 포맷으로 변경하고 품질을 0.5로 설정 (0.0 ~ 1.0)
    // 필기의 경우 흑백이므로 JPEG로 충분합니다
    link.download = `${word}_${timestamp}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.5);
    link.click();
  }

  async function recognizeHandwriting() {
    if (isRecognizing || !hasDrawing) return;
    
    isRecognizing = true;
    const imageData = canvas.toDataURL('image/jpeg', 0.5);
    
    // 캐시 확에 언어 정보 포함
    const cacheKey = `${imageData}_${inputLang}`;
    if (recognitionCache.has(cacheKey)) {
      recognizedText = recognitionCache.get(cacheKey)!;
      showRecognitionResult = true;
      isRecognizing = false;
      return;
    }

    try {
      recognizedText = await recognizeText(imageData, inputLang);
      
      // 캐시 저장
      recognitionCache.set(cacheKey, recognizedText);
      
      if (recognizedText && !showRecognitionResult) {
        showRecognitionResult = true;
      }
    } catch (error) {
      console.error('Error recognizing handwriting:', error);
      recognizedText = '인식 실패';
    } finally {
      isRecognizing = false;
    }
  }

  function confirmAndSubmit() {
    dispatch('submit', { text: recognizedText });
    clearCanvas();
  }
</script>

<div class="handwriting-input" transition:fade>
  <div class="flex justify-end mb-2">
    <div class="inline-flex rounded-lg border border-gray-200">
      <button
        class="px-4 py-2 rounded-l-lg {inputLang === 'ko' ? 'bg-pink-500 text-white' : 'bg-white text-gray-600'}"
        on:click={() => inputLang = 'ko'}
      >
        한국어
      </button>
      <button
        class="px-4 py-2 rounded-r-lg {inputLang === 'en' ? 'bg-pink-500 text-white' : 'bg-white text-gray-600'}"
        on:click={() => inputLang = 'en'}
      >
        English
      </button>
    </div>
  </div>

  <canvas
    bind:this={canvas}
    on:mousedown={startDrawing}
    on:mousemove={draw}
    on:mouseup={stopDrawing}
    on:mouseleave={stopDrawing}
    on:touchstart={startDrawing}
    on:touchmove={draw}
    on:touchend={stopDrawing}
    class="border border-pink-200 rounded-lg transition-all duration-200"
    class:opacity-50={isRecognizing}
    style="width: {width}px; height: {height}px;"
  ></canvas>
  
  <div class="flex justify-between mt-2 gap-2">
    <button
      on:click={clearCanvas}
      class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full text-sm transition-colors duration-200"
    >
      지우기
    </button>
    <div class="flex gap-2">
      {#if !showRecognitionResult}
        <button
          on:click={recognizeHandwriting}
          disabled={isRecognizing || !hasDrawing}
          class="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-full text-sm disabled:opacity-50 transition-all duration-200"
        >
          {#if isRecognizing}
            <div class="flex items-center">
              <span class="loading-dots">인식 중</span>
            </div>
          {:else}
            ✨ 입력
          {/if}
        </button>
      {:else}
        <div class="flex items-center gap-2" transition:fly={{ y: 20, duration: 200 }}>
          <span class="text-sm text-gray-600">
            인식결과: <strong class="text-pink-600">{recognizedText}</strong>
          </span>
          <button
            on:click={confirmAndSubmit}
            class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-full text-sm transition-colors duration-200"
          >
            확인
          </button>
          <button
            on:click={() => {
              showRecognitionResult = false;
              clearCanvas();
            }}
            class="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-full text-sm transition-colors duration-200"
          >
            다시쓰기
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  canvas {
    touch-action: none;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }

  .loading-dots::after {
    content: '...';
    animation: dots 1.5s steps(4, end) infinite;
  }

  @keyframes dots {
    0%, 20% { content: ''; }
    40% { content: '.'; }
    60% { content: '..'; }
    80% { content: '...'; }
  }

  /* 부드러운 전환을 위한 스타일 */
  :global(.handwriting-input) {
    transition: all 0.2s ease-in-out;
  }
</style> 