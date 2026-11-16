/** @description 验证业务切换和卸载后的取消与晚到响应隔离，替身只实现领域查询接口。 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useQuery } from './useQuery'

function deferred() {
  let resolve: ((value: string) => void) | undefined
  const promise = new Promise<string>((done) => {
    resolve = done
  })
  return {
    promise,
    complete: (value: string) => {
      if (!resolve) throw new Error('查询尚未初始化')
      resolve(value)
    },
  }
}

describe('页面查询生命周期', () => {
  it('切换业务后取消旧等待，并忽略不遵守取消的晚到响应', async () => {
    const first = deferred()
    const second = deferred()
    let previousSignal: AbortSignal | undefined
    const loadFirst = vi.fn((signal: AbortSignal) => {
      previousSignal = signal
      return first.promise
    })
    const loadSecond = vi.fn(() => second.promise)
    const { result, rerender } = renderHook((options) => useQuery(options), {
      initialProps: { key: '业务甲', load: loadFirst },
    })
    rerender({ key: '业务乙', load: loadSecond })
    expect(previousSignal?.aborted).toBe(true)
    await act(async () => {
      second.complete('乙的资料')
      await second.promise
    })
    await waitFor(() => expect(result.current.data).toBe('乙的资料'))
    await act(async () => {
      first.complete('甲的旧资料')
      await first.promise
    })
    expect(result.current.data).toBe('乙的资料')
  })
  it('卸载页面会中断本地等待，不声称服务端事务已撤回', () => {
    let signal: AbortSignal | undefined
    const load = (value: AbortSignal) => {
      signal = value
      return new Promise<string>(() => undefined)
    }
    const { unmount } = renderHook(() => useQuery({ key: 'page', load }))
    unmount()
    expect(signal?.aborted).toBe(true)
  })
})
