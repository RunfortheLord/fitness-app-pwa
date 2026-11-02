import { BottomSheet } from '@components/ui'

export function Sheet({
  children,
  headerAction,
  isOpen,
  onClose,
  title,
  variant = 'sheet',
}: {
  children: React.ReactNode
  headerAction?: React.ReactNode
  isOpen: boolean
  onClose: () => void
  title: string
  variant?: 'sheet' | 'page'
}) {
  return (
    <BottomSheet
      isOpen={isOpen}
      headerAction={headerAction}
      onClose={onClose}
      title={title}
      variant={variant}
    >
      {children}
    </BottomSheet>
  )
}
