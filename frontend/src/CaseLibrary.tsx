/**
 * @description 按当前业务加载案例并筛选发布与验证状态，实际可见范围由服务端授权决定。
 */
import { useState } from 'react'
import { Alert, Button, Empty, Input, Segmented, Skeleton, Tag } from 'antd'
import {
  ArrowRightOutlined,
  FileTextOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { useLoad } from './useLoad'
import type { Business, Case } from './types'
import { publicationLabels, validityLabels } from './types'

/** 加载当前业务案例，review 模式展示可访问的草稿及待确认记录。 */
export function CaseLibrary({
  business,
  openCase,
  onIntake,
  review = false,
}: {
  business: Business
  openCase: (id: string) => void
  onIntake: () => void
  review?: boolean
}) {
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('全部')
  const state = useLoad<Case[]>(
    `/cases?business=${encodeURIComponent(business)}&q=${encodeURIComponent(search)}`,
  )
  const items = (state.data || []).filter((item) => {
    if (review) return ['pending', 'draft'].includes(item.publication)
    if (filter === '已验证')
      return item.publication === 'published' && item.validity === 'verified'
    if (filter === '待验证') return item.validity === 'unverified'
    if (filter === '已失效') return item.validity === 'invalid'
    return true
  })
  return (
    <>
      <div className="page-heading">
        <div className="page-intro compact">
          <span className="eyebrow">
            {review ? '把经验核对清楚，再分享给团队' : '每一次解决，都有迹可循'}
          </span>
          <h1>{review ? '待确认经验' : '团队案例库'}</h1>
          <p>
            {review
              ? '校正草稿、记录验证结果，并确认适用范围。'
              : '查找处理经验，核对适用条件，复用团队已经走过的路。'}
          </p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={onIntake}>
          收录经验
        </Button>
      </div>
      <section className="library-toolbar">
        <Input.Search
          aria-label="搜索案例"
          placeholder="搜索问题、错误码或关键词"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onSearch={setSearch}
          allowClear
          prefix={<SearchOutlined />}
          enterButton="搜索"
        />
        {!review && (
          <Segmented
            aria-label="验证状态筛选"
            options={['全部', '已验证', '待验证', '已失效']}
            value={filter}
            onChange={setFilter}
          />
        )}
      </section>
      <div className="list-count">
        {business}
        <span>
          共 {items.length} 条{review ? '待处理经验' : '经验'}
        </span>
      </div>
      {state.error && (
        <Alert
          type="error"
          title={state.error}
          action={<Button onClick={state.reload}>重试</Button>}
        />
      )}
      {state.loading ? (
        <Skeleton active />
      ) : !items.length ? (
        <div className="panel empty-library">
          <Empty
            description={
              search
                ? '没有找到匹配的案例，请尝试其他关键词'
                : review
                  ? '当前没有待确认的经验'
                  : '这个业务还没有案例'
            }
          />
          <Button onClick={onIntake}>收录一条经验</Button>
        </div>
      ) : (
        <div className="case-grid">
          {items.map((item) => (
            <button
              className="case-card"
              key={item.id}
              onClick={() => openCase(item.id)}
            >
              <div className="case-card-top">
                <span className="case-file">
                  <FileTextOutlined />
                </span>
                <div>
                  <Tag
                    color={
                      item.validity === 'verified'
                        ? 'green'
                        : item.validity === 'invalid'
                          ? 'red'
                          : 'default'
                    }
                  >
                    {validityLabels[item.validity]}
                  </Tag>
                  {item.is_demo && <Tag>示例</Tag>}
                </div>
              </div>
              <h2>{item.title}</h2>
              <p>{item.symptom}</p>
              <div className="case-condition">
                <span>适用条件</span>
                {item.conditions || '待处理人补充'}
              </div>
              <div className="case-card-footer">
                <span>
                  {publicationLabels[item.publication]} · v{item.version}
                </span>
                <span>
                  {new Date(item.updated_at).toLocaleDateString('zh-CN')}{' '}
                  <ArrowRightOutlined />
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  )
}
