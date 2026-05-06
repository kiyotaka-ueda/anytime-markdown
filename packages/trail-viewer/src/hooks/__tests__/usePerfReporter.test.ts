/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { usePerfReporter } from '../usePerfReporter';

describe('usePerfReporter', () => {
  it('connected=true では即座に send が呼ばれる', () => {
    const send = jest.fn();
    const { result } = renderHook(() => usePerfReporter(send, true));

    act(() => {
      result.current.report('firstMount', 123);
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('perf-report', { metric: 'firstMount', ms: 123 });
  });

  it('connected=false では send は呼ばれずキューに溜まる', () => {
    const send = jest.fn();
    const { result } = renderHook(() => usePerfReporter(send, false));

    act(() => {
      result.current.report('firstMount', 50);
      result.current.report('lazyChunk', 200);
    });

    expect(send).not.toHaveBeenCalled();
  });

  it('connected が false→true へ遷移したとき queue を順序保持で flush する', () => {
    const send = jest.fn();
    const { result, rerender } = renderHook(
      ({ connected }) => usePerfReporter(send, connected),
      { initialProps: { connected: false } },
    );

    act(() => {
      result.current.report('a', 1);
      result.current.report('b', 2);
      result.current.report('c', 3);
    });
    expect(send).not.toHaveBeenCalled();

    rerender({ connected: true });

    expect(send).toHaveBeenCalledTimes(3);
    expect(send.mock.calls[0]).toEqual(['perf-report', { metric: 'a', ms: 1 }]);
    expect(send.mock.calls[1]).toEqual(['perf-report', { metric: 'b', ms: 2 }]);
    expect(send.mock.calls[2]).toEqual(['perf-report', { metric: 'c', ms: 3 }]);
  });

  it('flush 後の追加 report は即座に送られる (queue は空に戻る)', () => {
    const send = jest.fn();
    const { result, rerender } = renderHook(
      ({ connected }) => usePerfReporter(send, connected),
      { initialProps: { connected: false } },
    );

    act(() => {
      result.current.report('queued', 10);
    });
    rerender({ connected: true });
    expect(send).toHaveBeenCalledTimes(1);

    send.mockClear();
    act(() => {
      result.current.report('after', 20);
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('perf-report', { metric: 'after', ms: 20 });
  });

  it('connected=true→false で再接続前の report は再キューされる', () => {
    const send = jest.fn();
    const { result, rerender } = renderHook(
      ({ connected }) => usePerfReporter(send, connected),
      { initialProps: { connected: true } },
    );

    act(() => {
      result.current.report('online', 1);
    });
    expect(send).toHaveBeenCalledTimes(1);

    rerender({ connected: false });
    send.mockClear();

    act(() => {
      result.current.report('offline', 2);
    });
    expect(send).not.toHaveBeenCalled();

    rerender({ connected: true });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('perf-report', { metric: 'offline', ms: 2 });
  });

  it('meta を渡すと payload に含まれる、省略時は含まれない', () => {
    const send = jest.fn();
    const { result } = renderHook(() => usePerfReporter(send, true));

    act(() => {
      result.current.report('m1', 1, { tab: 'analytics' });
      result.current.report('m2', 2);
    });

    expect(send.mock.calls[0]).toEqual(['perf-report', { metric: 'm1', ms: 1, meta: { tab: 'analytics' } }]);
    expect(send.mock.calls[1]).toEqual(['perf-report', { metric: 'm2', ms: 2 }]);
  });
});
