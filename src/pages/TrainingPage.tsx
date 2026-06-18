import { Dumbbell } from 'lucide-react'

import {
  Card,
  EmptyState,
  IconButton,
  PageContainer,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  StatusMessage,
} from '@components/ui'

export function TrainingPage() {
  return (
    <PageContainer>
      <StatusMessage>
        Programs never advance automatically. Manual selection will be added
        with workout workflows.
      </StatusMessage>

      <Card title="Active program">
        <EmptyState
          title="No active program"
          message="Program creation and activation are reserved for a later milestone."
          action={<PrimaryButton type="button">Create program</PrimaryButton>}
        />
      </Card>

      <SectionHeader
        title="Workout library"
        action={
          <IconButton aria-label="Create workout placeholder">
            <Dumbbell aria-hidden="true" size={20} />
          </IconButton>
        }
      />
      <Card>
        <p className="metric-value metric-value-small">0 workouts</p>
        <p className="muted">
          Workout day cards will use this compact surface.
        </p>
        <div className="button-row">
          <SecondaryButton type="button">Exercise library</SecondaryButton>
          <SecondaryButton type="button">Program library</SecondaryButton>
        </div>
      </Card>
    </PageContainer>
  )
}
