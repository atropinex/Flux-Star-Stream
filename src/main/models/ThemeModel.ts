import { app } from 'electron';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { extname, join } from 'path';
import { parse } from 'yaml';
import { THEME_COLORS, type Theme, type ThemeLayer, type ThemeList } from '../../shared/types';
import { DEFAULT_THEMES } from './defaultThemes';

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif'
};

type Raw = Record<string, any>;

const asText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const asNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** Themes are YAML files in a folder. This reads and checks them. */
export class ThemeModel {
  readonly folder = join(app.getPath('userData'), 'themes');

  constructor() {
    // First run: create the folder with a few example themes.
    if (!existsSync(this.folder)) {
      mkdirSync(this.folder, { recursive: true });
      for (const [file, text] of Object.entries(DEFAULT_THEMES)) writeFileSync(join(this.folder, file), text);
    }
  }

  /** Reads every theme file. A broken file is reported in `errors` instead of stopping the others. */
  load(): ThemeList {
    const themes: Theme[] = [];
    const errors: string[] = [];

    const files = readdirSync(this.folder).filter((file) => /\.ya?ml$/i.test(file)).sort();
    for (const file of files) {
      try {
        const raw = parse(readFileSync(join(this.folder, file), 'utf8')) as Raw | null;
        themes.push(this.toTheme(file.replace(/\.ya?ml$/i, ''), raw));
      } catch (error) {
        errors.push(`${file}: ${(error as Error).message}`);
      }
    }
    return { themes, errors };
  }

  private toTheme(id: string, raw: Raw | null): Theme {
    if (!raw || typeof raw !== 'object') throw new Error('the file is empty or is not a YAML mapping');

    const colors: Theme['colors'] = {};
    for (const key of THEME_COLORS) {
      const value = asText(raw.colors?.[key]);
      if (value) colors[key] = value;
    }

    const background: Raw = raw.background ?? {};
    const layers = Array.isArray(background.layers)
      ? background.layers.map((layer: Raw, index: number) => this.toLayer(layer, index))
      : [];

    return { id, name: asText(raw.name) ?? id, colors, dimLayer: asText(background.dim), layers };
  }

  private toLayer(raw: Raw, index: number): ThemeLayer {
    const type = raw?.type === 'image' ? 'image' : 'gradient';
    const value = asText(raw?.value);
    if (!value) throw new Error(`layer ${index + 1} needs a "value"`);

    return {
      type,
      value: type === 'image' ? this.imageSource(value) : value,
      opacity: Math.max(0, Math.min(1, asNumber(raw.opacity, 1))),
      blur: Math.max(0, asNumber(raw.blur, 0)),
      size: asText(raw.size) ?? 'cover'
    };
  }

  /** Links are used as they are. Files on this computer are turned into data URLs the page can show. */
  private imageSource(value: string): string {
    if (/^(https?:|data:)/i.test(value)) return value;

    const path = value.startsWith('~') ? join(homedir(), value.slice(1)) : value;
    const mime = IMAGE_TYPES[extname(path).toLowerCase()];
    if (!mime) throw new Error(`"${value}" must be a png, jpg, webp or gif`);
    if (!existsSync(path)) throw new Error(`image not found: ${value}`);
    if (statSync(path).size > MAX_IMAGE_BYTES) throw new Error(`image is bigger than 20 MB: ${value}`);

    return `data:${mime};base64,${readFileSync(path).toString('base64')}`;
  }
}
