import test from 'node:test';
import assert from 'node:assert/strict';
import {createViewState} from './public/view-state.js';

test('refresh restores selected tenant and keeps drafts separate', () => {
  const values = new Map();
  const storage = {getItem: key => values.get(key), setItem: (key, value) => values.set(key, value)};
  const first = '684a2ec5-bc07-46e2-8ffb-ff21efda83aa';
  const second = '439c4388-c006-476f-a96d-14db9770b247';
  const before = createViewState(storage);
  before.select(first);
  before.saveDraft(first, {message: 'להוסיף באדג׳', query: 'בייס'});
  const refreshed = createViewState(storage);
  assert.equal(refreshed.selected(), first);
  assert.deepEqual(refreshed.draft(first), {message: 'להוסיף באדג׳', query: 'בייס'});
  assert.deepEqual(refreshed.draft(second), {message: '', query: ''});
  refreshed.select(null);
  assert.equal(createViewState(storage).selected(), null);
  assert.equal(refreshed.draft(first).query, 'בייס');
});

test('unavailable or corrupt browser storage does not break the app', () => {
  for (const storage of [undefined, {getItem: () => '{broken', setItem: () => {throw Error('quota');}}]) {
    const state = createViewState(storage);
    assert.equal(state.selected(), null);
    assert.deepEqual(state.draft('missing'), {message: '', query: ''});
    assert.doesNotThrow(() => state.select(null));
  }
});
