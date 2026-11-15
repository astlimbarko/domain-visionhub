/** Prefix for static assets and full-page browser navigation. React Router handles its own links. */
export function withBasePath(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}

/** V2 keeps its account/role selection separate from the official frontend. */
export const AUTH_STORAGE_KEY = 'visionhub-auth-v2';