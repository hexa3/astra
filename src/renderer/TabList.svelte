<script lang="ts">
  import { tick } from 'svelte';
  import type { Command, Tab } from '../shared/types';
  import Icon from './Icon.svelte';
  export let tabs: Tab[];
  export let activeId: string;
  export let run: (command: Command) => Promise<boolean>;
  let list: HTMLDivElement;
  let draggedId = '';
  let dropId = '';
  let announcement = '';
  function focusTab(id: string) {
    list.querySelector<HTMLButtonElement>(`[data-tab-id="${CSS.escape(id)}"]`)?.focus();
  }
  async function move(id: string, index: number) {
    if (index < 0 || index >= tabs.length) return;
    if (await run({ type: 'move-tab', id, index })) {
      await tick(); focusTab(id);
      announcement = `Tab moved to position ${index + 1} of ${tabs.length}.`;
    }
  }
  async function keydown(event: KeyboardEvent, index: number) {
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + tabs.length) % tabs.length;
    if (event.altKey && event.shiftKey) await move(tabs[index].id, next);
    else focusTab(tabs[next].id);
  }
  function dragStart(event: DragEvent, id: string) {
    draggedId = id;
    if (event.dataTransfer) { event.dataTransfer.setData('application/x-astra-tab', id); event.dataTransfer.effectAllowed = 'move'; }
  }
  function dragOver(event: DragEvent, id: string) {
    if (!tabs.some(tab => tab.id === draggedId)) return;
    event.preventDefault(); dropId = id;
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }
  async function drop(event: DragEvent, index: number) {
    event.preventDefault();
    const id = draggedId; draggedId = ''; dropId = '';
    if (id && event.dataTransfer?.getData('application/x-astra-tab') === id) await move(id, index);
  }
</script>

<p id="tab-keyboard-help" class="sr-only">Use Up and Down to choose a tab, Enter to open it, or Alt+Shift+Up and Down to reorder.</p>
<div class="tabs" bind:this={list} role="tablist" aria-label="Open tabs" aria-orientation="vertical" aria-describedby="tab-keyboard-help">
  {#each tabs as item, index (item.id)}
    <div class:active={item.id === activeId} class="tab-row">
      <button class="tab" class:drop-target={dropId === item.id} role="tab" data-tab-id={item.id} tabindex={item.id === activeId ? 0 : -1} aria-selected={item.id === activeId} title={`${item.url || 'New tab'}${item.suspended ? ' · Sleeping; select to restore' : item.suspensionReason ? ` · Kept awake: ${item.suspensionReason}` : ''}`} onclick={() => run({ type: 'activate-tab', id: item.id })} onkeydown={event => keydown(event, index)} draggable="true" ondragstart={event => dragStart(event, item.id)} ondragover={event => dragOver(event, item.id)} ondrop={event => drop(event, index)} ondragend={() => { draggedId = ''; dropId = ''; }}>
        <span class:loading={item.loading} class="tab-symbol" aria-hidden="true">{item.url ? '◌' : '+'}</span>
        <span class="tab-title">{item.title}</span>
        {#if item.suspended}<span class="sleep-indicator" aria-label="Sleeping">z</span>{/if}
      </button>
      <button class="close-tab" aria-label={`Close ${item.title}`} onclick={() => run({ type: 'close-tab', id: item.id })}><Icon name="close" /></button>
    </div>
  {/each}
</div>
<span class="sr-only" role="status" aria-live="polite">{announcement}</span>
