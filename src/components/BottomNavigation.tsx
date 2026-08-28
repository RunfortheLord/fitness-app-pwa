import { Dumbbell, Footprints, Home, Plus, Utensils } from 'lucide-react'
import { NavLink } from 'react-router-dom'

import { useLanguage } from '@components/languageContextValue'

type BottomNavigationProps = {
  onAdd: () => void
  trainingTo?: string
}

export function BottomNavigation({
  onAdd,
  trainingTo = '/training',
}: BottomNavigationProps) {
  const { t } = useLanguage()
  return (
    <nav className="bottom-nav" aria-label={t('Primary')}>
      <NavLink to="/" end className="bottom-nav-link">
        <Home aria-hidden="true" size={20} />
        <span>{t('Home')}</span>
      </NavLink>
      <NavLink to="/nutrition" className="bottom-nav-link">
        <Utensils aria-hidden="true" size={20} />
        <span>{t('Nutrition')}</span>
      </NavLink>
      <button
        className="bottom-nav-add"
        type="button"
        aria-label={t('Open quick actions')}
        onClick={onAdd}
      >
        <Plus aria-hidden="true" size={28} />
      </button>
      <NavLink to={trainingTo} className="bottom-nav-link">
        <Dumbbell aria-hidden="true" size={20} />
        <span>{t('Training')}</span>
      </NavLink>
      <NavLink to="/run" className="bottom-nav-link">
        <Footprints aria-hidden="true" size={20} />
        <span>{t('Cardio')}</span>
      </NavLink>
    </nav>
  )
}
