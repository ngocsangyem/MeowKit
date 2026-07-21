import { docs } from 'collections/server';
import { loader } from 'fumadocs-core/source';

// baseUrl '/' preserves the VitePress URL structure (no /docs prefix) —
// the URL-parity anchor for the docs.meowkit.dev migration.
export const source = loader({
  baseUrl: '/',
  source: docs.toFumadocsSource(),
});
