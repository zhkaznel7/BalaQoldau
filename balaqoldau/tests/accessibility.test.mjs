import test from 'node:test';
import assert from 'node:assert/strict';
import { contrastRatio } from './helpers/accessibility.mjs';
test('WCAG contrast reference: black/white 21:1, identical colors 1:1', () => {
  assert.equal(contrastRatio([0, 0, 0], [255, 255, 255]), 21);
  assert.equal(contrastRatio([32, 32, 53], [32, 32, 53]), 1);
});
test('contrast calculation is symmetric and distinguishes AA normal text threshold', () => {
  const dark = [118, 118, 118], light = [119, 119, 119], white = [255, 255, 255];
  assert.equal(contrastRatio(dark, white), contrastRatio(white, dark));
  assert.ok(contrastRatio(dark, white) >= 4.5);
  assert.ok(contrastRatio(light, white) < 4.5);
});
test('brand action and form error colors have AA contrast on their surfaces', () => {
  assert.ok(contrastRatio([101, 69, 206], [255, 255, 255]) >= 4.5);
  assert.ok(contrastRatio([139, 38, 56], [255, 243, 241]) >= 4.5);
});
