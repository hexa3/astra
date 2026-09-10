<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  import type { AIState, Command } from '../../core/api';
  import Icon from './Icon.svelte';
  export let ai: AIState;
  export let hasPage: boolean;
  export let run: (command: Command) => Promise<boolean>;
  let question = '';
  async function ask(event: SubmitEvent) { event.preventDefault(); const value = question; if (value.trim()) await run({ type: 'ai-ask', question: value }); }
</script>

<aside class="ai-sidebar" aria-label="Astra AI">
  <div class="ai-heading"><div><span class="eyebrow">OPTIONAL / LOCAL</span><h2>Ask Astra</h2></div><button aria-label="Close AI sidebar" onclick={() => run({ type: 'toggle-ai' })}><Icon name="close" /></button></div>
  <p class="muted">{ai.disclosure}</p>
  <button class="primary-action" disabled={!hasPage || ai.busy} onclick={() => run({ type: 'ai-summarize' })}>{ai.busy ? 'Reading…' : 'Summarize this page'}<Icon name="spark" /></button>
  {#if ai.summary}<section class="ai-response"><h3>Summary</h3><p>{ai.summary}</p></section>{/if}
  <form class="ai-form" onsubmit={ask}>
    <label for="ai-question">Ask about this page</label>
    <textarea id="ai-question" bind:value={question} maxlength="1000" disabled={!hasPage || ai.busy} placeholder="What are the main claims?"></textarea>
    <button type="submit" disabled={!question.trim() || !hasPage || ai.busy}>Find an answer<Icon name="arrow" /></button>
  </form>
  <div aria-live="polite" aria-atomic="true">
    {#if ai.answer}<section class="ai-response"><h3>From this page</h3><p>{ai.answer}</p></section>{/if}
    {#if ai.error}<p class="extension-error" role="alert">{ai.error}</p>{/if}
  </div>
  <p class="ai-caveat">Extractive results quote and rank page passages; they can miss context. Verify important claims against the page.</p>
</aside>
