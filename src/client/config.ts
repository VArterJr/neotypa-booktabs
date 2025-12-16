// Base path for the application - can be set via meta tag or defaults to '/'
// This allows deployment in subdirectories like /apps/myapp/
export function getBasePath(): string {
  const meta = document.querySelector('meta[name="base-path"]');
  const basePath = meta?.getAttribute('content') || '/';
  return basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
}

export const BASE_PATH = getBasePath();
