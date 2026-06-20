import { Dumbbell, Footprints, Home, Plus, Utensils } from 'lucide-react'
import { NavLink } from 'react-router-dom'

type BottomNavigationProps = {
  onAdd: () => void
}

export function BottomNavigation({ onAdd }: BottomNavigationProps) {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      <NavLink to="/" end className="bottom-nav-link">
        <Home aria-hidden="true" size={20} />
        <span>Home</span>
      </NavLink>
      <NavLink to="/nutrition" className="bottom-nav-link">
        <Utensils aria-hidden="true" size={20} />
        <span>Nutrition</span>
      </NavLink>
      <button
        className="bottom-nav-add"
        type="button"
        aria-label="Open quick actions"
        onClick={onAdd}
      >
        <Plus aria-hidden="true" size={28} />
      </button>
      <NavLink to="/training" className="bottom-nav-link">
        <Dumbbell aria-hidden="true" size={20} />
        <span>Training</span>
      </NavLink>
      <NavLink to="/run" className="bottom-nav-link">
        <Footprints aria-hidden="true" size={20} />
        <span>Run</span>
      </NavLink>
    </nav>
  )
}
