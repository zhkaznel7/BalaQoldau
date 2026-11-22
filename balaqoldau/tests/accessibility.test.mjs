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
  assert.ok(contrastRatio([7, 94, 168], [255, 255, 255]) >= 4.5);
  assert.ok(contrastRatio([147, 43, 50], [255, 243, 243]) >= 4.5);
});

test('GovTech notice, muted text and form boundaries meet their contrast thresholds', () => {
  assert.ok(contrastRatio([255, 255, 255], [16, 46, 80]) >= 4.5);
  assert.ok(contrastRatio([82, 100, 119], [241, 245, 249]) >= 4.5);
  assert.ok(contrastRatio([115, 132, 154], [255, 255, 255]) >= 3);
});

test('yellow CTA keeps navy text at WCAG AA contrast', () => {
  assert.ok(contrastRatio([16, 46, 80], [244, 185, 66]) >= 4.5);
  assert.ok(contrastRatio([16, 46, 80], [239, 173, 40]) >= 4.5);
});
