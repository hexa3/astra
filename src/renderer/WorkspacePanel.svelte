<script lang="ts">
  import type { BrowserState, Command } from '../shared/types';
  import Icon from './Icon.svelte';
  export let state: BrowserState;
  export let run: (command: Command) => Promise<boolean>;
  let name = '';
  let rename = '';
  let previousWorkspace = '';
  $: workspace = state.workspaces.find(workspace => workspace.id === state.activeWorkspaceId)!;
  $: if (workspace.id !== previousWorkspace) { rename = workspace.name; previousWorkspace = workspace.id; }
</script>

<section class="panel workspace-panel">
  <div class="eyebrow">A PLACE FOR EACH PART OF YOUR DAY</div>
  <div class="panel-title"><h1>Workspaces</h1><button aria-label="Close workspace settings" onclick={() => run({ type: 'panel', value: 'none' })}><Icon name="close" /></button></div>
  <p class="muted">Each workspace has its own tabs and site logins. Bookmarks and history are shared. Site logins still clear when Astra quits.</p>
  <div class="workspace-list" aria-label="Available workspaces">
    {#each state.workspaces as item (item.id)}
      <button aria-pressed={item.id === state.activeWorkspaceId} onclick={() => run({ type: 'switch-workspace', id: item.id })}><span>{item.name}</span><span class="muted">{state.tabs.filter(tab => tab.workspaceId === item.id).length} tabs</span><Icon name="arrow" /></button>
    {/each}
  </div>
  <form class="workspace-form" onsubmit={async event => { event.preventDefault(); if (await run({ type: 'create-workspace', name })) name = ''; }}>
    <label for="new-workspace">New workspace name</label>
    <div><input id="new-workspace" bind:value={name} maxlength="60" required placeholder="Work, research, a fresh start…" /><button class="primary-action" type="submit">Create workspace<Icon name="plus" /></button></div>
  </form>
  <form class="workspace-form" onsubmit={event => { event.preventDefault(); run({ type: 'rename-workspace', id: workspace.id, name: rename }); }}>
    <label for="rename-workspace">Rename {workspace.name}</label>
    <div><input id="rename-workspace" aria-label="Current workspace name" bind:value={rename} maxlength="60" required /><button class="primary-action" type="submit">Rename workspace</button></div>
  </form>
  <p class="muted workspace-keyboard">Switch workspaces with Ctrl+Alt+Left/Right (Cmd+Alt on macOS), or Ctrl+Alt+1–9.</p>
</section>
