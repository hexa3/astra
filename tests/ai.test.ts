// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalExtractiveProvider, modelProviders } from '../src/core/ai';

const page = { url: 'https://example.test/', title: 'Local AI', text: 'Astra blocks common tracker requests by default. Browser records are encrypted before persistence. Workspaces keep website sessions separate. The local assistant sends no page text over the network.' };

test('local AI provider summarizes and answers without a remote dependency', async () => {
  const provider = new LocalExtractiveProvider();
  assert.match(await provider.summarize(page), /Astra blocks common tracker/);
  assert.match(await provider.answer(page, 'How are browser records stored?'), /encrypted before persistence/);
  assert.match(provider.disclosure, /Nothing leaves this device/);
  assert.equal(modelProviders.get(provider.id)?.id, provider.id);
});

test('local AI clearly reports absent readable or relevant text', async () => {
  const provider = new LocalExtractiveProvider();
  assert.match(await provider.summarize({...page, text: ''}), /not expose enough/);
  assert.match(await provider.answer(page, 'quantum bananas'), /could not find/);
});
