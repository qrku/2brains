import { renderHook, act } from '@testing-library/react';
import { useGestureHint } from './useGestureHint';

const KEY = 'board_touch_hint_v1__safe';

beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear();
});

afterEach(() => {
  jest.useRealTimers();
});

it('всплывает по просьбе и уходит сама', () => {
  const { result } = renderHook(() => useGestureHint('safe'));

  act(() => result.current.show());
  expect(result.current.visible).toBe(true);

  act(() => {
    jest.advanceTimersByTime(3000);
  });
  expect(result.current.visible).toBe(false);
});

it('молчит, если жест уже делали в прошлый раз', () => {
  localStorage.setItem(KEY, '1');
  const { result } = renderHook(() => useGestureHint('safe'));

  act(() => result.current.show());

  expect(result.current.visible).toBe(false);
});

it('сделанный жест гасит подсказку и запоминается до следующего раза', () => {
  const { result } = renderHook(() => useGestureHint('safe'));

  act(() => result.current.show());
  act(() => result.current.markGestureLearned());

  expect(result.current.visible).toBe(false);
  expect(localStorage.getItem(KEY)).toBe('1');

  // И даже в этой же сессии больше не поднимается.
  act(() => result.current.show());
  expect(result.current.visible).toBe(false);
});

it('память своя на каждый режим: раскладки разные', () => {
  localStorage.setItem(KEY, '1');
  const { result } = renderHook(() => useGestureHint('default'));

  act(() => result.current.show());

  // Освоенный «аккуратный» ничего не говорит про жесты «обычного».
  expect(result.current.visible).toBe(true);
});
