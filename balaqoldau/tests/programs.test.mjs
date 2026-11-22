import test from 'node:test'
import assert from 'node:assert/strict'
import { programRepository, programs, supportTypes, familyCategories } from '../src/data/programs.ts'

const empty = { region: '', age: '', family: '', type: '' }
test('empty filters return all demo programs with unique stable IDs', async () => {
  assert.equal((await programRepository.search(empty)).length, 6)
  assert.equal(new Set(programs.map(p => p.id)).size, programs.length)
  assert.ok(programs.every(p => p.isDemo && p.officialUrl === null))
})
test('all four criteria intersect and age boundaries are inclusive', async () => {
  const filters = { region: 'Алматы', age: '6', family: familyCategories[0], type: supportTypes[1] }
  assert.deepEqual((await programRepository.search(filters)).map(p => p.id), ['creative'])
  assert.equal((await programRepository.search({ ...filters, age: '14' })).length, 1)
  assert.equal((await programRepository.search({ ...filters, age: '15' })).length, 0)
  assert.equal((await programRepository.search({ ...filters, family: familyCategories[2] })).length, 0)
})
test('zero age is respected and unsupported regions have no results', async () => {
  assert.deepEqual((await programRepository.search({ ...empty, age: '0' })).map(p => p.id), ['family'])
  assert.equal((await programRepository.search({ ...empty, region: 'Түркістан облысы' })).length, 0)
})
test('details resolve stable IDs and unknown IDs return undefined', () => {
  assert.equal(programRepository.getById('creative')?.id, 'creative')
  assert.equal(programRepository.getById('missing'), undefined)
})

test('Kazakh text search ignores case and whitespace and intersects other filters', async () => {
  assert.deepEqual((await programRepository.search({ ...empty, q: '  ШЫҒАРМАШЫЛЫҚ  ' })).map(p => p.id), ['creative'])
  assert.equal((await programRepository.search({ ...empty, q: 'Шығармашылық', region: 'Астана' })).length, 0)
  assert.equal((await programRepository.search({ ...empty, q: '   ' })).length, programs.length)
  assert.equal((await programRepository.search({ ...empty, q: 'табылмайтын сөз' })).length, 0)
})
