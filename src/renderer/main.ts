import { mount } from 'svelte';
import '@fontsource/doto/600.css';
import './style.css';
import App from './App.svelte';
mount(App, { target: document.getElementById('app')! });
