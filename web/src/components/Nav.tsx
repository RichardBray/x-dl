import { NavLink } from 'react-router-dom';

export function Nav() {
  return (
    <nav className="nav">
      <div className="nav-brand">x-dl</div>
      <div className="nav-links">
        <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Download
        </NavLink>
        <NavLink to="/article" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Article
        </NavLink>
      </div>
    </nav>
  );
}
