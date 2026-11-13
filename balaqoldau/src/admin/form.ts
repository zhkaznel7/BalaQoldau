import {tr} from '../i18n/ui.ts';
import type { Program, ProgramInput } from './types.ts';
export interface FormValues { slug: string; category: string; title: string; description: string; sourceUrl: string; sourceName: string; applyUrl: string; deadline: string;
  ageMin: string; ageMax: string; regions: string[]; familyCategories: string[]; isDemo: boolean;eligibilityComplete:boolean }
export function initialForm(program?: Program): FormValues {
  return { eligibilityComplete:program?.eligibilityComplete??false,slug: program?.slug ?? '', category: program?.category ?? '', title: program?.title ?? '', description: program?.description ?? '',
    sourceUrl: program?.sourceUrl ?? '', sourceName: program?.sourceName ?? '', applyUrl: program?.applyUrl ?? '', deadline: program?.deadline ?? '',
    ageMin: String(program?.ageMin ?? 0), ageMax: String(program?.ageMax ?? 17), regions: program?.regions ?? [], familyCategories: program?.familyCategories ?? [], isDemo: program?.isDemo ?? false };
}
export function validateProgramForm(value: FormValues): Partial<Record<keyof FormValues, string>> {
  const errors: Partial<Record<keyof FormValues, string>> = {};
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value.slug) || value.slug.length > 120) errors.slug = tr("m042");
  if (!value.category) errors.category = tr("m043");
  if (!value.title.trim() || value.title.trim().length > 240) errors.title = tr("m044");
  if (!value.description.trim() || value.description.trim().length > 10000) errors.description = tr("m045");
  if (value.sourceName.trim().length > 200) errors.sourceName = tr("m046");
  for (const key of ['sourceUrl','applyUrl'] as const) if (value[key]) {
    try { const url = new URL(value[key]); if (url.protocol !== 'https:' || url.username || url.password || /\s/.test(value[key]) || value[key].length > 2048) throw new Error(); }
    catch { errors[key] = tr("m047"); }
  }
  const min = Number(value.ageMin), max = Number(value.ageMax);
  if (!/^\d+$/.test(value.ageMin) || !Number.isInteger(min) || min < 0 || min > 17) errors.ageMin = tr("m048");
  if (!/^\d+$/.test(value.ageMax) || !Number.isInteger(max) || max < 0 || max > 17 || min > max) errors.ageMax = tr("m049");
  if (value.deadline && (!/^\d{4}-\d{2}-\d{2}$/.test(value.deadline) || Number.isNaN(Date.parse(value.deadline)) || new Date(value.deadline).toISOString().slice(0,10) !== value.deadline)) errors.deadline = tr("m050");
  if (value.regions.length > 50) errors.regions = tr("m051");
  if (value.familyCategories.length > 50) errors.familyCategories = tr("m052");
  return errors;
}
export function programPayload(value: FormValues): ProgramInput {
  return { ...value, title: value.title.trim(), description: value.description.trim(), sourceName: value.sourceName.trim() || null,
    sourceUrl: value.sourceUrl || null, applyUrl: value.applyUrl || null, deadline: value.deadline || null,
    ageMin: Number(value.ageMin), ageMax: Number(value.ageMax) };
}
