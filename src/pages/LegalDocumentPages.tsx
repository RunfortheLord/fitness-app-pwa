import consumerHealthDataPrivacyMarkdown from '../../docs/legal/CONSUMER_HEALTH_DATA_PRIVACY_POLICY.md?raw'
import privacyPolicyMarkdown from '../../docs/legal/PRIVACY_POLICY.md?raw'
import termsOfUseMarkdown from '../../docs/legal/TERMS_OF_USE.md?raw'

import { LegalDocumentPage } from '@pages/LegalDocumentPage'

export function TermsOfUsePage() {
  return <LegalDocumentPage markdown={termsOfUseMarkdown} />
}

export function PrivacyPolicyPage() {
  return <LegalDocumentPage markdown={privacyPolicyMarkdown} />
}

export function ConsumerHealthDataPrivacyPolicyPage() {
  return <LegalDocumentPage markdown={consumerHealthDataPrivacyMarkdown} />
}
