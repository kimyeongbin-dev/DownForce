'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'

import BottomNav from '@/components/layout/BottomNav'
import api from '@/lib/api'
import { useMedication } from '@/contexts/MedicationContext'
import { medicationEditPatchSchema } from '@/schemas'
import FormError from '@/components/form/FormError'
import MedicineNameAutocomplete from '@/components/medication/MedicineNameAutocomplete'

// 여러 medication 을 한 화면에서 검증하기 위해 array 로 wrap.
const editFormSchema = z.object({
  prescription_date: z.string().optional(),
  meds: z.array(medicationEditPatchSchema).min(1, '저장할 약품이 없어요'),
})

function EditSkeleton() {
  return (
    <div className="min-h-screen bg-surface-2 pb-32 animate-pulse">
      <div className="max-w-2xl mx-auto">
        <div className="h-14 bg-surface border-b border-line" />
        <div className="px-6 py-8 space-y-4">
          <div className="h-16 bg-surface rounded-2xl border border-line" />
          {[1, 2].map((i) => (
            <div key={i} className="h-48 bg-surface rounded-2xl border border-line" />
          ))}
        </div>
      </div>
    </div>
  )
}

function MedicationEditContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const ids = searchParams.get('ids')?.split(',').filter(Boolean) ?? []
  const { medications, updateMedication } = useMedication()

  const [isLoading, setIsLoading] = useState(true)

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(editFormSchema),
    mode: 'onChange',
    defaultValues: {
      prescription_date: '',
      meds: [],
    },
  })
  const { fields, remove } = useFieldArray({ control, name: 'meds' })

  useEffect(() => {
    if (ids.length === 0) {
      router.push('/medication')
      return
    }

    const fillForm = (rows) => {
      reset({
        prescription_date: rows[0]?.dispensed_date || rows[0]?.start_date || '',
        meds: rows.map((m) => ({
          id: m.id,
          medicine_name: m.medicine_name || '',
          dose_per_intake: m.dose_per_intake || '',
          intake_instruction: m.intake_instruction || '',
          category: m.category || '',
          daily_intake_count: m.daily_intake_count ?? '',
          total_intake_days: m.total_intake_days ?? '',
        })),
      })
      setIsLoading(false)
    }

    const cached = ids.map((id) => medications.find((m) => m.id === id)).filter(Boolean)
    if (cached.length === ids.length) {
      fillForm(cached)
      return
    }
    if (medications.length === 0) return // 첫 fetch 대기.

    const fetchAll = async () => {
      try {
        const results = await Promise.all(ids.map((id) => api.get(`/api/v1/medications/${id}`)))
        fillForm(results.map((r) => r.data))
      } catch {
        toast.error('약품 정보를 불러올 수 없습니다.')
        router.push('/medication')
      }
    }
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medications])

  const onSubmit = async (values) => {
    if (values.meds.length === 0) {
      toast.error('저장할 약품이 없어요.')
      return
    }
    try {
      await Promise.all(
        values.meds.map((med) =>
          updateMedication(med.id, {
            medicine_name: med.medicine_name,
            category: med.category || null,
            dose_per_intake: med.dose_per_intake || null,
            daily_intake_count: med.daily_intake_count || null,
            total_intake_days: med.total_intake_days || null,
            intake_instruction: med.intake_instruction || null,
            dispensed_date: values.prescription_date || null,
          }),
        ),
      )
      toast.success('수정이 완료되었습니다.')
      router.push('/medication')
    } catch {
      toast.error('저장 중 오류가 발생했습니다.')
    }
  }

  const onInvalid = (formErrors) => {
    // 첫 에러 메시지만 toast — 어느 row 든 한 번에 1개 안내.
    const dig = (obj) => {
      if (!obj) return null
      if (typeof obj === 'object' && 'message' in obj && obj.message) return obj.message
      for (const v of Object.values(obj)) {
        const r = dig(v)
        if (r) return r
      }
      return null
    }
    toast.error(dig(formErrors) || '입력값을 다시 확인해주세요.')
  }

  if (isLoading) return <EditSkeleton />

  return (
    <main className="min-h-screen bg-surface-2 pb-24">
      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="max-w-2xl mx-auto">
        <div className="bg-surface border-b border-line px-6 py-4 flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-muted hover:text-black cursor-pointer text-xl"
          >
            ←
          </button>
          <div>
            <h1 className="font-bold text-ink">처방전 수정</h1>
            <p className="text-xs text-muted">내용을 터치해서 수정할 수 있어요</p>
          </div>
        </div>

        <div className="px-6 py-6 space-y-4">
          <div className="bg-blue-50 rounded-2xl p-4 flex items-center gap-3">
            <span className="text-lg font-bold text-blue-400">!</span>
            <p className="text-blue-600 text-xs">
              등록된 약품 정보를 수정합니다. 처방일은 전체 약품에 공통 적용됩니다.
            </p>
          </div>

          <div className="bg-surface rounded-2xl p-5 border border-line flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-ink">처방일</p>
              <p className="text-xs text-muted mt-0.5">처방전에 적힌 날짜를 확인해주세요</p>
            </div>
            <input
              type="date"
              {...register('prescription_date')}
              className="text-sm font-bold text-ink border border-line rounded-xl px-3 py-2 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-surface-2"
            />
          </div>

          <div className="space-y-4">
            {fields.map((field, i) => (
              <div
                key={field.id}
                className="bg-surface rounded-2xl p-6 shadow-sm border border-line"
              >
                <div className="flex justify-between items-start mb-4 gap-4">
                  <div className="flex-1">
                    <Controller
                      control={control}
                      name={`meds.${i}.medicine_name`}
                      render={({ field }) => (
                        <MedicineNameAutocomplete
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="약품명 입력"
                          inputClassName="font-bold text-lg text-ink border-b-2 border-transparent hover:border-blue-200 focus:border-blue-500 focus:outline-none bg-transparent w-full transition-colors"
                        />
                      )}
                    />
                    <FormError name={`meds.${i}.medicine_name`} errors={errors} />
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="text-muted hover:text-red-400 mt-1 cursor-pointer shrink-0"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-surface-2 p-2 rounded-xl border border-line">
                    <p className="text-[10px] text-muted mb-1 px-1">1회 복용량</p>
                    <input
                      type="text"
                      {...register(`meds.${i}.dose_per_intake`)}
                      className="text-sm font-bold text-ink bg-transparent w-full focus:outline-none focus:text-blue-600 px-1"
                      placeholder="예: 1정"
                    />
                    <FormError name={`meds.${i}.dose_per_intake`} errors={errors} />
                  </div>
                  <div className="bg-surface-2 p-2 rounded-xl border border-line">
                    <p className="text-[10px] text-muted mb-1 px-1">1일 복용 횟수</p>
                    <input
                      type="number"
                      inputMode="numeric"
                      {...register(`meds.${i}.daily_intake_count`)}
                      className="text-sm font-bold text-ink bg-transparent w-full focus:outline-none focus:text-blue-600 px-1"
                      placeholder="예: 3"
                    />
                    <FormError name={`meds.${i}.daily_intake_count`} errors={errors} />
                  </div>
                  <div className="bg-surface-2 p-2 rounded-xl border border-line">
                    <p className="text-[10px] text-muted mb-1 px-1">총 복용 일수</p>
                    <input
                      type="number"
                      inputMode="numeric"
                      {...register(`meds.${i}.total_intake_days`)}
                      className="text-sm font-bold text-ink bg-transparent w-full focus:outline-none focus:text-blue-600 px-1"
                      placeholder="예: 5"
                    />
                    <FormError name={`meds.${i}.total_intake_days`} errors={errors} />
                  </div>
                  <div className="bg-surface-2 p-2 rounded-xl border border-line">
                    <p className="text-[10px] text-muted mb-1 px-1">복용 방법</p>
                    <input
                      type="text"
                      {...register(`meds.${i}.intake_instruction`)}
                      className="text-sm font-bold text-ink bg-transparent w-full focus:outline-none focus:text-blue-600 px-1"
                      placeholder="예: 식후 30분"
                    />
                    <FormError name={`meds.${i}.intake_instruction`} errors={errors} />
                  </div>
                </div>

                {field.category && (
                  <div className="mt-3 bg-surface-2 p-2 rounded-xl border border-line">
                    <p className="text-[10px] text-muted mb-1 px-1">약품 분류</p>
                    <input
                      type="text"
                      {...register(`meds.${i}.category`)}
                      className="text-sm font-bold text-ink bg-transparent w-full focus:outline-none focus:text-blue-600 px-1"
                      placeholder="예: 해열진통제"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-3 pb-10">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 bg-surface border border-line py-4 rounded-xl text-muted text-sm font-bold cursor-pointer hover:bg-surface-2 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-accent text-accent-ink py-4 rounded-xl font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:brightness-110 enabled:cursor-pointer"
            >
              {isSubmitting ? '저장 중...' : '수정 완료'}
            </button>
          </div>
        </div>
      </form>

      <BottomNav />
    </main>
  )
}

export default function MedicationEditPage() {
  return (
    <Suspense fallback={<EditSkeleton />}>
      <MedicationEditContent />
    </Suspense>
  )
}
