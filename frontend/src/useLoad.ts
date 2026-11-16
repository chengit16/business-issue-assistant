/**
 * @description 维护页面查询的加载与错误状态，并在业务切换或卸载后隔离旧请求响应。
 */
import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

/** 返回查询数据、错误、加载状态及手动刷新入口，路径变化时忽略旧响应。 */
export function useLoad<T>(path: string) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const reload = useCallback(() => setRevision((value) => value + 1), [])
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setData(null)
    api<T>(path)
      .then((value) => {
        if (active) setData(value)
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    // 切换业务后忽略旧请求，避免慢响应把其他业务的数据填回当前页面。
    return () => {
      active = false
    }
  }, [path, revision])
  return { data, error, loading, reload }
}
