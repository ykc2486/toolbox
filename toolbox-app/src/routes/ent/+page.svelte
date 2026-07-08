<script lang="ts">
	import { onMount } from 'svelte';
	import { analyzeEntropy, type EntropyMode, type EntropyResult } from '$lib/crypto/entropy';

	let mounted = $state(false);

	// UI state
	let currentMode = $state<EntropyMode>('byte');

	// File state
	let targetFile: File | null = $state(null);

	// Drag state
	let isDragging = $state(false);

	// Status state
	let statusMessage = $state('Ready to analyze file entropy and randomness.');
	let errorMessage = $state('');
	let isBusy = $state(false);
	let actionLabel = $state('Idle');

	// Result state
	let analysisResult: EntropyResult | null = $state(null);

	// 使用 $derived 計算進度條百分比，避免在 template 中重複呼叫函式 (Function usage optimization)
	let entropyPercent = $derived(
		analysisResult ? getEntropyPercentage((analysisResult as EntropyResult).entropy, currentMode) : 0
	);

	onMount(() => {
		mounted = true;
	});

	// Switch between byte and bit mode
	async function switchMode(mode: EntropyMode) {
		currentMode = mode;
		if (targetFile) {
			await processFile();
		}
	}

	// Format file size into readable string
	function formatBytes(size: number) {
		if (size === 0) return '0 B';
		const units = ['B', 'KB', 'MB', 'GB'];
		const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
		return `${(size / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
	}

	// Handle file selection from input
	async function handleFileSelect(event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			targetFile = target.files[0];
			await processFile();
		}
		target.value = ''; // Reset input
	}

	// Drag and drop event handlers
	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
	}

	async function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
			targetFile = e.dataTransfer.files[0];
			await processFile();
		}
	}

	// Remove current file and clear results
	function removeFile() {
		targetFile = null;
		analysisResult = null;
		errorMessage = '';
		actionLabel = 'Idle';
		statusMessage = 'Ready to analyze file entropy and randomness.';
	}

	// Core analysis function
	async function processFile() {
		if (!targetFile) return;

		errorMessage = '';
		isBusy = true;
		actionLabel = 'Analyzing';
		statusMessage = `Calculating entropy data for ${targetFile.name}...`;

		try {
			// Read file into memory
			const buffer = await targetFile.arrayBuffer();
			const uint8Array = new Uint8Array(buffer);

			// Run analysis
			analysisResult = await analyzeEntropy(uint8Array, currentMode);

			actionLabel = 'Analysis Complete';
			statusMessage = `Successfully analyzed ${formatBytes(targetFile.size)}.`;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'An error occurred while analyzing the file.';
			actionLabel = 'Error';
			statusMessage = 'File analysis failed.';
			analysisResult = null;
		} finally {
			isBusy = false;
		}
	}

	// Calculate percentage for progress bars based on mode
	function getEntropyPercentage(entropy: number, mode: EntropyMode) {
		const max = mode === 'byte' ? 8 : 1;
		return Math.min(100, Math.max(0, (entropy / max) * 100));
	}
</script>

<svelte:head>
	<title>Toolbox | ENT</title>
</svelte:head>

<!-- Dark background matching securezip style -->
<div
	class="min-h-[calc(100dvh-4rem-env(safe-area-inset-top,0px))] bg-[#0a0c10] text-zinc-100 flex flex-col items-center justify-center px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+24px)] sm:px-6 lg:px-8"
>
	<!-- Soft glow background effects -->
	<div class="pointer-events-none fixed inset-0 overflow-hidden">
		<div
			class="absolute left-1/4 top-0 h-96 w-96 -translate-y-1/2 rounded-full bg-blue-500/5 blur-[100px]"
		></div>
		<div
			class="absolute right-1/4 bottom-0 h-96 w-96 translate-y-1/2 rounded-full bg-indigo-500/5 blur-[100px]"
		></div>
	</div>

	<main
		class={`relative z-10 w-full max-w-2xl transition-all duration-700 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
	>
		<!-- Header -->
		<header class="mb-4 text-center">
			<h1 class="text-3xl font-semibold tracking-tight text-white">ENT</h1>
			<p class="mt-2 text-sm text-zinc-400">Test data randomness and compression potential</p>
		</header>

		<!-- Status panel -->
		<section
			class="mb-6 rounded-2xl border border-white/5 bg-zinc-800/50 p-5 shadow-lg shadow-black/20 backdrop-blur-xl"
		>
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<div class="flex items-center gap-2">
						<span class="relative flex h-2.5 w-2.5">
							{#if isBusy}
								<span
									class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"
								></span>
								<span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
							{:else if actionLabel === 'Error'}
								<span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
							{:else if actionLabel === 'Analysis Complete'}
								<span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
							{:else}
								<span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-zinc-500"></span>
							{/if}
						</span>
						<p class="text-sm font-medium text-white">{actionLabel}</p>
					</div>
					<p class="mt-1 text-sm text-zinc-400">{statusMessage}</p>
				</div>
			</div>

			<!-- Error message display -->
			{#if errorMessage}
				<div
					class="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
				>
					{errorMessage}
				</div>
			{/if}
		</section>

		<!-- Main interactive card -->
		<section
			class="rounded-3xl border border-white/5 bg-zinc-800/80 p-6 shadow-xl shadow-black/20 backdrop-blur-md"
		>
			<!-- Mode toggle switch -->
			<div class="relative mb-8 flex w-full rounded-xl bg-zinc-900/80 p-1 border border-white/5">
				<!-- Sliding background indicator -->
				<div
					class="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-zinc-700 transition-transform duration-300 ease-out shadow-sm"
					style="transform: translateX({currentMode === 'bit' ? '100%' : '0'});"
				></div>

				<button
					disabled={isBusy}
					class={`relative z-10 flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${currentMode === 'byte' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
					onclick={() => switchMode('byte')}
				>
					Byte Mode (8-bit)
				</button>
				<button
					disabled={isBusy}
					class={`relative z-10 flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${currentMode === 'bit' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
					onclick={() => switchMode('bit')}
				>
					Bit Mode (1-bit)
				</button>
			</div>

			<div class="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
				<!-- File selection area -->
				<div>
					<span class="block text-sm font-medium text-zinc-300 mb-2">Target File</span>

					{#if !targetFile}
						<!-- Empty state dropzone -->
						<input
							type="file"
							id="file-upload"
							onchange={handleFileSelect}
							class="hidden"
							disabled={isBusy}
						/>
						<label
							for="file-upload"
							ondragover={handleDragOver}
							ondragleave={handleDragLeave}
							ondrop={handleDrop}
							class={`cursor-pointer flex flex-col items-center justify-center w-full rounded-2xl border border-dashed px-4 py-8 text-sm transition-colors ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-zinc-600 bg-zinc-900/30 hover:bg-zinc-700/30 hover:border-zinc-500'}`}
						>
							<span class={`font-medium ${isDragging ? 'text-blue-300' : 'text-zinc-300'}`}>
								{isDragging ? 'Drop to load file' : 'Click or drag file here'}
							</span>
							<span class={`text-xs mt-1 ${isDragging ? 'text-blue-400/70' : 'text-zinc-500'}`}>
								Supports analysis for any file format
							</span>
						</label>
					{:else}
						<!-- Selected file display -->
						<div
							class="flex items-center justify-between rounded-2xl bg-zinc-900/80 px-4 py-3 border border-white/5"
						>
							<div class="flex flex-col overflow-hidden pr-4">
								<span class="text-sm font-medium text-zinc-200 truncate">{targetFile.name}</span>
								<span class="text-xs text-zinc-500 mt-0.5">{formatBytes(targetFile.size)}</span>
							</div>
							<button
								type="button"
								onclick={removeFile}
								disabled={isBusy}
								class="p-2 text-zinc-400 hover:text-rose-400 hover:bg-rose-400/10 disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-zinc-400 rounded-lg transition-colors shrink-0"
								title="Remove file"
								aria-label="Remove file"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="18"
									height="18"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"
									></line></svg
								>
							</button>
						</div>
					{/if}
				</div>

				<!-- Analysis Results Display -->
				{#if analysisResult && !isBusy}
					<div class="mt-6 space-y-4 animate-in fade-in duration-500">
						<h3 class="text-sm font-medium text-zinc-300 border-b border-white/10 pb-2">Analysis Report</h3>
						
						<!-- Primary metric: Entropy (Enhanced with subtle light-gray backlight) -->
						<div class="relative rounded-2xl border border-zinc-400/40 bg-zinc-900/60 p-5 shadow-[0_0_20px_rgba(212,212,216,0.15)] overflow-hidden">
							<!-- 內部微弱漸層 (Subtle inner gradient for depth) -->
							<div class="absolute inset-0 bg-gradient-to-b from-zinc-300/5 to-transparent pointer-events-none"></div>
							
							<div class="relative flex items-center justify-between mb-3">
								<span class="text-sm font-medium text-zinc-300">Entropy</span>
								<span class="text-lg font-bold text-white shadow-sm">
									{analysisResult.entropy.toFixed(5)} 
									<span class="text-xs font-normal text-zinc-400">
										{currentMode === 'byte' ? 'bits/byte' : 'bits/bit'}
									</span>
								</span>
							</div>
							<!-- Entropy visual bar using derived state -->
							<div class="relative h-2.5 overflow-hidden rounded-full bg-zinc-950 border border-black/50">
								<div
									class={`h-full rounded-full transition-all duration-700 shadow-[0_0_10px_currentColor] ${entropyPercent > 95 ? 'bg-emerald-400 text-emerald-400' : entropyPercent > 70 ? 'bg-blue-400 text-blue-400' : 'bg-amber-400 text-amber-400'}`}
									style={`width: ${entropyPercent}%`}
								></div>
							</div>
							<p class="relative text-xs text-zinc-400 mt-3">
								Values closer to {currentMode === 'byte' ? '8' : '1'} indicate higher randomness (e.g., encrypted or compressed files).
							</p>
						</div>

						<!-- Secondary metrics grid with 3D Flip Cards -->
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
							
							<!-- Optimum Compression -->
							<div class="group [perspective:1000px] cursor-pointer" tabindex="0" role="button">
								<div class="relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)] focus-within:[transform:rotateY(180deg)]">
									<!-- Front -->
									<div class="w-full h-full min-h-[96px] rounded-xl border border-white/5 bg-zinc-900/30 p-3 [backface-visibility:hidden] flex flex-col justify-between">
										<div class="flex justify-between items-start">
											<span class="block text-xs text-zinc-500">Optimum Compression</span>
											<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-zinc-600 group-hover:text-zinc-400 transition-colors"><path d="M21 2v6h-6"></path><path d="M21 13a9 9 0 1 1-3-7.7L21 8"></path></svg>
										</div>
										<div class="flex items-end gap-1 mt-1">
											<span class="text-lg font-semibold text-zinc-200">{analysisResult.optimumCompression}%</span>
											<span class="text-xs text-zinc-500 mb-1">space reduction</span>
										</div>
									</div>
									<!-- Back -->
									<div class="absolute inset-0 w-full h-full rounded-xl border border-blue-500/30 bg-zinc-800 p-3 [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col justify-center">
										<span class="text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-1">Meaning</span>
										<p class="text-[11px] text-zinc-300 leading-snug">Theoretical maximum size reduction. Higher entropy means lower compressibility.</p>
									</div>
								</div>
							</div>

							<!-- Mean -->
							<div class="group [perspective:1000px] cursor-pointer" tabindex="0" role="button">
								<div class="relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)] focus-within:[transform:rotateY(180deg)]">
									<div class="w-full h-full min-h-[96px] rounded-xl border border-white/5 bg-zinc-900/30 p-3 [backface-visibility:hidden] flex flex-col justify-between">
										<div class="flex justify-between items-start">
											<span class="block text-xs text-zinc-500">Arithmetic Mean</span>
											<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-zinc-600 group-hover:text-zinc-400 transition-colors"><path d="M21 2v6h-6"></path><path d="M21 13a9 9 0 1 1-3-7.7L21 8"></path></svg>
										</div>
										<div class="flex items-end gap-1 mt-1">
											<span class="text-lg font-semibold text-zinc-200">{analysisResult.mean.toFixed(2)}</span>
											<span class="text-xs text-zinc-500 mb-1">
												(Expected: {currentMode === 'byte' ? '127.5' : '0.5'})
											</span>
										</div>
									</div>
									<div class="absolute inset-0 w-full h-full rounded-xl border border-blue-500/30 bg-zinc-800 p-3 [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col justify-center">
										<span class="text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-1">Meaning</span>
										<p class="text-[11px] text-zinc-300 leading-snug">Average value. Truly random data approaches expected values. Deviations imply patterns.</p>
									</div>
								</div>
							</div>

							<!-- Chi-Square -->
							<div class="group [perspective:1000px] cursor-pointer" tabindex="0" role="button">
								<div class="relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)] focus-within:[transform:rotateY(180deg)]">
									<div class="w-full h-full min-h-[96px] rounded-xl border border-white/5 bg-zinc-900/30 p-3 [backface-visibility:hidden] flex flex-col justify-between">
										<div class="flex justify-between items-start">
											<span class="block text-xs text-zinc-500">Chi-Square Distribution</span>
											<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-zinc-600 group-hover:text-zinc-400 transition-colors"><path d="M21 2v6h-6"></path><path d="M21 13a9 9 0 1 1-3-7.7L21 8"></path></svg>
										</div>
										<div>
											<div class="flex items-end gap-1 mt-1">
												<span class="text-lg font-semibold text-zinc-200">{analysisResult.chiSquare.toFixed(2)}</span>
											</div>
											<span class="block text-[10px] text-zinc-500 mt-0.5">
												Probability: {analysisResult.chiSquarePercent.toFixed(2)}%
											</span>
										</div>
									</div>
									<div class="absolute inset-0 w-full h-full rounded-xl border border-blue-500/30 bg-zinc-800 p-3 [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col justify-center">
										<span class="text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-0.5">Meaning</span>
										<p class="text-[11px] text-zinc-300 leading-snug">Evaluates uniformity. Near 50% means highly random; extremes (&lt;1% or &gt;99%) imply patterns.</p>
									</div>
								</div>
							</div>

							<!-- Monte Carlo Pi -->
							<div class="group [perspective:1000px] cursor-pointer" tabindex="0" role="button">
								<div class="relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)] focus-within:[transform:rotateY(180deg)]">
									<div class="w-full h-full min-h-[96px] rounded-xl border border-white/5 bg-zinc-900/30 p-3 [backface-visibility:hidden] flex flex-col justify-between">
										<div class="flex justify-between items-start">
											<span class="block text-xs text-zinc-500">Monte Carlo Pi</span>
											<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-zinc-600 group-hover:text-zinc-400 transition-colors"><path d="M21 2v6h-6"></path><path d="M21 13a9 9 0 1 1-3-7.7L21 8"></path></svg>
										</div>
										<div>
											<div class="flex items-end gap-1 mt-1">
												<span class="text-lg font-semibold text-zinc-200">{analysisResult.monteCarloPi.toFixed(5)}</span>
											</div>
											<span class="block text-[10px] text-zinc-500 mt-0.5">
												Error: {analysisResult.monteCarloPiError.toFixed(4)}%
											</span>
										</div>
									</div>
									<div class="absolute inset-0 w-full h-full rounded-xl border border-blue-500/30 bg-zinc-800 p-3 [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col justify-center">
										<span class="text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-0.5">Meaning</span>
										<p class="text-[11px] text-zinc-300 leading-snug">Estimates Pi using data as coords. The closer the error is to 0%, the more random the sequence.</p>
									</div>
								</div>
							</div>

							<!-- Serial Correlation -->
							<div class="group [perspective:1000px] cursor-pointer sm:col-span-2" tabindex="0" role="button">
								<div class="relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)] focus-within:[transform:rotateY(180deg)]">
									<div class="w-full h-full min-h-[96px] rounded-xl border border-white/5 bg-zinc-900/30 p-3 [backface-visibility:hidden] flex flex-col justify-between">
										<div class="flex justify-between items-start">
											<span class="block text-xs text-zinc-500">Serial Correlation</span>
											<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-zinc-600 group-hover:text-zinc-400 transition-colors"><path d="M21 2v6h-6"></path><path d="M21 13a9 9 0 1 1-3-7.7L21 8"></path></svg>
										</div>
										<div>
											<div class="flex items-end gap-1 mt-1">
												<span class="text-lg font-semibold text-zinc-200">{analysisResult.serialCorrelation.toFixed(6)}</span>
											</div>
											<span class="block text-[10px] text-zinc-500 mt-0.5">
												Values closer to 0 indicate lower correlation between bits/bytes.
											</span>
										</div>
									</div>
									<div class="absolute inset-0 w-full h-full rounded-xl border border-blue-500/30 bg-zinc-800 p-4 [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col justify-center">
										<span class="text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-1">Meaning</span>
										<p class="text-[11px] text-zinc-300 leading-snug">Measures dependency between consecutive values. Near 0 means highly independent and random.</p>
									</div>
								</div>
							</div>

						</div>
					</div>
				{/if}
			</div>
		</section>
	</main>
</div>