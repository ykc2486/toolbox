<script lang="ts">
	import { onMount } from 'svelte';
	import { zipSync } from 'fflate';
	import zxcvbn from 'zxcvbn';
	import { decryptFiles, encryptFiles } from '$lib/crypto/secureZip';

	type OutputFile = {
		name: string;
		data: ArrayBuffer;
	};

	let mounted = $state(false);

	// UI state
	let currentMode = $state<'encrypt' | 'decrypt'>('encrypt');

	// File state
	let encryptFilesList: File[] = $state([]);
	let decryptFile: File | null = $state(null);

	// Drag state
	let isDraggingEncrypt = $state(false);
	let isDraggingDecrypt = $state(false);

	let isEncryptionEnabled = $state(false);
	let encryptPassword = $state('');
	let decryptPassword = $state('');

	let statusMessage = $state('Ready to package files into a secure archive.');
	let errorMessage = $state('');
	let isBusy = $state(false);
	let actionLabel = $state('Idle');

	let outputFile: OutputFile | null = $state(null);
	let outputUrl = $state('');

	let decryptedFilesList: { name: string; data: ArrayBuffer }[] = $state([]);

	onMount(() => {
		mounted = true;
		return () => {
			if (outputUrl) {
				URL.revokeObjectURL(outputUrl);
			}
		};
	});

	function switchMode(mode: 'encrypt' | 'decrypt') {
		currentMode = mode;
		resetOutput();
		errorMessage = '';
		actionLabel = 'Idle';
		statusMessage =
			mode === 'encrypt'
				? 'Ready to package files into a secure archive.'
				: 'Ready to unlock a protected archive.';
	}

	function resetOutput() {
		if (outputUrl) {
			URL.revokeObjectURL(outputUrl);
			outputUrl = '';
		}
		outputFile = null;
		decryptedFilesList = [];
	}

	function formatBytes(size: number) {
		if (size === 0) return '0 B';
		const units = ['B', 'KB', 'MB', 'GB'];
		const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
		return `${(size / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
	}

	function getPasswordStrength(password: string) {
		if (!password) {
			return { score: 0, label: 'Weak', hint: 'Add a password to enable encryption.' };
		}

		const result = zxcvbn(password);
		const score = Math.round((result.score / 4) * 100);

		if (result.score <= 1) {
			return {
				score,
				label: 'Weak',
				hint: result.feedback.warning || 'Use a longer password with less predictable patterns.'
			};
		}

		if (result.score === 2) {
			return {
				score,
				label: 'Moderate',
				hint: result.feedback.warning || 'Add more length and avoid common words or patterns.'
			};
		}

		return {
			score,
			label: 'Strong',
			hint: result.feedback.warning || 'This password is a good fit for archive protection.'
		};
	}

	// Encrypt handlers
	function addEncryptFiles(newFiles: File[]) {
		const existingNames = new Set(encryptFilesList.map((f) => f.name));
		const duplicateNames = newFiles.filter((f) => existingNames.has(f.name)).map((f) => f.name);
		const uniqueNewFiles = newFiles.filter((f) => !existingNames.has(f.name));

		if (duplicateNames.length > 0) {
			errorMessage = `Duplicate file name${duplicateNames.length > 1 ? 's' : ''} ignored: ${duplicateNames.join(', ')}.`;
		}

		encryptFilesList = [...encryptFilesList, ...uniqueNewFiles];
	}

	function handleEncryptFileSelect(event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			addEncryptFiles(Array.from(target.files));
		}
		// Reset input so the same file can be chosen again.
		target.value = '';
	}

	function handleDragOverEncrypt(e: DragEvent) {
		e.preventDefault();
		isDraggingEncrypt = true;
	}

	function handleDragLeaveEncrypt(e: DragEvent) {
		e.preventDefault();
		isDraggingEncrypt = false;
	}

	function handleDropEncrypt(e: DragEvent) {
		e.preventDefault();
		isDraggingEncrypt = false;
		if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
			addEncryptFiles(Array.from(e.dataTransfer.files));
		}
	}

	function removeEncryptFile(index: number) {
		encryptFilesList = encryptFilesList.filter((_, i) => i !== index);
	}

	// Decrypt handlers
	function handleDecryptFileSelect(event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			decryptFile = target.files[0];
		}
		target.value = '';
	}

	function handleDragOverDecrypt(e: DragEvent) {
		e.preventDefault();
		isDraggingDecrypt = true;
	}

	function handleDragLeaveDecrypt(e: DragEvent) {
		e.preventDefault();
		isDraggingDecrypt = false;
	}

	function handleDropDecrypt(e: DragEvent) {
		e.preventDefault();
		isDraggingDecrypt = false;
		if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
			decryptFile = e.dataTransfer.files[0];
		}
	}

	function removeDecryptFile() {
		decryptFile = null;
	}

	function createDownload(name: string, data: ArrayBuffer) {
		const blob = new Blob([data], { type: 'application/octet-stream' });
		outputUrl = URL.createObjectURL(blob);
		outputFile = { name, data };
	}

	// Core actions
	async function handleEncrypt() {
		errorMessage = '';
		resetOutput();

		if (encryptFilesList.length === 0) {
			errorMessage = 'Please choose at least one file to package.';
			return;
		}

		if (isEncryptionEnabled && !encryptPassword.trim()) {
			errorMessage = 'Please enter a password for encryption.';
			return;
		}

		try {
			isBusy = true;
			actionLabel = 'Encrypting';
			statusMessage = 'Compressing files and preparing the secure archive...';

			const files = await Promise.all(
				encryptFilesList.map(async (file) => ({
					name: file.name,
					data: await file.arrayBuffer()
				}))
			);

			const actualPassword = isEncryptionEnabled ? encryptPassword.trim() : '';
			const data = await encryptFiles(files, actualPassword);

			// Hash all file names for the output name
			const combinedNames = encryptFilesList.map((f) => `${f.name}\0${f.size}`).join('\0');
			const msgBuffer = new TextEncoder().encode(combinedNames);
			const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
			const hashHex = Array.from(new Uint8Array(hashBuffer))
				.map((b) => b.toString(16).padStart(2, '0'))
				.join('');

			// Use the first 8 hash chars as the short name
			const shortHash = hashHex.slice(0, 8);
			const fileName = actualPassword ? `${shortHash}.enc` : `${shortHash}.zip`;

			createDownload(fileName, data);
			statusMessage = `Archive ready. ${files.length} file${files.length > 1 ? 's' : ''} packed successfully.`;
			actionLabel = 'Archive ready';
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to create archive.';
			actionLabel = 'Error';
			statusMessage = 'The package could not be created.';
		} finally {
			isBusy = false;
		}
	}

	async function handleDecrypt() {
		errorMessage = '';
		resetOutput();

		if (!decryptFile) {
			errorMessage = 'Please choose a zip or encrypted archive to unlock.';
			return;
		}

		try {
			isBusy = true;
			actionLabel = 'Decrypting';
			statusMessage = 'Reading archive and restoring the original files...';

			const buffer = await decryptFile.arrayBuffer();

			decryptedFilesList = await decryptFiles(buffer, decryptPassword);

			statusMessage = `Unlocked ${decryptedFilesList.length} file${decryptedFilesList.length > 1 ? 's' : ''} successfully. Ready for download.`;
			actionLabel = 'Archive unlocked';
		} catch (error) {
			errorMessage =
				error instanceof Error ? error.message : 'File may be corrupted or password is incorrect.';
			actionLabel = 'Error';
			statusMessage = 'The archive could not be unlocked.';
		} finally {
			isBusy = false;
		}
	}

	function downloadSingleFile(file: { name: string; data: ArrayBuffer }) {
		const blob = new Blob([file.data], { type: 'application/octet-stream' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = file.name;
		link.click();
		URL.revokeObjectURL(url);
	}

	function downloadAllAsZip() {
		if (decryptedFilesList.length === 0) return;

		if (decryptedFilesList.length === 1) {
			downloadSingleFile(decryptedFilesList[0]);
			return;
		}

		const zipStructure: Record<string, Uint8Array> = {};
		for (const file of decryptedFilesList) {
			zipStructure[file.name] = new Uint8Array(file.data);
		}

		const zippedData = zipSync(zipStructure);
		const blob = new Blob([zippedData], { type: 'application/zip' });
		const url = URL.createObjectURL(blob);

		const link = document.createElement('a');
		link.href = url;

		const baseName = decryptFile ? decryptFile.name.replace(/\.(enc|zip)$/i, '') : 'archive';
		link.download = `${baseName}-restored.zip`;

		link.click();
		URL.revokeObjectURL(url);
	}

	function downloadCurrentOutput() {
		if (!outputUrl || !outputFile) return;

		const link = document.createElement('a');
		link.href = outputUrl;
		link.download = outputFile.name;
		link.click();
	}
</script>

<svelte:head>
	<title>Toolbox | SecureZip</title>
</svelte:head>

<!-- Dark background -->
<div
	class="min-h-dvh bg-[#0a0c10] text-zinc-100 flex flex-col items-center justify-center px-4 pt-[calc(env(safe-area-inset-top)+24px)] pb-[calc(env(safe-area-inset-bottom)+24px)] sm:px-6 lg:px-8"
>
	<!-- Soft glow -->
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
			<h1 class="text-3xl font-semibold tracking-tight text-white">SecureZip</h1>
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
							{:else}
								<span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-zinc-500"></span>
							{/if}
						</span>
						<p class="text-sm font-medium text-white">{actionLabel}</p>
					</div>
					<p class="mt-1 text-sm text-zinc-400">{statusMessage}</p>
				</div>

				{#if outputFile}
					<button
						type="button"
						onclick={downloadCurrentOutput}
						class="shrink-0 rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
					>
						Download {outputFile.name}
					</button>
				{/if}
			</div>

			{#if errorMessage}
				<div
					class="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
				>
					{errorMessage}
				</div>
			{/if}
		</section>

		<!-- Main card -->
		<section
			class="rounded-3xl border border-white/5 bg-zinc-800/80 p-6 shadow-xl shadow-black/20 backdrop-blur-md"
		>
			<!-- Mode toggle -->
			<div class="relative mb-8 flex w-full rounded-xl bg-zinc-900/80 p-1 border border-white/5">
				<!-- Sliding bar -->
				<div
					class="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-zinc-700 transition-transform duration-300 ease-out shadow-sm"
					style="transform: translateX({currentMode === 'decrypt' ? '100%' : '0'});"
				></div>

				<button
					class={`relative z-10 flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors duration-200 ${currentMode === 'encrypt' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
					onclick={() => switchMode('encrypt')}
				>
					Encrypt
				</button>
				<button
					class={`relative z-10 flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors duration-200 ${currentMode === 'decrypt' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
					onclick={() => switchMode('decrypt')}
				>
					Decrypt
				</button>
			</div>

			{#if currentMode === 'encrypt'}
				<!-- Encrypt view -->
				<div class="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
					<div>
						<span class="block text-sm font-medium text-zinc-300 mb-2">Files to package</span>

						<!-- File picker -->
						<input
							type="file"
							id="encrypt-file-upload"
							multiple
							onchange={handleEncryptFileSelect}
							class="hidden"
						/>
						<label
							for="encrypt-file-upload"
							ondragover={handleDragOverEncrypt}
							ondragleave={handleDragLeaveEncrypt}
							ondrop={handleDropEncrypt}
							class={`cursor-pointer flex flex-col items-center justify-center w-full rounded-2xl border border-dashed px-4 py-6 text-sm transition-colors ${isDraggingEncrypt ? 'border-blue-500 bg-blue-500/10' : 'border-zinc-600 bg-zinc-900/30 hover:bg-zinc-700/30 hover:border-zinc-500'}`}
						>
							<span class={`font-medium ${isDraggingEncrypt ? 'text-blue-300' : 'text-zinc-300'}`}>
								{isDraggingEncrypt ? 'Drop files here' : 'Click or drag files here'}
							</span>
							<span
								class={`text-xs mt-1 ${isDraggingEncrypt ? 'text-blue-400/70' : 'text-zinc-500'}`}
							>
								You can select multiple files at once
							</span>
						</label>

						<!-- Selected files -->
						{#if encryptFilesList.length > 0}
							<div class="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
								{#each encryptFilesList as file, index (file.name)}
									<div
										class="flex items-center justify-between rounded-xl bg-zinc-900/80 px-3 py-2 border border-white/5"
									>
										<div class="flex flex-col overflow-hidden">
											<span class="text-sm text-zinc-300 truncate pr-2">{file.name}</span>
											<span class="text-xs text-zinc-500">{formatBytes(file.size)}</span>
										</div>
										<button
											type="button"
											onclick={() => removeEncryptFile(index)}
											class="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors shrink-0"
											aria-label="Remove file"
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												width="16"
												height="16"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
												stroke-linecap="round"
												stroke-linejoin="round"
												><line x1="18" y1="6" x2="6" y2="18"></line><line
													x1="6"
													y1="6"
													x2="18"
													y2="18"
												></line></svg
											>
										</button>
									</div>
								{/each}
							</div>
						{/if}
					</div>

					<div
						class="rounded-2xl border border-white/5 bg-zinc-900/50 p-4 transition-colors hover:border-white/10"
					>
						<div class="flex items-center justify-between">
							<button
								type="button"
								class="flex flex-col text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-md"
								onclick={() => (isEncryptionEnabled = !isEncryptionEnabled)}
							>
								<span class="text-sm font-medium text-zinc-300">Password Protection</span>
								<span class="text-xs text-zinc-500 mt-0.5">Encrypt with a secure password</span>
							</button>
							<button
								type="button"
								role="switch"
								aria-checked={isEncryptionEnabled}
								aria-label="Toggle password protection"
								onclick={() => (isEncryptionEnabled = !isEncryptionEnabled)}
								class={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${isEncryptionEnabled ? 'bg-blue-500' : 'bg-zinc-700'}`}
							>
								<span
									aria-hidden="true"
									class={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isEncryptionEnabled ? 'translate-x-5' : 'translate-x-0'}`}
								></span>
							</button>
						</div>

						{#if isEncryptionEnabled}
							<div class="mt-4 animate-in fade-in slide-in-from-top-1 duration-200">
								<input
									type="password"
									bind:value={encryptPassword}
									placeholder="Enter a secure password"
									class="block w-full rounded-xl border border-white/5 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50"
								/>
								<div class="mt-3 space-y-2">
									{#if encryptPassword.trim()}
										{@const passwordStrength = getPasswordStrength(encryptPassword.trim())}
										<div class="flex items-center justify-between text-xs text-zinc-500">
											<span>Password strength</span>
											<span>{passwordStrength.label} · {passwordStrength.score}%</span>
										</div>
										<div class="h-2 overflow-hidden rounded-full bg-zinc-800">
											<div
												class={`h-full rounded-full transition-all duration-300 ${passwordStrength.score < 35 ? 'bg-rose-500' : passwordStrength.score < 70 ? 'bg-amber-400' : 'bg-emerald-400'}`}
												style={`width: ${passwordStrength.score}%`}
											></div>
										</div>
										<p class="text-xs text-zinc-500">{passwordStrength.hint}</p>
									{:else}
										<div class="flex items-center justify-between text-xs text-zinc-500">
											<span>Password strength</span>
											<span>0%</span>
										</div>
										<div class="h-2 overflow-hidden rounded-full bg-zinc-800">
											<div
												class="h-full w-0 rounded-full bg-zinc-600 transition-all duration-300"
											></div>
										</div>
										<p class="text-xs text-zinc-500">Add a password to see its strength.</p>
									{/if}
								</div>
							</div>
						{/if}
					</div>

					<button
						type="button"
						disabled={isBusy || encryptFilesList.length === 0}
						onclick={handleEncrypt}
						class="w-full rounded-2xl bg-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 mt-4"
					>
						Create Archive
					</button>
				</div>
			{:else}
				<!-- Decrypt view -->
				<div class="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
					<div>
						<span class="block text-sm font-medium text-zinc-300 mb-2">Select archive</span>

						<input
							type="file"
							id="decrypt-file-upload"
							onchange={handleDecryptFileSelect}
							class="hidden"
						/>

						{#if !decryptFile}
							<label
								for="decrypt-file-upload"
								ondragover={handleDragOverDecrypt}
								ondragleave={handleDragLeaveDecrypt}
								ondrop={handleDropDecrypt}
								class={`cursor-pointer flex flex-col items-center justify-center w-full rounded-2xl border border-dashed px-4 py-6 text-sm transition-colors ${isDraggingDecrypt ? 'border-blue-500 bg-blue-500/10' : 'border-zinc-600 bg-zinc-900/30 hover:bg-zinc-700/30 hover:border-zinc-500'}`}
							>
								<span
									class={`font-medium ${isDraggingDecrypt ? 'text-blue-300' : 'text-zinc-300'}`}
								>
									{isDraggingDecrypt ? 'Drop archive here' : 'Click or drag archive here'}
								</span>
								<span
									class={`text-xs mt-1 ${isDraggingDecrypt ? 'text-blue-400/70' : 'text-zinc-500'}`}
								>
									Supports .zip or .enc files
								</span>
							</label>
						{:else}
							<div
								class="flex items-center justify-between rounded-2xl bg-zinc-900/80 px-4 py-3 border border-white/5"
							>
								<div class="flex flex-col overflow-hidden pr-4">
									<span class="text-sm font-medium text-zinc-200 truncate">{decryptFile.name}</span>
									<span class="text-xs text-zinc-500 mt-0.5">{formatBytes(decryptFile.size)}</span>
								</div>
								<button
									type="button"
									onclick={removeDecryptFile}
									class="p-2 text-zinc-400 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors shrink-0"
									title="Choose another file"
									aria-label="Remove selected archive"
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

					<label class="block">
						<span class="text-sm font-medium text-zinc-300"
							>Password <span class="text-zinc-500 font-normal">(If needed)</span></span
						>
						<input
							type="password"
							bind:value={decryptPassword}
							placeholder="Required for protected archives"
							class="mt-2 block w-full rounded-2xl border border-white/5 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50"
						/>
					</label>

					<button
						type="button"
						disabled={isBusy || !decryptFile}
						onclick={handleDecrypt}
						class="w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 mt-4"
					>
						Unlock Archive
					</button>
					{#if decryptedFilesList.length > 0}
						<div class="mt-6 space-y-3 animate-in fade-in duration-300">
							<div class="flex items-center justify-between">
								<span class="text-sm font-medium text-zinc-300">Unlocked Files</span>
								<button
									type="button"
									onclick={downloadAllAsZip}
									class="rounded-xl bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 px-3 py-1.5 text-xs font-semibold text-blue-400 transition-colors"
								>
									Download All (ZIP)
								</button>
							</div>

							<div class="space-y-2 max-h-60 overflow-y-auto pr-1">
								{#each decryptedFilesList as file (file.name)}
									<div
										class="flex items-center justify-between rounded-xl bg-zinc-900/80 px-4 py-2.5 border border-white/5"
									>
										<div class="flex flex-col overflow-hidden">
											<span class="text-sm font-medium text-zinc-200 truncate pr-2"
												>{file.name}</span
											>
											<span class="text-xs text-zinc-500 mt-0.5"
												>{formatBytes(file.data.byteLength)}</span
											>
										</div>
										<button
											type="button"
											onclick={() => downloadSingleFile(file)}
											class="shrink-0 rounded-xl bg-zinc-700 hover:bg-zinc-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors"
										>
											Download
										</button>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</section>
	</main>
</div>

<style>
	/* Custom scrollbar */
	::-webkit-scrollbar {
		width: 6px;
	}
	::-webkit-scrollbar-track {
		background: transparent;
	}
	::-webkit-scrollbar-thumb {
		background: #3f3f46;
		border-radius: 10px;
	}
	::-webkit-scrollbar-thumb:hover {
		background: #52525b;
	}
</style>
