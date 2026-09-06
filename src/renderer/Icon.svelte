<script lang="ts">
  export let name: 'back' | 'forward' | 'reload' | 'plus' | 'close' | 'bookmark' | 'history' | 'shield' | 'sun' | 'arrow' | 'globe' | 'search' | 'sidebar' | 'split';
  const paths = {
    back: 'M14 5l-7 7 7 7M7 12h14', forward: 'M10 5l7 7-7 7M3 12h14',
    reload: 'M20 10a8 8 0 1 0-2 8M20 4v6h-6', plus: 'M12 4v16M4 12h16',
    close: 'M6 6l12 12M18 6L6 18', bookmark: 'M6 3h12v18l-6-4-6 4Z',
    history: 'M4 8a9 9 0 1 1-1 7M4 2v6h6M12 7v6l4 2',
    shield: 'M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6ZM9 12l2 2 4-4',
    sun: 'M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M5 19l1-1M18 6l1-1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    arrow: 'M5 12h14M13 6l6 6-6 6',
    globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18',
    search: 'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0M14.5 14.5L21 21',
    sidebar: 'M3 4h18v16H3ZM9 4v16',
    split: 'M3 4h18v16H3ZM12 4v16',
  };
</script>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
