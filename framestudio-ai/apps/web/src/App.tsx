import { lazy, Suspense } from 'react';
import { ToastProvider, TooltipProvider, Spinner } from '@framestudio/ui';
import { useRoute } from './lib/route.ts';
import { HomePage } from './components/home/HomePage.tsx';

const EditorPage = lazy(() => import('./components/editor/EditorPage.tsx'));

export function App() {
  const route = useRoute();
  return (
    <TooltipProvider>
      <ToastProvider>
        {route.name === 'editor' ? (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center gap-3 text-fg-muted">
                <Spinner /> Carregando editor…
              </div>
            }
          >
            <EditorPage key={route.projectId} projectId={route.projectId} />
          </Suspense>
        ) : (
          <HomePage />
        )}
      </ToastProvider>
    </TooltipProvider>
  );
}
