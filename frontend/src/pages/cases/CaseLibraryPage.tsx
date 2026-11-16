/** @description 维护业务案例列表与 URL 筛选，刷新、分享和前进后退恢复同一查询。 */
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Button, Empty, Input, Segmented, Skeleton, Tag } from 'antd'
import {
  ArrowRightOutlined,
  FileTextOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { useCases } from '../../hooks/useCases'
import type { Business } from '../../types'
import { publicationLabels, validityLabels } from '../../types'

interface CaseLibraryPageProps {
  /** 当前账号允许访问的业务。 */
  business: Business
  /** 通过路由定位案例。 */
  openCase: (id: string) => void
  /** 为真时只展示可见草稿和待确认案例，默认展示案例库。 */
  review?: boolean
}

/** 加载当前业务案例，review 模式展示可访问的草稿及待确认记录。 */
export function CaseLibraryPage({ business, openCase, review = false }: CaseLibraryPageProps) {
  const navigate = useNavigate()
  const [parameters, setParameters] = useSearchParams()
  const search = parameters.get('q') ?? ''
  const filter =
    ['全部', '已验证', '待验证', '已失效'].find((value) => value === parameters.get('validity')) ??
    '全部'
  const state = useCases(business, search)
  function setSearch(value: string) {
    setParameters((previous) => {
      const next = new URLSearchParams(previous)
      next.set('q', value)
      return next
    })
  }
  function setFilter(value: string) {
    setParameters((previous) => {
      const next = new URLSearchParams(previous)
      next.set('validity', value)
      return next
    })
  }
  function onIntake() {
    void navigate(`/intake?${new URLSearchParams({ business })}`)
  }
  const items = (state.data || []).filter((item) => {
    if (review) return ['pending', 'draft'].includes(item.publication)
    if (filter === '已验证') return item.publication === 'published' && item.validity === 'verified'
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
          defaultValue={search}
          key={search}
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
      {state.isLoading ? (
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
            <button className="case-card" key={item.id} onClick={() => openCase(item.id)}>
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
                  {new Date(item.updated_at).toLocaleDateString('zh-CN')} <ArrowRightOutlined />
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  )
}
