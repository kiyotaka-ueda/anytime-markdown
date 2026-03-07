import { z } from 'zod';

export const layoutCardSchema = z.object({
  id: z.string().max(100),
  docKey: z.string().max(500),
  title: z.string().max(200),
  description: z.string().max(1000),
  thumbnail: z.string().max(2000),
  tags: z.array(z.string().max(30)).max(10),
  order: z.number().int().min(0),
});

export const layoutDataSchema = z.object({
  cards: z.array(layoutCardSchema).max(100),
  siteDescription: z.string().max(500).optional(),
});

export type LayoutCard = z.infer<typeof layoutCardSchema>;
export type LayoutData = z.infer<typeof layoutDataSchema>;

export interface DocFile {
  key: string;
  name: string;
  lastModified: string;
  size: number;
}
