import LoadingSpinner from '@/components/common/LoadingSpinner'

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="lg" />
        <p className="text-muted font-medium">페이지를 불러오는 중...</p>
      </div>
    </div>
  )
}
