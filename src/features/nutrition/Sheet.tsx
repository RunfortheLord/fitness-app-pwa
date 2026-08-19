import { BottomSheet } from '@components/ui'

export function Sheet({
  children,
  isOpen,
  onClose,
  title,
  variant = 'sheet',
}: {
  children: React.ReactNode
  isOpen: boolean
  onClose: () => void
  title: string
  variant?: 'sheet' | 'page'
}) {
  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      variant={variant}
    >
      {children}
    </BottomSheet>
  )
}
