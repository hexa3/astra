<script lang="ts">
  import type { BrowserState, Command, Tab } from '../shared/types';
  import Icon from './Icon.svelte';
  export let state: BrowserState;
  export let tab: Tab | undefined;
  export let run: (command: Command) => Promise<boolean>;
</script>

<section class="panel privacy-panel">
  <div class="eyebrow">NOTHING TO HIDE</div>
  <div class="panel-title"><h1>Behind the page</h1><button aria-label="Close privacy panel" onclick={() => run({ type: 'panel', value: 'none' })}><Icon name="close" /></button></div>
  <p class="muted">Observed for this tab since it opened. Reloading keeps these counts.</p>
  <div class="metrics">
    <div><strong>{tab?.requests ?? 0}</strong><span>Network requests</span></div>
    <div><strong>{tab?.blocked ?? 0}</strong><span>Tracker requests blocked</span></div>
    <div><strong>{tab?.cookiesBlocked ?? 0}</strong><span>Cookie headers blocked</span></div>
  </div>
  <dl class="privacy-details">
    {#if tab?.rendererMemoryMB !== undefined}<div><dt>Main renderer memory</dt><dd>{tab.rendererMemoryMB} MB working set · process {tab.rendererPid}<br /><span class="muted">Sampled every 5 seconds. A renderer can be shared; this is not a per-tab total.</span></dd></div>{/if}
    <div><dt>Background pages</dt><dd>
      <label for="background-limit">Keep up to </label>
      <select id="background-limit" value={state.backgroundLimit} onchange={event => run({ type: 'background-limit', value: Number(event.currentTarget.value) })}>
        {#each [0, 2, 4, 6, 12, 24, 32] as limit}<option value={limit}>{limit}</option>{/each}
      </select> live in the background.
      <p class="muted">Older pages sleep and reload on return. Audio, edited forms and pages requesting to stay open are protected. {state.tabs.filter(tab => tab.suspended).length} sleeping now.</p>
    </dd></div>
    <div><dt>Tracker protection</dt><dd>On · bundled basic host list</dd></div>
    <div><dt>Third-party cookies</dt><dd>Blocked · HTTP headers and document access</dd></div>
    <div><dt>Site permissions</dt><dd>Camera, microphone, location and notifications denied</dd></div>
    <div><dt>Website storage</dt><dd>Memory only · cleared when you quit</dd></div>
    <div><dt>Browser records</dt><dd>{state.storageMessage}</dd></div>
    <div><dt>Telemetry</dt><dd>None</dd></div>
  </dl>
</section>
