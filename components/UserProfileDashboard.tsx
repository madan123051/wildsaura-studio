// ============================================================
// WildSaura Pro Studio — User Profile Dashboard
// Full profile page with:
//  • Profile header + identity verification badge
//  • Stats overview
//  • Edit History (24h saves + conversions)
//  • My LUTs (cloud-persisted .cube files)
//  • Settings (display name, etc.)
// ============================================================

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { User, updateProfile } from 'firebase/auth';
import {
  Camera, Shield, ShieldCheck, ShieldAlert,
  Image, HardDrive, Layers, Clock,
  Download, Trash2, Upload, Search,
  User as UserIcon, Settings, History, ChevronRight,
  FolderOpen, Cloud, CheckCircle, AlertCircle, Loader,
} from 'lucide-react';

import { getUserConversions, getUserStats, deleteConversion, ConversionRecord } from '../lib/database';
import { getUserEdits, deleteEdit, getTimeRemaining, cleanupExpiredEdits, EditRecord } from '../lib/editHistory';
import { getUserLuts, saveUserLut, deleteUserLut, fetchLutText, UserLUTRecord } from '../lib/userLuts';
import { isIdentityVerified, IDENTITY_VERIFY_URL } from '../lib/identityGuard';
import { parseCubeFile } from './LUTPanel';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LoadableLUT {
  id: string;
  name: string;
  data: Float32Array;
  size: number;
  isCustom: true;
}

interface UserProfileDashboardProps {
  user: User;
  onClose: () => void;
  /** Called when user loads a LUT into the editor */
  onLoadLut?: (lut: LoadableLUT) => void;
}

type ActiveTab = 'history' | 'luts' | 'settings';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function UserProfileDashboard({
  user,
  onClose,
  onLoadLut,
}: UserProfileDashboardProps) {
  const [tab, setTab] = useState<ActiveTab>('history');

  // data states
  const [conversions, setConversions] = useState<ConversionRecord[]>([]);
  const [savedEdits, setSavedEdits] = useState<EditRecord[]>([]);
  const [userLuts, setUserLuts] = useState<UserLUTRecord[]>([]);
  const [stats, setStats] = useState({ totalImages: 0, totalSaved: 0 });
  const [verified, setVerified] = useState<boolean | null>(null);

  // ui states
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(user.displayName || '');
  const [savingName, setSavingName] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [lutUploading, setLutUploading] = useState(false);
  const [lutError, setLutError] = useState('');
  const [loadingLutId, setLoadingLutId] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const lutFileRef = useRef<HTMLInputElement>(null);

  // ── Load data ──────────────────────────────────────────────────────────────

  useEffect(() => {
    loadAll();
  }, [user.uid]);

  // Countdown refresh every minute for 24h edits
  useEffect(() => {
    if (!savedEdits.length) return;
    const iv = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(iv);
  }, [savedEdits.length]);

  const loadAll = async () => {
    setLoading(true);
    try {
      await cleanupExpiredEdits(user.uid);
      const [convs, st, edits, luts, verif] = await Promise.all([
        getUserConversions(user.uid),
        getUserStats(user.uid),
        getUserEdits(user.uid),
        getUserLuts(user.uid),
        isIdentityVerified(user.uid),
      ]);
      setConversions(convs);
      setStats(st);
      setSavedEdits(edits.filter((e) => e.expiresAt > Date.now()));
      setUserLuts(luts);
      setVerified(verif);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleDeleteConversion = useCallback(async (id: string) => {
    await deleteConversion(user.uid, id);
    setConversions((prev) => prev.filter((r) => r.id !== id));
    setStats((prev) => ({ ...prev, totalImages: Math.max(0, prev.totalImages - 1) }));
  }, [user.uid]);

  const handleDeleteEdit = useCallback(async (edit: EditRecord) => {
    await deleteEdit(user.uid, edit);
    setSavedEdits((prev) => prev.filter((e) => e.id !== edit.id));
  }, [user.uid]);

  const handleLutUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (lutFileRef.current) lutFileRef.current.value = '';
    setLutError('');
    setLutUploading(true);
    try {
      const text = await file.text();
      const parsed = parseCubeFile(text);
      if (!parsed) {
        setLutError('Invalid .cube file — could not parse LUT data.');
        return;
      }
      const record = await saveUserLut(user.uid, file, parsed.name || file.name.replace('.cube', ''), parsed.size);
      setUserLuts((prev) => [record, ...prev]);
    } catch (err) {
      console.error('LUT upload failed:', err);
      setLutError('Upload failed. Please try again.');
    } finally {
      setLutUploading(false);
    }
  }, [user.uid]);

  const handleDeleteLut = useCallback(async (lut: UserLUTRecord) => {
    await deleteUserLut(user.uid, lut);
    setUserLuts((prev) => prev.filter((l) => l.id !== lut.id));
  }, [user.uid]);

  const handleLoadLut = useCallback(async (lut: UserLUTRecord) => {
    if (!onLoadLut) return;
    setLoadingLutId(lut.id!);
    try {
      const text = await fetchLutText(lut.downloadUrl);
      const parsed = parseCubeFile(text);
      if (!parsed) throw new Error('Parse failed');
      onLoadLut({
        id: `cloud_${lut.id}`,
        name: lut.name,
        data: parsed.data,
        size: parsed.size,
        isCustom: true,
      });
      onClose();
    } catch (err) {
      console.error('Failed to load LUT:', err);
    } finally {
      setLoadingLutId(null);
    }
  }, [onLoadLut, onClose]);

  const handleSaveName = async () => {
    if (!newName.trim() || newName === user.displayName) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      await updateProfile(user, { displayName: newName.trim() });
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 3000);
      setEditingName(false);
    } catch (err) {
      console.error('Failed to update name:', err);
    } finally {
      setSavingName(false);
    }
  };

  // ── Filtered records ───────────────────────────────────────────────────────

  const filteredConversions = conversions.filter((r) =>
    r.fileName.toLowerCase().includes(search.toLowerCase())
  );

  // ── Styles ─────────────────────────────────────────────────────────────────

  const s: Record<string, React.CSSProperties> = {
    overlay: {
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.65)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      zIndex: 2000,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '32px 16px',
      overflowY: 'auto',
    },
    panel: {
      width: '100%',
      maxWidth: '820px',
      background: 'rgba(13,13,26,0.98)',
      backdropFilter: 'blur(30px)',
      WebkitBackdropFilter: 'blur(30px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '20px',
      overflow: 'hidden',
      boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
    },

    // ── Profile header
    profileHeader: {
      background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(168,85,247,0.1) 100%)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      padding: '28px 32px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '20px',
    },
    avatar: {
      width: '72px',
      height: '72px',
      borderRadius: '50%',
      border: '3px solid rgba(99,102,241,0.5)',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #6366f1, #a855f7)',
      color: '#fff',
      fontSize: '28px',
      fontWeight: 700,
      flexShrink: 0,
    },
    avatarImg: { width: '100%', height: '100%', objectFit: 'cover' as const },
    profileInfo: { flex: 1, minWidth: 0 },
    profileName: {
      fontSize: '22px', fontWeight: 700, color: '#ffffff',
      margin: '0 0 4px 0',
    },
    profileEmail: {
      fontSize: '13px', color: 'rgba(255,255,255,0.45)',
      margin: '0 0 12px 0',
    },
    verifiedBadge: {
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '5px 12px',
      borderRadius: '20px',
      fontSize: '12px', fontWeight: 600,
      cursor: 'pointer',
    },
    closeBtn: {
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '10px',
      color: 'rgba(255,255,255,0.6)',
      width: '36px', height: '36px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', flexShrink: 0, fontSize: '20px',
      transition: 'all 0.2s',
    },

    // ── Stats
    statsRow: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '1px',
      background: 'rgba(255,255,255,0.04)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    },
    statCell: {
      padding: '16px 20px',
      background: 'rgba(13,13,26,0.98)',
      display: 'flex', alignItems: 'center', gap: '12px',
    },
    statIcon: {
      width: '36px', height: '36px', borderRadius: '10px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    },
    statVal: { fontSize: '18px', fontWeight: 700, color: '#e5e5e5', margin: 0 },
    statLbl: { fontSize: '11px', color: 'rgba(255,255,255,0.35)', margin: 0 },

    // ── Tabs
    tabs: {
      display: 'flex',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      padding: '0 24px',
      gap: '4px',
    },
    tabBtn: {
      display: 'flex', alignItems: 'center', gap: '7px',
      padding: '14px 16px',
      border: 'none', background: 'none',
      color: 'rgba(255,255,255,0.4)',
      fontSize: '13px', fontWeight: 600,
      cursor: 'pointer', borderBottom: '2px solid transparent',
      transition: 'all 0.2s',
    },
    tabBtnActive: {
      display: 'flex', alignItems: 'center', gap: '7px',
      padding: '14px 16px',
      border: 'none', background: 'none',
      color: '#a78bfa',
      fontSize: '13px', fontWeight: 600,
      cursor: 'pointer', borderBottom: '2px solid #a78bfa',
      transition: 'all 0.2s',
    },

    // ── Content area
    content: { padding: '24px', minHeight: '400px' },

    // ── Cards
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
      gap: '14px',
    },
    card: {
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '12px',
      overflow: 'hidden',
      transition: 'border-color 0.2s',
      position: 'relative',
    },
    thumb: {
      width: '100%', height: '130px',
      background: 'rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    },
    thumbImg: { width: '100%', height: '100%', objectFit: 'cover' as const },
    cardBody: { padding: '12px 14px' },
    cardName: {
      fontSize: '13px', fontWeight: 600, color: '#e5e5e5',
      margin: '0 0 4px 0', whiteSpace: 'nowrap' as const,
      overflow: 'hidden', textOverflow: 'ellipsis',
    },
    cardMeta: { fontSize: '11px', color: 'rgba(255,255,255,0.35)', margin: 0 },
    cardActions: { display: 'flex', gap: '6px', marginTop: '10px' },
    btnPrimary: {
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
      padding: '7px 0', borderRadius: '8px',
      background: 'rgba(99,102,241,0.2)',
      border: '1px solid rgba(99,102,241,0.3)',
      color: '#a78bfa', fontSize: '11px', fontWeight: 600,
      cursor: 'pointer', transition: 'all 0.15s',
    },
    btnDanger: {
      width: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '7px', borderRadius: '8px',
      background: 'rgba(239,68,68,0.1)',
      border: '1px solid rgba(239,68,68,0.2)',
      color: '#f87171', cursor: 'pointer', transition: 'all 0.15s',
    },
    btnDownload: {
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
      padding: '7px 0', borderRadius: '8px',
      background: 'rgba(245,158,11,0.15)',
      border: '1px solid rgba(245,158,11,0.25)',
      color: '#f59e0b', fontSize: '11px', fontWeight: 600,
      cursor: 'pointer', transition: 'all 0.15s',
    },

    // Saved-badge
    savedBadge: {
      fontSize: '11px', fontWeight: 700, color: '#34d399',
      background: 'rgba(52,211,153,0.1)',
      padding: '3px 7px', borderRadius: '5px',
    },

    // LUT upload area
    lutUploadArea: {
      border: '2px dashed rgba(99,102,241,0.3)',
      borderRadius: '14px',
      padding: '32px',
      textAlign: 'center' as const,
      cursor: 'pointer',
      transition: 'all 0.2s',
      marginBottom: '20px',
    },

    // Empty state
    empty: {
      textAlign: 'center' as const, padding: '60px 20px',
      color: 'rgba(255,255,255,0.25)', fontSize: '14px',
    },

    // Section heading
    sectionHead: {
      display: 'flex', alignItems: 'center', gap: '8px',
      marginBottom: '12px', marginTop: '4px',
    },
    sectionTitle: {
      fontSize: '13px', fontWeight: 700, color: '#e5e5e5', margin: 0,
    },
    badge: {
      fontSize: '10px', fontWeight: 600,
      background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
      padding: '2px 8px', borderRadius: '10px',
    },

    // Settings
    settingRow: {
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '14px',
      padding: '20px',
      marginBottom: '14px',
    },
    settingLabel: {
      fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.45)',
      textTransform: 'uppercase' as const, letterSpacing: '0.8px',
      margin: '0 0 10px 0',
    },
    input: {
      width: '100%', padding: '11px 14px',
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '10px', color: '#e5e5e5', fontSize: '14px',
      outline: 'none', boxSizing: 'border-box' as const,
    },
    btnSave: {
      marginTop: '12px', padding: '10px 20px',
      background: 'linear-gradient(135deg, #6366f1, #a855f7)',
      border: 'none', borderRadius: '10px',
      color: '#fff', fontSize: '13px', fontWeight: 600,
      cursor: 'pointer', transition: 'opacity 0.2s',
    },

    // Search
    searchWrap: {
      position: 'relative' as const,
      marginBottom: '16px',
    },
    searchIcon: {
      position: 'absolute' as const, left: '12px', top: '50%',
      transform: 'translateY(-50%)',
      color: 'rgba(255,255,255,0.25)', pointerEvents: 'none' as const,
    },
    searchInput: {
      width: '100%', padding: '10px 14px 10px 38px',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '10px', color: '#e5e5e5', fontSize: '13px',
      outline: 'none', boxSizing: 'border-box' as const,
    },
  };

  // ── Render helpers ──────────────────────────────────────────────────────────

  const initial = (user.displayName || user.email || '?')[0].toUpperCase();

  const verifiedBadgeStyle: React.CSSProperties = {
    ...s.verifiedBadge,
    ...(verified === true
      ? { background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }
      : verified === false
        ? { background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }
        : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.08)' }),
  };

  const handleVerifyClick = () => {
    if (verified === false) {
      const returnUrl = encodeURIComponent(window.location.href);
      window.open(`${IDENTITY_VERIFY_URL}/verify?return=${returnUrl}`, '_blank');
    }
  };

  // ── History Tab ─────────────────────────────────────────────────────────────

  const HistoryTab = () => (
    <div>
      {/* 24-hour saved edits */}
      {savedEdits.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={s.sectionHead}>
            <Cloud size={14} color="#f59e0b" />
            <h3 style={s.sectionTitle}>Saved Edits</h3>
            <span style={s.badge}>Auto-delete after 24h</span>
          </div>
          <div style={s.grid}>
            {savedEdits.map((edit) => (
              <div
                key={edit.id}
                style={{
                  ...s.card,
                  background: 'rgba(245,158,11,0.04)',
                  border: '1px solid rgba(245,158,11,0.15)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(245,158,11,0.4)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(245,158,11,0.15)')}
              >
                <div style={s.thumb}>
                  <img src={edit.downloadUrl} alt={edit.fileName} style={s.thumbImg}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
                {/* Countdown badge */}
                <div style={{
                  position: 'absolute', top: 8, right: 8,
                  display: 'flex', alignItems: 'center', gap: '4px',
                  padding: '3px 8px', borderRadius: '8px',
                  background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
                  fontSize: '10px', fontWeight: 600, color: '#f59e0b',
                }}>
                  <Clock size={10} />
                  {getTimeRemaining(edit.expiresAt)}
                </div>
                <div style={s.cardBody}>
                  <p style={s.cardName}>{edit.fileName}</p>
                  <p style={s.cardMeta}>{edit.width}×{edit.height} · {formatBytes(edit.fileSize)}</p>
                  <div style={s.cardActions}>
                    <button style={s.btnDownload}
                      onClick={() => { const a = document.createElement('a'); a.href = edit.downloadUrl; a.download = edit.fileName; a.click(); }}>
                      <Download size={11} /> Download
                    </button>
                    <button style={s.btnDanger} onClick={() => handleDeleteEdit(edit)}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conversion history */}
      <div style={s.sectionHead}>
        <History size={14} color="#6366f1" />
        <h3 style={s.sectionTitle}>Processed Images</h3>
        <span style={{
          fontSize: '10px', fontWeight: 600,
          background: 'rgba(99,102,241,0.12)', color: '#818cf8',
          padding: '2px 8px', borderRadius: '10px',
        }}>{conversions.length} total</span>
      </div>

      <div style={s.searchWrap}>
        <div style={s.searchIcon}><Search size={14} /></div>
        <input
          style={s.searchInput}
          placeholder="Search by filename…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filteredConversions.length === 0 ? (
        <div style={s.empty}>
          <FolderOpen size={48} style={{ opacity: 0.2, marginBottom: '12px', display: 'block', margin: '0 auto 12px' }} />
          {search ? 'No matching images' : 'No processed images yet'}
        </div>
      ) : (
        <div style={s.grid}>
          {filteredConversions.map((rec) => (
            <div
              key={rec.id}
              style={s.card}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)';
                const del = e.currentTarget.querySelector('[data-del]') as HTMLElement;
                if (del) del.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                const del = e.currentTarget.querySelector('[data-del]') as HTMLElement;
                if (del) del.style.opacity = '0';
              }}
            >
              <div style={s.thumb}>
                {rec.thumbnailUrl
                  ? <img src={rec.thumbnailUrl} alt="" style={s.thumbImg} />
                  : <Image size={36} color="rgba(255,255,255,0.1)" />}
              </div>
              <button data-del style={{
                position: 'absolute', top: 8, right: 8,
                width: '28px', height: '28px', borderRadius: '7px',
                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                border: 'none', color: '#f87171', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: 0, transition: 'opacity 0.2s',
              }} onClick={() => rec.id && handleDeleteConversion(rec.id)}>
                <Trash2 size={12} />
              </button>
              <div style={s.cardBody}>
                <p style={s.cardName}>{rec.fileName}</p>
                <p style={{ ...s.cardMeta, marginBottom: '8px' }}>{formatDate(rec.createdAt)}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                    {formatBytes(rec.originalSize)} → {formatBytes(rec.processedSize)}
                  </span>
                  <span style={s.savedBadge}>-{rec.savedPercentage}%</span>
                </div>
                {rec.preset && rec.preset !== 'none' && (
                  <span style={{
                    display: 'inline-block', marginTop: '6px',
                    fontSize: '10px', color: 'rgba(168,85,247,0.9)',
                    background: 'rgba(168,85,247,0.1)',
                    padding: '2px 7px', borderRadius: '5px',
                  }}>{rec.preset}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── My LUTs Tab ─────────────────────────────────────────────────────────────

  const LutsTab = () => (
    <div>
      {/* Upload area */}
      <div
        style={s.lutUploadArea}
        onClick={() => !lutUploading && lutFileRef.current?.click()}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(99,102,241,0.6)';
          (e.currentTarget as HTMLDivElement).style.background = 'rgba(99,102,241,0.04)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(99,102,241,0.3)';
          (e.currentTarget as HTMLDivElement).style.background = 'transparent';
        }}
      >
        <input ref={lutFileRef} type="file" accept=".cube" style={{ display: 'none' }} onChange={handleLutUpload} />
        {lutUploading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
            <Loader size={20} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ color: '#a78bfa', fontSize: '14px', fontWeight: 600 }}>Uploading LUT to cloud…</span>
          </div>
        ) : (
          <>
            <Upload size={28} color="rgba(99,102,241,0.6)" style={{ marginBottom: '10px' }} />
            <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 600, color: '#a78bfa' }}>
              Upload Custom LUT
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
              Drop a .cube file here or click to browse
            </p>
          </>
        )}
      </div>

      {lutError && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 14px', borderRadius: '10px', marginBottom: '16px',
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
          color: '#fca5a5', fontSize: '13px',
        }}>
          <AlertCircle size={14} /> {lutError}
        </div>
      )}

      {userLuts.length === 0 ? (
        <div style={s.empty}>
          <Layers size={48} style={{ opacity: 0.2, marginBottom: '12px', display: 'block', margin: '0 auto 12px' }} />
          No LUTs saved yet — upload your first .cube file above
        </div>
      ) : (
        <>
          <div style={s.sectionHead}>
            <Layers size={14} color="#a78bfa" />
            <h3 style={s.sectionTitle}>My LUTs</h3>
            <span style={{
              fontSize: '10px', fontWeight: 600,
              background: 'rgba(168,85,247,0.12)', color: '#a78bfa',
              padding: '2px 8px', borderRadius: '10px',
            }}>{userLuts.length} saved</span>
          </div>
          <div style={s.grid}>
            {userLuts.map((lut) => (
              <div
                key={lut.id}
                style={s.card}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(168,85,247,0.35)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}
              >
                {/* LUT preview circle */}
                <div style={{
                  ...s.thumb, height: '90px',
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.15))',
                  flexDirection: 'column' as const, gap: '4px',
                }}>
                  <Layers size={28} color="rgba(168,85,247,0.6)" />
                  <span style={{ fontSize: '10px', color: 'rgba(168,85,247,0.7)', fontWeight: 700 }}>
                    {lut.lutSize}³ LUT
                  </span>
                </div>
                <div style={s.cardBody}>
                  <p style={s.cardName}>{lut.name}</p>
                  <p style={s.cardMeta}>{formatBytes(lut.fileSize)} · {formatDate(lut.createdAt)}</p>
                  <div style={s.cardActions}>
                    {onLoadLut && (
                      <button
                        style={{ ...s.btnPrimary, opacity: loadingLutId === lut.id ? 0.6 : 1 }}
                        onClick={() => handleLoadLut(lut)}
                        disabled={loadingLutId === lut.id}
                      >
                        {loadingLutId === lut.id
                          ? <Loader size={11} style={{ animation: 'spin 1s linear infinite' }} />
                          : <ChevronRight size={11} />}
                        Load in Editor
                      </button>
                    )}
                    <button style={s.btnDanger} onClick={() => handleDeleteLut(lut)}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  // ── Settings Tab ────────────────────────────────────────────────────────────

  const SettingsTab = () => (
    <div>
      {/* Display name */}
      <div style={s.settingRow}>
        <p style={s.settingLabel}>Display Name</p>
        {editingName ? (
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              style={s.input}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
              autoFocus
            />
            <button style={s.btnSave} onClick={handleSaveName} disabled={savingName}>
              {savingName ? '…' : 'Save'}
            </button>
            <button
              style={{ ...s.btnSave, background: 'rgba(255,255,255,0.08)' }}
              onClick={() => { setEditingName(false); setNewName(user.displayName || ''); }}
            >Cancel</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '15px', fontWeight: 600, color: '#e5e5e5' }}>
              {user.displayName || 'Not set'}
            </span>
            <button
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px', padding: '7px 14px',
                color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer',
              }}
              onClick={() => setEditingName(true)}
            >Edit</button>
          </div>
        )}
        {nameSuccess && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            color: '#34d399', fontSize: '12px', marginTop: '8px',
          }}>
            <CheckCircle size={13} /> Display name updated!
          </div>
        )}
      </div>

      {/* Email (read-only) */}
      <div style={s.settingRow}>
        <p style={s.settingLabel}>Email</p>
        <span style={{ fontSize: '15px', fontWeight: 600, color: '#e5e5e5' }}>{user.email}</span>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)', margin: '6px 0 0' }}>
          Email is managed by your authentication provider.
        </p>
      </div>

      {/* Identity verification */}
      <div style={s.settingRow}>
        <p style={s.settingLabel}>Identity Verification</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {verified === true
              ? <ShieldCheck size={20} color="#34d399" />
              : verified === false
                ? <ShieldAlert size={20} color="#fbbf24" />
                : <Shield size={20} color="rgba(255,255,255,0.3)" />}
            <div>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#e5e5e5' }}>
                {verified === true ? 'Verified' : verified === false ? 'Not Verified' : 'Checking…'}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
                {verified === true
                  ? 'Your identity has been confirmed via WildSaura Identity'
                  : 'Required to access full Studio features'}
              </p>
            </div>
          </div>
          {verified === false && (
            <button
              style={{ ...s.btnSave, background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
              onClick={handleVerifyClick}
            >
              Verify Now
            </button>
          )}
        </div>
      </div>

      {/* Account UID (dev info) */}
      <div style={s.settingRow}>
        <p style={s.settingLabel}>Account ID</p>
        <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.35)', userSelect: 'all' as const }}>
          {user.uid}
        </span>
      </div>
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={s.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={s.panel}>

        {/* ── Profile Header */}
        <div style={s.profileHeader}>
          <div style={s.avatar}>
            {user.photoURL
              ? <img src={user.photoURL} alt="" style={s.avatarImg} referrerPolicy="no-referrer" />
              : initial}
          </div>
          <div style={s.profileInfo}>
            <h2 style={s.profileName}>{user.displayName || 'User'}</h2>
            <p style={s.profileEmail}>{user.email}</p>
            <div
              style={verifiedBadgeStyle}
              onClick={handleVerifyClick}
              title={verified === false ? 'Click to verify your identity' : undefined}
            >
              {verified === true
                ? <><ShieldCheck size={13} /> Identity Verified</>
                : verified === false
                  ? <><ShieldAlert size={13} /> Not Verified — Click to verify</>
                  : <><Shield size={13} /> Checking verification…</>}
            </div>
          </div>
          <button style={s.closeBtn} onClick={onClose}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; }}
          >×</button>
        </div>

        {/* ── Stats Row */}
        <div style={s.statsRow}>
          {[
            { icon: <Image size={16} color="#6366f1" />, bg: 'rgba(99,102,241,0.15)', val: stats.totalImages, lbl: 'Images Processed' },
            { icon: <HardDrive size={16} color="#34d399" />, bg: 'rgba(52,211,153,0.15)', val: formatBytes(stats.totalSaved), lbl: 'Storage Saved' },
            { icon: <Layers size={16} color="#a78bfa" />, bg: 'rgba(168,85,247,0.15)', val: userLuts.length, lbl: 'My LUTs' },
            { icon: <Clock size={16} color="#f59e0b" />, bg: 'rgba(245,158,11,0.15)', val: savedEdits.length, lbl: 'Saved Edits' },
          ].map(({ icon, bg, val, lbl }) => (
            <div key={lbl} style={s.statCell}>
              <div style={{ ...s.statIcon, background: bg }}>{icon}</div>
              <div>
                <p style={s.statVal}>{val}</p>
                <p style={s.statLbl}>{lbl}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Tabs */}
        <div style={s.tabs}>
          {([
            { id: 'history', icon: <History size={14} />, label: 'Edit History' },
            { id: 'luts',    icon: <Layers size={14} />,  label: 'My LUTs' },
            { id: 'settings', icon: <Settings size={14} />, label: 'Settings' },
          ] as { id: ActiveTab; icon: React.ReactNode; label: string }[]).map(({ id, icon, label }) => (
            <button
              key={id}
              style={tab === id ? s.tabBtnActive : s.tabBtn}
              onClick={() => setTab(id)}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* ── Content */}
        <div style={s.content}>
          {loading ? (
            <div style={{ ...s.empty, display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
              <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> Loading your profile…
            </div>
          ) : tab === 'history' ? (
            <HistoryTab />
          ) : tab === 'luts' ? (
            <LutsTab />
          ) : (
            <SettingsTab />
          )}
        </div>

      </div>

      {/* CSS animation for spinner */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
