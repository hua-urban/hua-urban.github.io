import { createRequire } from 'node:module';

const period = createRequire(import.meta.url)('../traffic-light/weekly-period.js');

export function selectFullCyclePalms(source) {
  // The outer members/chapter are the older official baseline. The website's
  // latest full six-month PALMS view uses chapter.est as one complete dataset.
  const full = source?.chapter?.est;
  if (!full?.chapter || !Array.isArray(full.members) || !full.members.length
      || full.chapter.frequency !== 'weekly') {
    throw new Error('Full-cycle PALMS chapter.est is missing; refusing to use the older baseline.');
  }
  const dates = String(full.chapter.range || '').match(/\d{4}-\d{2}-\d{2}/g) || [];
  if (dates.length !== 2) throw new Error('Full-cycle PALMS must include its report date range.');
  const validated = period.validateStored({ start: dates[0], end: dates[1] });
  if (full.chapter.asOf !== validated.asOf) {
    throw new Error('Full-cycle PALMS asOf does not match the report end date.');
  }
  return full;
}

export function assertNoSharpDrop(label, count, previousCount, minRatio = 0.8) {
  if (!Number.isInteger(count) || count < 1) throw new Error(`Refusing to sync ${label}: source returned no rows.`);
  if (Number.isInteger(previousCount) && previousCount > 0 && count < previousCount * minRatio) {
    throw new Error(`Refusing to sync ${label}: ${count} is below 80% of the last published snapshot (${previousCount}); existing files are unchanged.`);
  }
  return count;
}
