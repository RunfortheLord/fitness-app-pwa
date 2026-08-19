import {
  ArrowLeft,
  Copy,
  Dumbbell,
  Edit2,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'

import {
  Card,
  EmptyState,
  FormField,
  IconButton,
  LoadingState,
  SecondaryButton,
  SectionHeader,
} from '@components/ui'
import type { ProgramTemplate } from '@shared-types/app'

import { formatTimestamp } from './exerciseMetadata'
import type { LoadStatus } from './types'

function ProgramTemplateRow({
  template,
  onActivate,
  onClone,
  onDelete,
  onEdit,
}: {
  template: ProgramTemplate
  onActivate: (template: ProgramTemplate) => void
  onClone: (templateId: string) => void
  onDelete: (template: ProgramTemplate) => void
  onEdit: (templateId: string) => void
}) {
  return (
    <div className="program-template-row">
      <div>
        <strong>{template.name}</strong>
        <small>
          {template.lastActiveAt
            ? `Last active ${formatTimestamp(template.lastActiveAt)}`
            : `Created ${formatTimestamp(template.createdAt)}`}
        </small>
      </div>
      <div className="row-actions">
        <IconButton
          aria-label={`Edit ${template.name}`}
          onClick={() => onEdit(template.id)}
        >
          <Edit2 aria-hidden="true" size={18} />
        </IconButton>
        <IconButton
          aria-label={`Activate ${template.name}`}
          onClick={() => onActivate(template)}
        >
          <Dumbbell aria-hidden="true" size={18} />
        </IconButton>
        <IconButton
          aria-label={`Clone ${template.name}`}
          onClick={() => onClone(template.id)}
        >
          <Copy aria-hidden="true" size={18} />
        </IconButton>
        <IconButton
          aria-label={`Delete ${template.name}`}
          onClick={() => onDelete(template)}
        >
          <Trash2 aria-hidden="true" size={18} />
        </IconButton>
      </div>
    </div>
  )
}

export function ProgramLibrary({
  loadStatus,
  onActivate,
  onBrowse,
  onClone,
  onCreateProgram,
  onDelete,
  onEdit,
  onShowMore,
  showBrowse,
  templates,
}: {
  loadStatus: LoadStatus
  onActivate: (template: ProgramTemplate) => void
  onBrowse: () => void
  onClone: (templateId: string) => void
  onCreateProgram: () => void
  onDelete: (template: ProgramTemplate) => void
  onEdit: (templateId: string) => void
  onShowMore: () => void
  showBrowse: boolean
  templates: ProgramTemplate[]
}) {
  const visibleTemplates = templates.slice(0, 3)

  return (
    <>
      <SectionHeader
        title="Program library"
        action={
          templates.length ? (
            <IconButton aria-label="Create program" onClick={onCreateProgram}>
              <Plus aria-hidden="true" size={20} />
            </IconButton>
          ) : undefined
        }
      />
      <Card>
        {loadStatus === 'loading' ? (
          <LoadingState label="Loading programs" />
        ) : null}
        {loadStatus === 'ready' && !templates.length ? (
          <EmptyState
            title="No saved programs"
            message="Create your own program or add one from Browse programs."
          />
        ) : null}
        {loadStatus === 'ready' && templates.length ? (
          <div className="program-library-list">
            {visibleTemplates.map((template) => (
              <ProgramTemplateRow
                key={template.id}
                onActivate={onActivate}
                onClone={onClone}
                onDelete={onDelete}
                onEdit={onEdit}
                template={template}
              />
            ))}
            {templates.length > 3 ? (
              <SecondaryButton type="button" onClick={onShowMore}>
                Show More
              </SecondaryButton>
            ) : null}
          </div>
        ) : null}
        {showBrowse ? (
          <SecondaryButton
            className="program-browse-button"
            type="button"
            onClick={onBrowse}
          >
            Browse programs
          </SecondaryButton>
        ) : null}
      </Card>
    </>
  )
}

export function FullProgramLibraryPage({
  loadStatus,
  onActivate,
  onBack,
  onClone,
  onCreateProgram,
  onDelete,
  onEdit,
  query,
  setQuery,
  templates,
}: {
  loadStatus: LoadStatus
  onActivate: (template: ProgramTemplate) => void
  onBack: () => void
  onClone: (templateId: string) => void
  onCreateProgram: () => void
  onDelete: (template: ProgramTemplate) => void
  onEdit: (templateId: string) => void
  query: string
  setQuery: (query: string) => void
  templates: ProgramTemplate[]
}) {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredTemplates = normalizedQuery
    ? templates.filter((template) =>
        template.name.toLocaleLowerCase().includes(normalizedQuery),
      )
    : templates

  return (
    <Card className="subpage-enter">
      <div className="set-goal-header">
        <IconButton aria-label="Back to training" onClick={onBack}>
          <ArrowLeft aria-hidden="true" size={20} />
        </IconButton>
        <h2 className="set-goal-title">Program library</h2>
        <IconButton aria-label="Create program" onClick={onCreateProgram}>
          <Plus aria-hidden="true" size={20} />
        </IconButton>
      </div>
      <FormField id="program-library-search" label="Search programs">
        <div className="input-icon-row">
          <Search aria-hidden="true" size={18} />
          <input
            id="program-library-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search programs"
            type="search"
            value={query}
          />
        </div>
      </FormField>
      {loadStatus === 'loading' ? (
        <LoadingState label="Loading programs" />
      ) : null}
      {loadStatus === 'ready' && !filteredTemplates.length ? (
        <EmptyState
          title={query.trim() ? 'No programs found' : 'No saved programs'}
          message="Create your own program or add one from Browse programs."
          action={
            <SecondaryButton type="button" onClick={onCreateProgram}>
              Create program
            </SecondaryButton>
          }
        />
      ) : null}
      {loadStatus === 'ready' && filteredTemplates.length ? (
        <div className="program-library-list">
          {filteredTemplates.map((template) => (
            <ProgramTemplateRow
              key={template.id}
              onActivate={onActivate}
              onClone={onClone}
              onDelete={onDelete}
              onEdit={onEdit}
              template={template}
            />
          ))}
        </div>
      ) : null}
    </Card>
  )
}
