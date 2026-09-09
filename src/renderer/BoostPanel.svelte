<script lang="ts">
  import type { BrowserState, Command, Tab } from '../shared/types';
  import Icon from './Icon.svelte';
  export let state: BrowserState;
  export let tab: Tab | undefined;
  export let run: (command: Command) => Promise<boolean>;
  let loadedDomain = '';
  let css = '';
  let js = '';
  let enabled = true;
  $: domain = (() => { try { return tab?.url ? new URL(tab.url).hostname : ''; } catch { return ''; } })();
  $: if (domain !== loadedDomain) {
    loadedDomain = domain;
    const boost = state.boosts?.find(item => item.domain === domain);
    css = boost?.css ?? ''; js = boost?.js ?? ''; enabled = boost?.enabled ?? true;
  }
  $: currentBoost = state.boosts?.find(item => item.domain === domain);
  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (domain) await run({ type: 'save-boost', domain, css, js, enabled });
  }
</script>

<section class="panel boost-panel">
  <div class="eyebrow">YOUR WEB / YOUR RULES</div>
  <div class="panel-title"><h1>Customize this site</h1><button aria-label="Close site customization" onclick={() => run({ type: 'panel', value: 'none' })}><Icon name="close" /></button></div>
  {#if domain}
    <p class="muted">Changes apply only to <strong>{domain}</strong> and stay on this device. JavaScript runs with the page’s access, never Astra’s browser privileges.</p>
    <form class="boost-form" onsubmit={save}>
      <label class="boost-toggle"><input type="checkbox" bind:checked={enabled} /> Enable this customization</label>
      <label>CSS<textarea bind:value={css} maxlength="100000" spellcheck="false" placeholder="article &#123; max-width: 72ch; &#125;"></textarea></label>
      <label>JavaScript<textarea bind:value={js} maxlength="100000" spellcheck="false" placeholder="document.documentElement.dataset.focus = 'true';"></textarea></label>
      {#if currentBoost?.error}<p role="alert" class="extension-error">{currentBoost.error}</p>{/if}
      <div class="boost-actions"><button class="primary-action" type="submit">Save and reload<Icon name="reload" /></button>{#if currentBoost}<button type="button" onclick={() => run({ type: 'remove-boost', domain })}>Remove customization</button>{/if}</div>
    </form>
  {:else}<p class="empty">Open a website before creating a customization.</p>{/if}
</section>
