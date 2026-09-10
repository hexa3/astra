<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { CORE_API_VERSION, type BrowserState, type Command } from '../../core/api';

  let state: BrowserState | undefined;
  let address = '';
  let error = '';
  let addressInput: HTMLInputElement;
  let addressFocused = false;
  let previousId = '';
  $: tab = state?.tabs.find(item => item.id === state?.activeId);
  $: workspaceTabs = state?.tabs.filter(item => item.workspaceId === state?.activeWorkspaceId) ?? [];

  async function run(command: Command) {
    error = '';
    try { await window.astra.command(command); }
    catch (cause) { error = String(cause).replace(/^Error:.*?Error: /, ''); }
  }
  function receive(next: BrowserState) {
    state = next;
    const current = next.tabs.find(item => item.id === next.activeId);
    if (current && (current.id !== previousId || !addressFocused)) address = current.url;
    previousId = current?.id ?? '';
    document.documentElement.dataset.theme = next.theme;
  }
  function focusAddress() { addressInput?.focus(); addressInput?.select(); }

  onMount(() => {
    if (window.astra.version !== CORE_API_VERSION) {
      error = `API mismatch: shell ${CORE_API_VERSION}, core ${window.astra.version}`;
      return;
    }
    void window.astra.capabilities().then(capabilities => {
      if (capabilities.shell !== 'minimal') error = `Wrong shell selected: ${capabilities.shell}`;
    }).catch(cause => error = String(cause));
    void run({ type: 'configure-shell', insets: { top: 52, right: 0, bottom: 0, left: 0 } });
    const offState = window.astra.onState(receive);
    const offShortcut = window.astra.onShortcut(name => { if (name === 'address') focusAddress(); });
    window.astra.snapshot().then(receive).catch(cause => error = String(cause));
    return () => { offState(); offShortcut(); };
  });
</script>

<svelte:head><title>Astra Minimal{tab?.title ? ` — ${tab.title}` : ''}</title></svelte:head>

<main>
  <nav aria-label="Minimal browser navigation">
    <button aria-label="Back" disabled={!tab?.canBack} onclick={() => run({ type: 'back' })}>←</button>
    <button aria-label="Forward" disabled={!tab?.canForward} onclick={() => run({ type: 'forward' })}>→</button>
    <button aria-label={tab?.loading ? 'Stop loading' : 'Reload'} disabled={!tab?.url} onclick={() => run({ type: tab?.loading ? 'stop' : 'reload' })}>{tab?.loading ? '×' : '↻'}</button>
    <form onsubmit={event => { event.preventDefault(); const target = address; addressInput.blur(); address = tab?.url ?? ''; run({ type: 'navigate', url: target }); }}>
      <input bind:this={addressInput} bind:value={address} onfocus={() => addressFocused = true} onblur={() => addressFocused = false} aria-label="Address or search" placeholder="Search or enter address" autocomplete="off" spellcheck="false" />
    </form>
    <select aria-label="Open tabs" value={state?.activeId} onchange={event => run({ type: 'activate-tab', id: event.currentTarget.value })}>
      {#each workspaceTabs as item (item.id)}<option value={item.id}>{item.title}</option>{/each}
    </select>
    <button aria-label="New tab" onclick={async () => { await run({ type: 'new-tab' }); focusAddress(); }}>+</button>
    <button aria-label="Close tab" disabled={!tab} onclick={() => tab && run({ type: 'close-tab', id: tab.id })}>×</button>
    <span class="privacy" aria-label={`${tab?.blocked ?? 0} trackers blocked`}>{tab?.blocked ?? 0}</span>
  </nav>
  {#if error}<div class="error" role="alert">{error}<button aria-label="Dismiss error" onclick={() => error = ''}>×</button></div>{/if}
  {#if !tab?.url}<button class="empty" onclick={focusAddress}>Enter an address to begin</button>{/if}
</main>
