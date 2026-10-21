import { useCallback, useEffect, useState } from 'react';
import { THEME_COLORS, type Theme } from '../../../shared/types';

/** Loads the theme files and applies the chosen one. Reloads each time the overlay opens, so edits show up. */
export function useTheme(themeId: string | undefined, isVisible: boolean) {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const reload = useCallback(async () => {
    const result = await window.api.listThemes();
    setThemes(result.themes);
    setErrors(result.errors);
  }, []);

  useEffect(() => {
    if (isVisible) reload();
  }, [isVisible, reload]);

  const active = themes.find((theme) => theme.id === themeId) ?? themes[0];

  // Colors become CSS variables. A color the theme leaves out falls back to the default.
  useEffect(() => {
    const style = document.documentElement.style;
    for (const key of THEME_COLORS) {
      const value = active?.colors[key];
      if (value) style.setProperty(`--${key}`, value);
      else style.removeProperty(`--${key}`);
    }
    if (active?.dimLayer) style.setProperty('--backdrop', active.dimLayer);
    else style.removeProperty('--backdrop');
  }, [active]);

  return { themes, errors, active, reload };
}
