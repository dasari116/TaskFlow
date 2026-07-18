import React from 'react';
import { Sun, Moon, LogOut, CheckSquare } from 'lucide-react';

export default function Navbar({ email, theme, toggleTheme, onLogout }) {
  return (
    <nav className="navbar glass">
      <div className="navbar-brand">
        <CheckSquare size={26} strokeWidth={2.5} />
        <span>TaskFlow</span>
      </div>

      <div className="navbar-actions">
        {theme === 'dark' ? (
          <button 
            onClick={toggleTheme} 
            className="btn btn-secondary btn-icon"
            title="Switch to Light Mode"
          >
            <Sun size={18} />
          </button>
        ) : (
          <button 
            onClick={toggleTheme} 
            className="btn btn-secondary btn-icon"
            title="Switch to Dark Mode"
          >
            <Moon size={18} />
          </button>
        )}

        {email && (
          <>
            <span className="user-email">{email}</span>
            <button 
              onClick={onLogout} 
              className="btn btn-secondary"
              style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}
            >
              <LogOut size={16} />
              Logout
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
