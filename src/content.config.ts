import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/** One folder per project: src/content/work/<slug>/index.md with its images beside it. */
const work = defineCollection({
  loader: glob({ pattern: '*/index.md', base: './src/content/work' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      summary: z.string().max(160),
      location: z.string(),
      year: z.number().int(),
      type: z.string(),
      scope: z.array(z.string()).min(1).max(4),
      cover: image(),
      coverAlt: z.string().min(8),
      orientation: z.enum(['landscape', 'portrait']).default('landscape'),
      gallery: z.array(z.object({ src: image(), alt: z.string().min(8) })).default([]),
      featured: z.boolean().default(false),
      order: z.number().default(99),
      placeholder: z.boolean().default(false),
    }),
});

export const collections = { work };
