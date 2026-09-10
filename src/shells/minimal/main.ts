// SPDX-License-Identifier: MPL-2.0
import { mount } from 'svelte';
import './style.css';
import MinimalShell from './MinimalShell.svelte';

mount(MinimalShell, { target: document.getElementById('app')! });
