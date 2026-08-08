'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Sunrise, Sun, Sunset, Moon, Clock, CheckCircle2, Circle, XCircle, Pill } from 'lucide-react'
import api from '@/lib/api'

// ── 시간대 블록 정의 ─────────────────────────────────────────────────────────
const TIME_BLOCKS = [
  { key: 'morning',   label: '아침', Icon: Sunrise, startH: 0,  endH: 10 },
  { key: 'afternoon', label: '점심', Icon: Sun,     startH: 10, endH: 14 },
  { key: 'evening',   label: '저녁', Icon: Sunset,  startH: 14, endH: 20 },
  { key: 'bedtime',   label: '취침', Icon: Moon,    startH: 20, endH: 24 },
]

function getBlockKey(timeStr) {
  const hour = parseInt(timeStr.split(':')[0], 10)
  if (hour < 10) return 'morning'
  if (hour < 14) return 'afternoon'
  if (hour < 20) return 'evening'
  return 'bedtime'
}

function getCurrentBlockKey() {
  const hour = new Date().getHours()
  if (hour < 10) return 'morning'
  if (hour < 14) return 'afternoon'
  if (hour < 20) return 'evening'
  return 'bedtime'
}

function classifyMedications(medications) {
  const blocks = { morning: [], afternoon: [], evening: [], bedtime: [] }
  const unset = []
  if (!Array.isArray(medications)) return { blocks, unset };
  for (const med of medications) {
    if (!med.intake_times || med.intake_times.length === 0) {
      unset.push(med)
      continue
    }
    for (const t of med.intake_times) {
      const key = getBlockKey(t)
      blocks[key].push({ med, time: t })
    }
  }
  return { blocks, unset }
}

export default function TodaySchedule({ medications, profileId }) {
  const router = useRouter()
  const [todayLogs, setTodayLogs] = useState([])
  const [takingKeys, setTakingKeys] = useState(new Set())
  const currentBlock = getCurrentBlockKey()

  // 1. 모든 Hook(useCallback, useEffect)은 최상단에 위치해야 합니다.
  const fetchTodayLogs = useCallback(async () => {
    if (!profileId) return
    try {
      const today = new Date().toISOString().split('T')[0]
      const res = await api.get('/api/v1/intake-logs', {
        params: { profile_id: profileId, target_date: today },
      })
      setTodayLogs(res.data || [])
    } catch { /* silent */ }
  }, [profileId])

  useEffect(() => { fetchTodayLogs() }, [fetchTodayLogs])

  const isTaken = useCallback(
    (medId, time) =>
      todayLogs.some(
        (l) =>
          l.medication_id === medId &&
          l.intake_status === 'TAKEN' &&
          l.scheduled_time?.startsWith(time.substring(0, 5)),
      ),
    [todayLogs],
  )

  const getLogId = useCallback(
    (medId, time) =>
      todayLogs.find(
        (l) =>
          l.medication_id === medId &&
          l.intake_status === 'TAKEN' &&
          l.scheduled_time?.startsWith(time.substring(0, 5)),
      )?.id ?? null,
    [todayLogs],
  )

  const handleUncheck = useCallback(
    async (med, time) => {
      const logId = getLogId(med.id, time)
      if (!logId) return
      const key = `${med.id}__${time}`
      setTakingKeys((prev) => new Set([...prev, key]))
      try {
        await api.delete(`/api/v1/intake-logs/${logId}`)
        await fetchTodayLogs()
      } catch { /* silent */ } finally {
        setTakingKeys((prev) => {
          const s = new Set(prev)
          s.delete(key)
          return s
        })
      }
    },
    [getLogId, fetchTodayLogs],
  )

  const handleCheck = useCallback(
    async (med, time) => {
      const key = `${med.id}__${time}`
      if (takingKeys.has(key) || isTaken(med.id, time)) return
      setTakingKeys((prev) => new Set([...prev, key]))
      try {
        const today = new Date().toISOString().split('T')[0]
        const scheduledTime = time.split(':').length === 2 ? `${time}:00` : time
        const logRes = await api.post('/api/v1/intake-logs', {
          medication_id: med.id,
          profile_id: profileId,
          scheduled_date: today,
          scheduled_time: scheduledTime,
        })
        await api.post(`/api/v1/intake-logs/${logRes.data.id}/take`)
        await fetchTodayLogs()
      } catch { /* silent */ } finally {
        setTakingKeys((prev) => {
          const s = new Set(prev)
          s.delete(key)
          return s
        })
      }
    },
    [takingKeys, isTaken, profileId, fetchTodayLogs],
  )

  const handleCheckAll = useCallback(
    async (items) => {
      const pending = items.filter(({ med, time }) => !isTaken(med.id, time))
      if (pending.length === 0) return
      const keys = pending.map(({ med, time }) => `${med.id}__${time}`)
      setTakingKeys((prev) => new Set([...prev, ...keys]))
      try {
        const today = new Date().toISOString().split('T')[0]
        await Promise.all(
          pending.map(async ({ med, time }) => {
            const scheduledTime = time.split(':').length === 2 ? `${time}:00` : time
            const logRes = await api.post('/api/v1/intake-logs', {
              medication_id: med.id,
              profile_id: profileId,
              scheduled_date: today,
              scheduled_time: scheduledTime,
            })
            await api.post(`/api/v1/intake-logs/${logRes.data.id}/take`)
          }),
        )
        await fetchTodayLogs()
      } catch { /* silent */ } finally {
        setTakingKeys((prev) => {
          const s = new Set(prev)
          keys.forEach((k) => s.delete(k))
          return s
        })
      }
    },
    [isTaken, profileId, fetchTodayLogs],
  )

  // 2. 데이터 분류 (useMemo를 사용하여 안전하게 처리)
  const { blocks, unset } = useMemo(() => classifyMedications(medications), [medications])

  // 3. 로딩 및 빈 데이터 처리 (Hook 호출 이후에 위치해야 함)
  if (!medications || !Array.isArray(medications)) {
    return <div className="py-10 text-center text-muted">복약 정보를 불러오는 중...</div>;
  }

  if (medications.length === 0) {
    return (
      <div className="py-12 text-center bg-surface-2 rounded-card border border-dashed border-line">
        <Pill size={32} className="mx-auto text-muted mb-3" />
        <p className="text-muted text-sm font-bold">오늘 등록된 복약 정보가 없습니다.</p>
        <button onClick={() => router.push('/medication')} className="mt-4 text-xs font-black text-accent hover:underline">
          약 등록하러 가기 →
        </button>
      </div>
    );
  }

  const totalItems = Object.values(blocks).reduce((acc, items) => acc + items.length, 0)
  const takenItems = Object.values(blocks).reduce(
    (acc, items) => acc + items.filter(({ med, time }) => isTaken(med.id, time)).length,
    0,
  )

  return (
    <section className="bg-surface rounded-card p-6 sm:p-8 border border-line mb-6">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent-soft rounded-2xl flex items-center justify-center">
            <Clock size={20} className="text-accent" />
          </div>
          <h2 className="text-2xl font-bold text-ink">오늘의 복약</h2>
        </div>
        {totalItems > 0 && (
          <span className="text-base font-bold text-muted">
            {takenItems}/{totalItems} 완료
          </span>
        )}
      </div>

      {totalItems > 0 && (
        <div className="mt-4 mb-6">
          <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${Math.round((takenItems / totalItems) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {TIME_BLOCKS.map(({ key, label, Icon }) => {
          const items = blocks[key]
          const isActive = key === currentBlock
          const allTaken = items.length > 0 && items.every(({ med, time }) => isTaken(med.id, time))
          const blockLoading = items.some(({ med, time }) => takingKeys.has(`${med.id}__${time}`))

          return (
            <div key={key} className={`rounded-2xl p-4 border transition-all ${isActive ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon size={16} className={isActive ? 'text-accent' : 'text-muted'} />
                  <span className={`text-sm font-bold ${isActive ? 'text-ink' : 'text-muted'}`}>{label}</span>
                </div>
                {items.length > 0 && (
                  <button
                    onClick={() => handleCheckAll(items)}
                    disabled={allTaken || blockLoading}
                    className={`text-xs font-bold transition-colors cursor-pointer disabled:cursor-default ${allTaken ? 'text-muted' : 'text-muted hover:text-ink'}`}
                  >
                    {allTaken ? '완료' : blockLoading ? '처리중...' : '전체 완료'}
                  </button>
                )}
              </div>

              {items.length === 0 ? (
                <p className="text-sm text-muted font-bold">-</p>
              ) : (
                <ul className="space-y-2.5">
                  {items.map(({ med, time }) => {
                    const taken = isTaken(med.id, time)
                    const loading = takingKeys.has(`${med.id}__${time}`)
                    return (
                      <li key={`${med.id}__${time}`} className="flex items-start gap-2">
                        <button
                          onClick={() => taken ? handleUncheck(med, time) : handleCheck(med, time)}
                          disabled={loading}
                          className={`mt-0.5 shrink-0 transition-all cursor-pointer disabled:cursor-not-allowed group/btn ${taken ? 'text-accent hover:text-critical' : 'text-muted hover:text-ink'}`}
                        >
                          {taken ? (
                            <><CheckCircle2 size={16} className="group-hover/btn:hidden" /><XCircle size={16} className="hidden group-hover/btn:block" /></>
                          ) : (
                            <Circle size={16} />
                          )}
                        </button>
                        <div className="min-w-0">
                          <p className={`text-sm font-bold leading-snug truncate transition-all ${taken ? 'text-muted line-through' : 'text-ink'}`}>{med.medicine_name}</p>
                          {(med.dose_per_intake || med.intake_instruction) && (
                            <p className="text-xs text-muted mt-0.5">{[med.dose_per_intake && `1회 ${med.dose_per_intake}`, med.intake_instruction].filter(Boolean).join(' · ')}</p>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      {unset.length > 0 && (
        <div className="mt-4 rounded-2xl border border-dashed border-line bg-surface-2 px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock size={15} className="text-muted" />
              <span className="text-sm font-bold text-muted">복약 시간 미설정</span>
            </div>
            <button onClick={() => router.push('/medication')} className="text-xs font-bold text-muted hover:text-ink transition-colors cursor-pointer">설정하기 →</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {unset.map((med) => (
              <span key={med.id} className="text-sm text-muted bg-surface border border-line px-3 py-1.5 rounded-xl font-bold">{med.medicine_name}</span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
