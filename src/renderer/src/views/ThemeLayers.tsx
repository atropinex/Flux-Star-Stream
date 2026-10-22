import type { CSSProperties } from 'react';
import type { Theme } from '../../../shared/types';
import './ThemeLayers.css';

interface Props {
  theme: Theme | undefined;
}

/** The extra background layers from the theme file, drawn above the dark layer and below everything else. */
export function ThemeLayers({ theme }: Props) {
  return (
    <div className="theme-layers">
      {theme?.layers.map((layer, index) => {
        const style: CSSProperties = {
          inset: layer.blur ? -layer.blur * 2 : 0, // extends past the edges so blurred borders stay hidden
          opacity: layer.opacity,
          filter: layer.blur ? `blur(${layer.blur}px)` : undefined,
          background: layer.type === 'image' ? `center / ${layer.size} no-repeat url("${layer.value}")` : layer.value
        };
        // The key includes the theme, so switching themes fades the new layers in.
        return <div key={`${theme.id}-${index}`} className="theme-layer" style={style} />;
      })}
    </div>
  );
}
