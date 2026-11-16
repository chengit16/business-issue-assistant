/** @description 管理领域查询的加载、错误和重试，清理时取消请求并隔离晚到响应。 */
import { useCallback, useEffect, useState } from 'react'
import { errorMessage, isCancelled } from '../api/client'

/** 查询选项，load 应由业务 Hook 以稳定引用提供。 */
export interface QueryOptions<T> {
  /** 覆盖账号、业务和筛选条件的查询键。 */
  key: string
  /** 领域 Service 查询，必须向 Axios 传递取消信号。 */
  load: (signal: AbortSignal) => Promise<T>
}
/** 查询结果所有权属于当前页面，刷新会清理旧结果并重新读取。 */
export interface QueryResult<T> {
  /** 当前键对应的数据，未完成或失败时为空。 */
  data: T | null
  /** 归一化错误消息，取消不会生成可展示错误。 */
  error: string
  /** 当前键仍在等待响应。 */
  isLoading: boolean
  /** 显式重新请求，适用于重试和写入后的精准刷新。 */
  reload: () => void
}

/** 以完整键隔离异步结果，卸载和键变化时取消本地等待。 */
export function useQuery<T>({ key, load }: QueryOptions<T>): QueryResult<T> {
  const [revision, setRevision] = useState(0)
  const requestKey = `${key}:${revision}`
  const [state, setState] = useState<{ key: string; data: T | null; error: string } | null>(null)
  const reload = useCallback(() => setRevision((value) => value + 1), [])
  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ key: requestKey, data, error: '' })
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted && !isCancelled(reason)) {
          setState({ key: requestKey, data: null, error: errorMessage(reason) })
        }
      })
    // 账号或业务切换后，旧请求既不能回填新视图，也不能继续占用连接。
    return () => controller.abort()
  }, [requestKey, load])
  const current = state?.key === requestKey ? state : null
  return {
    data: current?.data ?? null,
    error: current?.error ?? '',
    isLoading: current === null,
    reload,
  }
}
