import {
  Card,
  EmptyState,
  PageContainer,
  SecondaryButton,
  SectionHeader,
} from '@components/ui'

export function HistoryPage() {
  return (
    <PageContainer>
      <SectionHeader title="Completed workouts" />
      <Card>
        <EmptyState
          title="No workout history"
          message="Completed workout snapshots will appear here after live logging exists."
          action={
            <SecondaryButton type="button">Review placeholder</SecondaryButton>
          }
        />
      </Card>
    </PageContainer>
  )
}
