<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { BrowserState, Command } from '../shared/types';
  import { searchBrowser, type SearchResult } from '../shared/search';
  import Icon from './Icon.svelte';
  export let state: BrowserState;
  export let run: (command: Command) => Promise<boolean>;
  let query = '';
  let selected = 0;
  let dialog: HTMLDialogElement;
  let input: HTMLInputElement;
  let closeButton: HTMLButtonElement;
  let choosing = false;
  $: results = searchBrowser(state, query);
  $: selected = Math.min(selected, Math.max(0, results.length - 1));
  async function choose(result: SearchResult | undefined) {
    if (!result || choosing) return;
    choosing = true;
    await run({ type: 'panel', value: 'none' });
    await run(result.command);
  }
  async function keydown(event: KeyboardEvent) {
    if (event.key === 'Enter') { event.preventDefault(); await choose(results[selected]); }
    if (['ArrowDown', 'ArrowUp'].includes(event.key) && results.length) {
      event.preventDefault(); selected = (selected + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
      await tick(); document.getElementById(`command-result-${selected}`)?.scrollIntoView({ block: 'nearest' });
    }
  }
  function trapFocus(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;
    event.preventDefault();
    (document.activeElement === input ? closeButton : input).focus();
  }
  onMount(() => { dialog.showModal(); input.focus(); });
</script>

<dialog class="command-palette" bind:this={dialog} aria-label="Command bar" onkeydown={trapFocus} oncancel={event => { event.preventDefault(); run({ type: 'panel', value: 'none' }); }}>
  <div class="command-input-row">
    <Icon name="search" />
    <input bind:this={input} bind:value={query} oninput={() => selected = 0} onkeydown={keydown} role="combobox" aria-label="Search tabs, history, bookmarks and commands" aria-expanded="true" aria-autocomplete="list" aria-controls="command-results" aria-activedescendant={results.length ? `command-result-${selected}` : undefined} placeholder="Where would you like to go?" autocomplete="off" spellcheck="false" maxlength="200" />
    <button bind:this={closeButton} aria-label="Close command bar" onclick={() => run({ type: 'panel', value: 'none' })}><Icon name="close" /></button>
  </div>
  <div id="command-results" class="command-results" role="listbox" aria-label="Search results">
    {#each results as result, index (result.id)}
      <button id={`command-result-${index}`} role="option" tabindex="-1" aria-selected={selected === index} class:selected={selected === index} onclick={() => choose(result)} onpointerenter={() => selected = index}>
        <span class="command-kind">{result.kind}</span>
        <span class="command-result-text"><strong>{result.label}</strong><small>{result.detail}</small></span>
        <Icon name="arrow" />
      </button>
    {:else}<p class="empty">No matching local results.</p>{/each}
  </div>
  <div class="command-footer"><span>↑ ↓ TO MOVE · ENTER TO OPEN · ESC TO CLOSE</span><span>LOCAL SEARCH</span></div>
</dialog>
