/** @description 管理页面写操作的等待生命周期，取消不代表服务端事务已撤销。 */
import { useCallback, useEffect, useRef } from 'react'

/** 单次等待的范围，调用方必须在 finally 中释放。 */
export interface RequestScope {
  /** 交给领域 Service 的取消信号。 */
  signal: AbortSignal
  /** 完成后从当前页面的活动集合移除。 */
  complete: () => void
}

/** 创建页面范围内的请求等待，卸载时统一取消晚到响应。 */
export function useRequestScope(): () => RequestScope {
  const controllers = useRef(new Set<AbortController>())
  useEffect(() => {
    const active = controllers.current
    return () => {
      for (const controller of active) controller.abort()
      active.clear()
    }
  }, [])
  return useCallback(() => {
    const controller = new AbortController()
    controllers.current.add(controller)
    return {
      signal: controller.signal,
      complete: () => {
        controllers.current.delete(controller)
      },
    }
  }, [])
}
