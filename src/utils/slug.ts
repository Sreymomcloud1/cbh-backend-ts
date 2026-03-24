// src/utils/slug.ts
import slugify from 'slugify';
import db from '../config/db';

/**
 * Generate a unique URL-safe slug for a startup.
 * Appends a numeric suffix on collision: "khmer-tech", "khmer-tech-2", etc.
 */
export async function generateUniqueSlug(businessName: string): Promise<string> {
  const base = slugify(businessName, { lower: true, strict: true, trim: true });
  let slug    = base;
  let counter = 2;

  while (true) {
    const { rows } = await db.query<{ id: string }>(
      'SELECT id FROM startup_profiles WHERE slug = $1',
      [slug]
    );
    if (rows.length === 0) break;
    slug = `${base}-${counter}`;
    counter++;
  }

  return slug;
}

/**
 * Derive 2-character initials from a name.
 * "Khmer Tech Solutions" → "KT"
 */
export function makeInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
