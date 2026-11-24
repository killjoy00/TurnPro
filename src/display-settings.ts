const SETTINGS_KEY = 'turn-pro-display-v1'

export function installDisplaySettings() {
  const text = document.getElementById('text-size') as HTMLSelectElement
  const contrast = document.getElementById('contrast') as HTMLSelectElement
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}')
    if (saved?.text === 'large' || saved?.text === 'extra') text.value = saved.text
    if (saved?.contrast === 'high') contrast.value = 'high'
  } catch {
    // Defaults are available when storage is disabled or the value is invalid.
  }

  function apply() {
    document.documentElement.dataset.textSize = text.value
    document.documentElement.dataset.contrast = contrast.value
  }
  function change() {
    apply()
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ text: text.value, contrast: contrast.value }))
    } catch {
      // The current session still uses the selected display settings.
    }
  }
  text.addEventListener('change', change)
  contrast.addEventListener('change', change)
  apply()
}
