import { renderHook, act } from '@testing-library/react';
import { useTouchMode } from './useTouchMode';

const KEY = 'board_touch_mode_v1';

beforeEach(() => {
  localStorage.clear();
});

it('без выбора отдаёт раскладку по умолчанию', () => {
  const { result } = renderHook(() => useTouchMode());

  expect(result.current.mode).toBe('default');
});

it('поднимает выбранную в прошлый раз раскладку', () => {
  localStorage.setItem(KEY, 'safe');
  const { result } = renderHook(() => useTouchMode());

  expect(result.current.mode).toBe('safe');
});

it('не верит хранилищу на слово: режим могли переименовать или убрать', () => {
  localStorage.setItem(KEY, 'сверхточный');
  const { result } = renderHook(() => useTouchMode());

  expect(result.current.mode).toBe('default');
});

it('выбор переживает перезагрузку', () => {
  const { result } = renderHook(() => useTouchMode());

  act(() => result.current.setMode('safe'));

  expect(result.current.mode).toBe('safe');
  expect(localStorage.getItem(KEY)).toBe('safe');
});
