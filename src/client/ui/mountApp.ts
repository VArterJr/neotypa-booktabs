import { AppStore } from '../state/store';
import { renderApp } from './renderApp';

export function mountApp(root: HTMLElement | null): void {
  if (!root) throw new Error('Missing #app root element');

  const store = new AppStore();
  store.subscribe((state) => {
    renderApp(root, state, store);
  });

  void store.bootstrap();
}
