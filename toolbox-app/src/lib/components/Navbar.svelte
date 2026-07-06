<script lang="ts">
    import { page } from '$app/stores';
    import { afterNavigate } from '$app/navigation';
    import { resolve } from '$app/paths'; 
    import { slide } from 'svelte/transition';

    let isMenuOpen = $state(false);

    function toggleMenu() {
        isMenuOpen = !isMenuOpen;
    }

    afterNavigate(() => {
        isMenuOpen = false;
    });

    const navLinks = [
        { href: '/', label: 'HomePage', external: false },
        { href: '/securezip', label: 'SecureZip', external: false }
    ] as const;
</script>

<nav class="sticky top-0 z-50 w-full border-b border-white/10 bg-zinc-950/50 backdrop-blur-xl transition-all duration-300">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="flex h-16 items-center justify-between">
            
            <a 
                href={resolve('/')} 
                class="flex shrink-0 items-center gap-2 rounded-md px-2 py-1 -ml-2 text-xl font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-white/20"
            >
                <span class="bg-linear-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent hover:to-zinc-300">
                    ykc2486-toolbox
                </span>
            </a>

            <div class="flex items-center gap-3">
                <a
                    href="https://github.com/ykc2486/toolbox"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="rounded-lg p-2 text-zinc-400 transition-all duration-200 hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                    aria-label="GitHub Repository"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                </a>

                <button
                    type="button"
                    class="inline-flex items-center justify-center rounded-lg p-2 text-zinc-400 transition-all duration-200 hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                    onclick={toggleMenu}
                    aria-expanded={isMenuOpen}
                >
                    <span class="sr-only">toggle Menu</span>
                    {#if !isMenuOpen}
                        <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    {:else}
                        <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    {/if}
                </button>
            </div>
        </div>
    </div>

    {#if isMenuOpen}
        <div class="border-t border-white/10 bg-zinc-950/85 backdrop-blur-xl" transition:slide={{ duration: 250, axis: 'y' }}>
            <div class="mx-auto max-w-7xl space-y-1 px-4 py-4 sm:px-6 lg:px-8">
                {#each navLinks as link (link.href)}
                    <a
                        href={resolve(link.href)}
                        class="block rounded-lg px-4 py-3 text-base font-medium transition-all duration-200
                        { ($page.url.pathname === link.href || (link.href !== '/' && $page.url.pathname.startsWith(link.href))) 
                            ? 'bg-white/10 text-white shadow-sm' 
                            : 'text-zinc-400 hover:bg-white/5 hover:text-white' }"
                    >
                        {link.label}
                    </a>
                {/each}

                <a
                    href="https://royaleapi.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="group relative flex items-center justify-between overflow-hidden rounded-lg px-4 py-3 text-base font-medium text-zinc-400 transition-all duration-200 hover:bg-white/5 hover:text-white"
                >
                    <img
                        src="/royaleapi-logo-w.svg"
                        alt=""
                        aria-hidden="true"
                        class="absolute right-2 top-1/2 h-14 w-auto -translate-y-1/2 opacity-20 drop-shadow-[0_0_10px_rgba(255,255,255,0.15)] transition-opacity duration-200 group-hover:opacity-35"
                    />
                    <span class="relative z-10 text-white/90">RoyaleAPI</span>
                </a>
            </div>
        </div>
    {/if}
</nav>