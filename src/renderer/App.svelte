<script lang="ts">
  import { onMount } from 'svelte';
  import type { BrowserState, Command } from '../shared/types';
  import Icon from './Icon.svelte';
  import PrivacyPanel from './PrivacyPanel.svelte';
  import WorkspacePanel from './WorkspacePanel.svelte';
  let state: BrowserState | undefined;
  let address = '';
  let search = '';
  let error = '';
  let addressInput: HTMLInputElement;
  let addressFocused = false;
  let previousId = '';
  let previousUrl = '';
  let passphrase = '';
  let confirmPassphrase = '';
  let unlocking = false;
  $: tab = state?.tabs.find(item => item.id === state?.activeId);
  $: workspaceTabs = state?.tabs.filter(item => item.workspaceId === state?.activeWorkspaceId) ?? [];
  $: bookmarked = state?.bookmarks.some(item => item.url === tab?.url) ?? false;
  $: entries = (state?.panel === 'history' ? state.history : state?.bookmarks ?? []).filter(item => `${item.title} ${item.url}`.toLowerCase().includes(search.toLowerCase()));
  async function run(command: Command) {
    error = '';
    try { await window.astra.command(command); return true; } catch (cause) { error = String(cause).replace(/^Error:.*?Error: /, ''); return false; }
  }
  async function unlockVault(event: SubmitEvent) {
    event.preventDefault();
    if (!state?.vaultLocked && passphrase !== confirmPassphrase) { error = 'Passphrases do not match.'; return; }
    unlocking = true;
    await run({ type: 'unlock-vault', passphrase });
    passphrase = ''; confirmPassphrase = ''; unlocking = false;
  }
  function receive(next: BrowserState) {
    state = next;
    const current = next.tabs.find(item => item.id === next.activeId);
    if (current && (current.id !== previousId || current.url !== previousUrl && !addressFocused)) address = current.url;
    previousId = current?.id ?? ''; previousUrl = current?.url ?? '';
    document.documentElement.dataset.theme = next.theme;
  }
  function focusAddress() { addressInput?.focus(); addressInput?.select(); }
  onMount(() => {
    const offState = window.astra.onState(receive);
    const offShortcut = window.astra.onShortcut(name => { if (name === 'address') focusAddress(); });
    window.astra.snapshot().then(receive).catch(cause => error = String(cause));
    return () => { offState(); offShortcut(); };
  });
</script>

<svelte:head><title>Astra{tab?.url ? ` — ${tab.title}` : ''}</title></svelte:head>

<div class="shell">
  <header class="masthead">
    <div class="wordmark">ASTRA<span class="brand-dot" aria-hidden="true"></span></div>
    <span class="masthead-note">A little less noise. A little more internet.</span>
    <span class="version">BUILD 001</span>
  </header>
  <nav class="toolbar" aria-label="Navigation">
    <div class="navigation-buttons">
      <button aria-label="Back" title="Back · Alt+Left" disabled={!tab?.canBack} onclick={() => run({ type: 'back' })}><Icon name="back" /></button>
      <button aria-label="Forward" title="Forward · Alt+Right" disabled={!tab?.canForward} onclick={() => run({ type: 'forward' })}><Icon name="forward" /></button>
      <button aria-label={tab?.loading ? 'Stop loading' : 'Reload'} title="Reload · Ctrl+R" disabled={!tab?.url} onclick={() => run({ type: tab?.loading ? 'stop' : 'reload' })}><Icon name={tab?.loading ? 'close' : 'reload'} /></button>
    </div>
    <form class="address" onsubmit={event => { event.preventDefault(); addressInput.blur(); run({ type: 'navigate', url: address }); }}>
      <Icon name={tab?.url.startsWith('https:') ? 'shield' : 'globe'} />
      <input bind:this={addressInput} bind:value={address} onfocus={() => addressFocused = true} onblur={() => addressFocused = false} aria-label="Address or search" placeholder="Search or enter an address" autocomplete="off" spellcheck="false" />
      <span class="key-hint">Ctrl L</span>
    </form>
    <button aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark page'} aria-pressed={bookmarked} title="Bookmark · Ctrl+D" disabled={!tab?.url} onclick={() => run({ type: 'bookmark' })}><Icon name="bookmark" /></button>
  </nav>

  <aside class="sidebar" aria-label="Tabs and library">
    <label class="section-label" for="workspace-switch">WORKSPACE</label>
    <div class="workspace-switch"><select id="workspace-switch" aria-label="Workspace" value={state?.activeWorkspaceId} onchange={event => run({ type: 'switch-workspace', id: event.currentTarget.value })}>{#each state?.workspaces ?? [] as workspace (workspace.id)}<option value={workspace.id}>{workspace.name}</option>{/each}</select><button aria-label="Manage workspaces" title="Create or rename a workspace" onclick={() => run({ type: 'panel', value: 'workspaces' })}><Icon name="plus" /></button></div>
    <div class="section-label"><span>YOUR TABS</span><span>{String(workspaceTabs.length).padStart(2, '0')}</span></div>
    <div class="tabs" role="tablist" aria-label="Open tabs" aria-orientation="vertical">
      {#each workspaceTabs as item (item.id)}
        <div class:active={item.id === state?.activeId} class="tab-row">
          <button class="tab" role="tab" aria-selected={item.id === state?.activeId} title={`${item.url || 'New tab'}${item.suspended ? ' · Sleeping; select to restore' : item.suspensionReason ? ` · Kept awake: ${item.suspensionReason}` : ''}`} onclick={() => run({ type: 'activate-tab', id: item.id })}>
            <span class:loading={item.loading} class="tab-symbol" aria-hidden="true">{item.url ? '◌' : '+'}</span>
            <span class="tab-title">{item.title}</span>
            {#if item.suspended}<span class="sleep-indicator" aria-label="Sleeping">z</span>{/if}
          </button>
          <button class="close-tab" aria-label={`Close ${item.title}`} onclick={() => run({ type: 'close-tab', id: item.id })}><Icon name="close" /></button>
        </div>
      {/each}
    </div>
    <button class="new-tab" onclick={async () => { await run({ type: 'new-tab' }); focusAddress(); }}><Icon name="plus" /><span>New tab</span><span class="key-hint">Ctrl T</span></button>
    <div class="sidebar-bottom">
      <div class="section-label">LIBRARY</div>
      <button class="library-button" class:selected={state?.panel === 'bookmarks'} onclick={() => { search = ''; run({ type: 'panel', value: state?.panel === 'bookmarks' ? 'none' : 'bookmarks' }); }}><Icon name="bookmark" />Bookmarks</button>
      <button class="library-button" class:selected={state?.panel === 'history'} onclick={() => { search = ''; run({ type: 'panel', value: state?.panel === 'history' ? 'none' : 'history' }); }}><Icon name="history" />History</button>
      <button class="library-button" class:selected={state?.panel === 'privacy'} onclick={() => run({ type: 'panel', value: state?.panel === 'privacy' ? 'none' : 'privacy' })}><Icon name="shield" />Behind the page</button>
      <div class="sidebar-foot"><span>QUIET BY DESIGN</span><button aria-label="Change color theme" title={`Theme: ${state?.theme ?? 'system'}`} onclick={() => run({ type: 'theme', value: state?.theme === 'system' ? 'dark' : state?.theme === 'dark' ? 'light' : 'system' })}><Icon name="sun" /></button></div>
    </div>
  </aside>

  <main class="canvas" id="main-content">
    {#if error}<div class="error" role="alert">{error}<button aria-label="Dismiss error" onclick={() => error = ''}><Icon name="close" /></button></div>{/if}
    {#if state?.panel === 'workspaces'}
      <WorkspacePanel {state} {run} />
    {:else if state?.panel === 'storage'}
      <section class="panel">
        <div class="eyebrow">LOCAL MEANS YOURS</div>
        <div class="panel-title"><h1>{state.storage === 'encrypted' ? 'Records secured.' : state.vaultLocked ? 'Unlock your vault.' : 'Keep it private.'}</h1><button aria-label="Close storage settings" onclick={() => run({ type: 'panel', value: 'none' })}><Icon name="close" /></button></div>
        <p class="muted">{state.storageMessage}</p>
        {#if state.storage !== 'encrypted'}
          <p class="storage-explanation">{state.vaultLocked ? 'Your saved history, bookmarks and tabs stay encrypted until you unlock them.' : 'Create a passphrase to save history, bookmarks and tabs on this device. Astra cannot recover a forgotten passphrase. Use a unique phrase of at least 12 characters.'}</p>
          <form class="vault-form" onsubmit={unlockVault}>
            <label>Passphrase<input aria-label="Vault passphrase" type="password" bind:value={passphrase} minlength="12" maxlength="1024" autocomplete={state.vaultLocked ? 'current-password' : 'new-password'} required /></label>
            {#if !state.vaultLocked}<label>Repeat passphrase<input aria-label="Repeat vault passphrase" type="password" bind:value={confirmPassphrase} minlength="12" maxlength="1024" autocomplete="new-password" required /></label>{/if}
            <button class="primary-action" type="submit" disabled={unlocking}>{unlocking ? 'Unlocking…' : state.vaultLocked ? 'Unlock records' : 'Create encrypted vault'}<Icon name="shield" /></button>
          </form>
        {/if}
        <p class="storage-explanation muted">Website cookies and logins are held in memory and cleared when Astra quits. Downloads you explicitly save are ordinary files at your chosen location.</p>
      </section>
    {:else if state?.panel === 'bookmarks' || state?.panel === 'history'}
      <section class="panel">
        <div class="eyebrow">YOUR BROWSER / YOUR RECORDS</div>
        <div class="panel-title"><h1>{state.panel === 'bookmarks' ? 'Bookmarks' : 'History'}</h1><button aria-label="Close library" onclick={() => run({ type: 'panel', value: 'none' })}><Icon name="close" /></button></div>
        <label class="filter-label">Filter {state.panel}<input bind:value={search} placeholder="Title or address" /></label>
        {#if state.panel === 'history' && state.history.length}<button class="text-button" onclick={() => run({ type: 'clear-history' })}>Clear browsing history</button>{/if}
        <div class="entries">
          {#each entries as entry (entry.id)}
            <div class="entry"><button onclick={() => run({ type: 'navigate', url: entry.url })}><strong>{entry.title}</strong><span>{entry.url}</span><small>{new Date(entry.time).toLocaleString()}</small></button>{#if state.panel === 'bookmarks'}<button aria-label={`Remove bookmark ${entry.title}`} onclick={() => run({ type: 'remove-bookmark', id: entry.id })}><Icon name="close" /></button>{/if}</div>
          {:else}<p class="empty">{search ? 'No matching pages.' : state.panel === 'bookmarks' ? 'Keep a page here with Ctrl+D.' : 'Pages you visit will appear here.'}</p>{/each}
        </div>
      </section>
    {:else if state?.panel === 'privacy'}
      <PrivacyPanel {state} {tab} {run} />
    {:else if tab?.error}
      <section class="newtab error-page"><div class="eyebrow">CONNECTION INTERRUPTED</div><h1>This page couldn’t load.</h1><p>{tab.error}</p><p class="muted">{tab.url}</p><button class="primary-action" onclick={() => run({ type: 'reload' })}>Try again<Icon name="reload" /></button></section>
    {:else if !tab?.url}
      <section class="newtab">
        <div class="orbit" aria-hidden="true"><div></div><span>✳</span></div>
        <div class="eyebrow">THE INTERNET, WITH ROOM TO THINK.</div>
        <h1>Make space.</h1>
        <p>A blank page. An open web.<br />Where you go from here is yours.</p>
        <button class="start-browsing" onclick={focusAddress}><span>Search or enter an address</span><Icon name="arrow" /></button>
        <div class="newtab-notes"><span>01 / NO TELEMETRY</span><span>02 / LOCAL BY DEFAULT</span><span>03 / OPEN SOURCE</span></div>
      </section>
    {/if}
  </main>
  <footer class="status"><span class="status-dot" aria-hidden="true"></span><span>{tab?.loading ? 'LOADING' : 'READY'}</span><button class="status-storage" aria-label="Encrypted storage settings" onclick={() => run({ type: 'panel', value: 'storage' })}>{state?.storage === 'encrypted' ? 'ENCRYPTED RECORDS' : state?.vaultLocked ? 'VAULT LOCKED · UNLOCK RECORDS' : 'MEMORY ONLY · SET UP ENCRYPTED STORAGE'}</button><span>{tab?.blocked ?? 0} TRACKERS BLOCKED</span></footer>
</div>
