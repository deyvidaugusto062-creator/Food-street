import { lazy, Suspense, useEffect, useRef, useState, type PointerEvent as RPointerEvent, type CSSProperties } from 'react';
import type { Product } from '../../types/product';
import { ProductImage } from '../ui/ProductImage';
import { Icon } from '../ui/Icon';
import { Spin360 } from './Spin360';
import { hasWebGL } from '../../utils/perf';

/** Visualizador 3D (.glb) — carregado só se o produto tiver `model3d` e o visitante abrir a aba */
const ModelViewer = lazy(() => import('../../three/ModelViewer'));

type View = 'fotos' | '360' | '3d';

export function ProductGallery({ product }: { product: Product }) {
  const photos = product.images;
  const [index, setIndex] = useState(0);
  const [view, setView] = useState<View>('fotos');
  const views: { key: View; label: string }[] = [
    { key: 'fotos', label: 'Fotos' },
    ...(product.spin360?.length ? [{ key: '360' as View, label: '360°' }] : []),
    ...(product.model3d && hasWebGL() ? [{ key: '3d' as View, label: '3D' }] : []),
  ];

  useEffect(() => {
    setIndex(0);
    setView('fotos');
  }, [product.id]);

  const go = (dir: 1 | -1) => setIndex((i) => (i + dir + photos.length) % photos.length);

  return (
    <div className="pgallery">
      {views.length > 1 && (
        <div className="pgallery__views" role="group" aria-label="Tipo de visualização">
          {views.map((v) => (
            <button key={v.key} type="button" aria-pressed={view === v.key} onClick={() => setView(v.key)}>
              {v.label}
            </button>
          ))}
        </div>
      )}

      {view === 'fotos' && photos.length > 0 && (
        <>
          <ZoomStage
            key={`${product.id}-${index}`}
            photo={photos[index]}
            onSwipe={photos.length > 1 ? go : undefined}
            label={`Foto ${index + 1} de ${photos.length}`}
          />
          {photos.length > 1 && (
            <div className="pgallery__nav">
              <button type="button" className="icon-btn" onClick={() => go(-1)} aria-label="Foto anterior">
                <Icon name="arrowLeft" />
              </button>
              <ol className="pgallery__thumbs" role="list">
                {photos.map((p, i) => (
                  <li key={p.src}>
                    <button type="button" aria-pressed={i === index} aria-label={`Ver foto ${i + 1}: ${p.alt}`} onClick={() => setIndex(i)}>
                      <ProductImage photo={p} alt="" className={p.kind !== 'packshot' ? 'is-photo' : ''} />
                    </button>
                  </li>
                ))}
              </ol>
              <button type="button" className="icon-btn" onClick={() => go(1)} aria-label="Próxima foto">
                <Icon name="arrowRight" />
              </button>
            </div>
          )}
        </>
      )}

      {view === '360' && product.spin360 && <Spin360 frames={product.spin360} label={product.name} />}

      {view === '3d' && product.model3d && (
        <div className="pgallery__3d">
          <Suspense fallback={<p className="pgallery__loading">Carregando modelo 3D…</p>}>
            <ModelViewer url={product.model3d} label={`Modelo 3D: ${product.name}`} />
          </Suspense>
        </div>
      )}
    </div>
  );
}

/**
 * Foto com zoom: clique/toque amplia 2,4× e o ponto ampliado segue o cursor ou o dedo.
 * Deslizar para os lados (sem zoom) troca de foto.
 */
function ZoomStage({ photo, onSwipe, label }: { photo: Product['images'][number]; onSwipe?: (dir: 1 | -1) => void; label: string }) {
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState('50% 50%');
  const ref = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const point = (e: RPointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100));
    return `${x.toFixed(1)}% ${y.toFixed(1)}%`;
  };

  return (
    <div
      ref={ref}
      className={`zoom ${zoom ? 'is-zoomed' : ''} ${photo.kind !== 'packshot' ? 'is-photo' : ''}`}
      style={{ '--origin': origin } as CSSProperties}
      onPointerDown={(e) => {
        start.current = { x: e.clientX, y: e.clientY, moved: false };
      }}
      onPointerMove={(e) => {
        if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 8) start.current.moved = true;
        if (zoom) setOrigin(point(e));
      }}
      onPointerUp={(e) => {
        const s = start.current;
        start.current = null;
        if (!s) return;
        const dx = e.clientX - s.x;
        if (!zoom && onSwipe && e.pointerType !== 'mouse' && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - s.y)) {
          onSwipe(dx < 0 ? 1 : -1);
          return;
        }
        if (!s.moved || e.pointerType === 'mouse') {
          if (!zoom) setOrigin(point(e));
          setZoom((z) => !z);
        }
      }}
    >
      <ProductImage photo={photo} priority className="zoom__img" draggable={false} />
      <button
        type="button"
        className="zoom__toggle"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onClick={() => setZoom((z) => !z)} aria-pressed={zoom} aria-label={zoom ? 'Reduzir foto' : 'Ampliar foto'}>
        <Icon name={zoom ? 'zoomOut' : 'zoomIn'} />
      </button>
      <span className="zoom__count" aria-live="polite">
        {label}
      </span>
    </div>
  );
}
