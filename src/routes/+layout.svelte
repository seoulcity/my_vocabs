<script lang="ts">
	import { page } from '$app/stores';
	import '../app.css';
</script>

<div class="min-h-screen bg-pink-50 flex flex-col">
	<!-- Navigation -->
	<nav class="bg-white shadow-sm">
		<div class="container mx-auto px-4">
			<div class="flex justify-between items-center h-16">
				<div class="flex items-center">
					<a href="/" class="text-2xl font-bold text-pink-600">
						✨ 꾜리의 Power 단어공부
					</a>
				</div>
				<div class="flex space-x-4">
					<a
						href="/"
						class="px-4 py-2 rounded-full transition-colors duration-200 {$page.url.pathname === '/' ? 'bg-pink-500 text-white' : 'text-pink-600 hover:bg-pink-50'}"
					>
						📚 단어장
					</a>
					<a
						href="/wrong-answers"
						class="px-4 py-2 rounded-full transition-colors duration-200 {$page.url.pathname === '/wrong-answers' ? 'bg-pink-500 text-white' : 'text-pink-600 hover:bg-pink-50'}"
					>
						📝 오답 노트
					</a>
				</div>
			</div>
		</div>
	</nav>

	<!-- Main Content -->
	<div class="flex-1">
		<slot />
	</div>
</div>

<style>
	:global(body) {
		background-color: #fdf2f8;
	}
</style>
