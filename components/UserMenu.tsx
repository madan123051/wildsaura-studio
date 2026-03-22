import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { LogOut, History, Settings, User as UserIcon } from 'lucide-react';

interface UserMenuProps {
  user: User | null;
  onSignOut: () => void;
  onNavigate: (tab: string) => void;
}

export default function UserMenu({ user, onSignOut, onNavigate }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) {
    return (
      <button
        onClick={() => onNavigate('signin')}
        style={{
          padding: '8px 18px',
          background: 'linear-gradient(135deg, #6366f1, #a855f7)',
          border: 'none',
          borderRadius: '10px',
          color: '#fff',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'opacity 0.2s',
        }}
      >
        Sign In
      </button>
    );
  }

  const initial = (user.displayName || user.email || '?')[0].toUpperCase();

  const styles: Record<string, React.CSSProperties> = {
    wrapper: {
      position: 'relative',
    },
    avatar: {
      width: '36px',
      height: '36px',
      borderRadius: '50%',
      border: '2px solid rgba(99,102,241,0.5)',
      cursor: 'pointer',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #6366f1, #a855f7)',
      color: '#fff',
      fontSize: '15px',
      fontWeight: 700,
      transition: 'border-color 0.2s',
      flexShrink: 0,
    },
    avatarImg: {
      width: '100%',
      height: '100%',
      objectFit: 'cover' as const,
    },
    dropdown: {
      position: 'absolute',
      top: 'calc(100% + 8px)',
      right: 0,
      width: '240px',
      background: 'rgba(22,33,62,0.95)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '14px',
      padding: '8px',
      boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
      zIndex: 1000,
    },
    userInfo: {
      padding: '12px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      marginBottom: '4px',
    },
    userName: {
      fontSize: '14px',
      fontWeight: 600,
      color: '#e5e5e5',
      margin: 0,
      whiteSpace: 'nowrap' as const,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    userEmail: {
      fontSize: '12px',
      color: 'rgba(255,255,255,0.4)',
      margin: '2px 0 0 0',
      whiteSpace: 'nowrap' as const,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    menuItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      width: '100%',
      padding: '10px 12px',
      background: 'none',
      border: 'none',
      borderRadius: '10px',
      color: '#c5c5d5',
      fontSize: '13px',
      cursor: 'pointer',
      transition: 'background 0.15s',
      textAlign: 'left' as const,
    },
    signOutItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      width: '100%',
      padding: '10px 12px',
      background: 'none',
      border: 'none',
      borderRadius: '10px',
      color: '#f87171',
      fontSize: '13px',
      cursor: 'pointer',
      transition: 'background 0.15s',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      marginTop: '4px',
      textAlign: 'left' as const,
    },
  };

  return (
    <div style={styles.wrapper} ref={menuRef}>
      <div style={styles.avatar} onClick={() => setOpen(!open)}>
        {user.photoURL ? (
          <img src={user.photoURL} alt="" style={styles.avatarImg} referrerPolicy="no-referrer" />
        ) : (
          initial
        )}
      </div>

      {open && (
        <div style={styles.dropdown}>
          <div style={styles.userInfo}>
            <p style={styles.userName}>{user.displayName || 'User'}</p>
            <p style={styles.userEmail}>{user.email}</p>
          </div>

          <button
            style={styles.menuItem}
            onClick={() => { onNavigate('catalog'); setOpen(false); }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          >
            <History size={16} />
            My History
          </button>

          <button
            style={styles.menuItem}
            onClick={() => { onNavigate('settings'); setOpen(false); }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          >
            <Settings size={16} />
            Settings
          </button>

          <button
            style={styles.signOutItem}
            onClick={() => { onSignOut(); setOpen(false); }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
