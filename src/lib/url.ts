/**
 * Prefix a site-relative path with the configured `base` so every link and
 * public asset works whether the site is deployed at a domain root or under
 * a project subpath (`trailingSlash: 'always'` guarantees BASE_URL ends in "/").
 */
export const withBase = (path: string): string => import.meta.env.BASE_URL + path.replace(/^\//, '');
