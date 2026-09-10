<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  import type { BrowserState, Command } from '../core/api';
  import Icon from './Icon.svelte';
  export let state: BrowserState;
  export let run: (command: Command) => Promise<boolean>;
</script>

<section class="panel extensions-panel">
  <div class="eyebrow">OPEN / REVIEWABLE / LOCAL</div>
  <div class="panel-title"><h1>Extensions</h1><button aria-label="Close extensions" onclick={() => run({ type: 'panel', value: 'none' })}><Icon name="close" /></button></div>
  <p class="muted">Astra loads unpacked Manifest V3 folders only after showing their requested access. Extension state and website storage are erased when Astra quits.</p>
  <button class="primary-action" disabled={!state.extensionsAvailable} onclick={() => run({ type: 'load-extension' })}>Load unpacked extension<Icon name="plus" /></button>
  {#if !state.extensionsAvailable}<p role="status" class="storage-explanation">This system cannot provide the disposable extension session Astra requires.</p>{/if}
  <div class="extension-list">
    {#each state.extensions ?? [] as extension (extension.id)}
      <article class="extension-card">
        <div><strong>{extension.name}</strong><span>v{extension.version}</span></div>
        <p>{extension.permissions.length ? extension.permissions.join(' · ') : 'No named browser permissions'}</p>
        <p>{extension.hosts.length ? extension.hosts.join(' · ') : 'No declared site access'}</p>
        {#if extension.error}<p class="extension-error" role="alert">{extension.error}</p>{/if}
        <div class="extension-actions">
          <button aria-pressed={extension.enabled} onclick={() => run({ type: 'toggle-extension', id: extension.id })}>{extension.enabled ? 'Disable' : 'Enable'}</button>
          <button onclick={() => run({ type: 'remove-extension', id: extension.id })}>Remove</button>
        </div>
      </article>
    {:else}<p class="empty">No extensions loaded.</p>{/each}
  </div>
</section>
