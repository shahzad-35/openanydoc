try {
  const savedTheme = localStorage.getItem('theme')
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  if (savedTheme === 'dark' || (savedTheme !== 'light' && prefersDark)) {
    document.documentElement.classList.add('dark')
  }
} catch {}
