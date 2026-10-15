import { useEffect, useState } from 'react';

export type Route = { name: 'home' } | { name: 'editor'; projectId: string };

function parse(): Route {
  const h = location.hash.replace(/^#\/?/, '');
  const m = /^editor\/([\w-]+)/.exec(h);
  if (m) return { name: 'editor', projectId: m[1]! };
  return { name: 'home' };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function navigate(route: Route): void {
  location.hash = route.name === 'editor' ? `#/editor/${route.projectId}` : '#/';
}
