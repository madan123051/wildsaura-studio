import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface AuthProps {
  onSkip: () => void;
}

export default function Auth({ onSkip }: AuthProps) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password, displayName);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message.replace('Firebase: ', '').replace(/\(auth\/.*\)/, '').trim());
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message.replace('Firebase: ', '').replace(/\(auth\/.*\)/, '').trim());
    } finally {
      setLoading(false);
    }
  };

  const styles: Record<string, React.CSSProperties> = {
    container: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)',
      padding: '20px',
    },
    card: {
      width: '100%',
      maxWidth: '420px',
      background: 'rgba(255,255,255,0.03)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '20px',
      padding: '40px',
      boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
    },
    logoContainer: {
      textAlign: 'center' as const,
      marginBottom: '32px',
    },
    logoIcon: {
      width: '56px',
      height: '56px',
      borderRadius: '16px',
      background: 'linear-gradient(135deg, #6366f1, #a855f7)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '12px',
      fontSize: '28px',
    },
    logoText: {
      fontSize: '24px',
      fontWeight: 700,
      color: '#ffffff',
      margin: 0,
      letterSpacing: '-0.5px',
    },
    logoSub: {
      fontSize: '13px',
      color: 'rgba(255,255,255,0.4)',
      marginTop: '4px',
    },
    tabs: {
      display: 'flex',
      background: 'rgba(255,255,255,0.04)',
      borderRadius: '12px',
      padding: '4px',
      marginBottom: '24px',
    },
    tab: {
      flex: 1,
      padding: '10px',
      border: 'none',
      borderRadius: '10px',
      fontSize: '14px',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.2s',
      color: 'rgba(255,255,255,0.5)',
      background: 'transparent',
    },
    tabActive: {
      flex: 1,
      padding: '10px',
      border: 'none',
      borderRadius: '10px',
      fontSize: '14px',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.2s',
      color: '#ffffff',
      background: 'rgba(99,102,241,0.3)',
    },
    form: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '14px',
    },
    input: {
      width: '100%',
      padding: '12px 16px',
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '12px',
      color: '#e5e5e5',
      fontSize: '14px',
      outline: 'none',
      transition: 'border-color 0.2s',
      boxSizing: 'border-box' as const,
    },
    submitBtn: {
      width: '100%',
      padding: '12px',
      background: 'linear-gradient(135deg, #6366f1, #a855f7)',
      border: 'none',
      borderRadius: '12px',
      color: '#ffffff',
      fontSize: '15px',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'opacity 0.2s',
      opacity: loading ? 0.7 : 1,
    },
    divider: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      margin: '4px 0',
    },
    dividerLine: {
      flex: 1,
      height: '1px',
      background: 'rgba(255,255,255,0.08)',
    },
    dividerText: {
      fontSize: '12px',
      color: 'rgba(255,255,255,0.3)',
      textTransform: 'uppercase' as const,
      letterSpacing: '1px',
    },
    googleBtn: {
      width: '100%',
      padding: '12px',
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '12px',
      color: '#e5e5e5',
      fontSize: '14px',
      fontWeight: 500,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px',
      transition: 'background 0.2s',
    },
    error: {
      padding: '10px 14px',
      background: 'rgba(239,68,68,0.12)',
      border: '1px solid rgba(239,68,68,0.25)',
      borderRadius: '10px',
      color: '#fca5a5',
      fontSize: '13px',
    },
    skipLink: {
      textAlign: 'center' as const,
      marginTop: '20px',
    },
    skipBtn: {
      background: 'none',
      border: 'none',
      color: 'rgba(255,255,255,0.35)',
      fontSize: '13px',
      cursor: 'pointer',
      textDecoration: 'underline',
      padding: 0,
    },
  };

  const GoogleIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoContainer}>
          <div style={styles.logoIcon}>🌿</div>
          <h1 style={styles.logoText}>WildSaura Studio</h1>
          <div style={styles.logoSub}>Professional Image Processing</div>
        </div>

        {/* Tabs */}
        <div style={styles.tabs}>
          <button
            style={!isSignUp ? styles.tabActive : styles.tab}
            onClick={() => { setIsSignUp(false); setError(''); }}
          >
            Sign In
          </button>
          <button
            style={isSignUp ? styles.tabActive : styles.tab}
            onClick={() => { setIsSignUp(true); setError(''); }}
          >
            Sign Up
          </button>
        </div>

        {/* Error */}
        {error && <div style={styles.error}>{error}</div>}

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          {isSignUp && (
            <input
              type="text"
              placeholder="Full Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={styles.input}
              required
            />
          )}
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            required
            minLength={6}
          />
          <button type="submit" style={styles.submitBtn} disabled={loading}>
            {loading ? '...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        {/* Divider */}
        <div style={styles.divider}>
          <div style={styles.dividerLine} />
          <span style={styles.dividerText}>or</span>
          <div style={styles.dividerLine} />
        </div>

        {/* Google */}
        <button style={styles.googleBtn} onClick={handleGoogle} disabled={loading}>
          <GoogleIcon />
          Sign in with Google
        </button>

        {/* Skip */}
        <div style={styles.skipLink}>
          <button style={styles.skipBtn} onClick={onSkip}>
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
}
