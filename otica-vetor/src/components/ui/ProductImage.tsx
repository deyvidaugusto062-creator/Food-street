import type { ImgHTMLAttributes } from 'react';
import type { ProductPhoto } from '../../types/product';

type Props = { photo: Pick<ProductPhoto, 'src' | 'alt' | 'width' | 'height'>; priority?: boolean } & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'width' | 'height'>;

const hasExtension = (src: string) => /\.[a-z0-9]{3,4}(\?.*)?$/i.test(src);

/**
 * Foto otimizada: AVIF → WebP, com lazy loading e dimensões reservadas (sem salto de layout).
 * Caminhos com extensão (ex.: vindos de uma API) são usados direto.
 */
export function ProductImage({ photo, priority, ...img }: Props) {
  const common = {
    alt: photo.alt,
    width: photo.width,
    height: photo.height,
    loading: priority ? ('eager' as const) : ('lazy' as const),
    decoding: 'async' as const,
    fetchPriority: priority ? ('high' as const) : undefined,
    ...img,
  };

  if (hasExtension(photo.src)) return <img src={photo.src} {...common} />;

  return (
    <picture>
      <source srcSet={`${photo.src}.avif`} type="image/avif" />
      <img src={`${photo.src}.webp`} {...common} />
    </picture>
  );
}
