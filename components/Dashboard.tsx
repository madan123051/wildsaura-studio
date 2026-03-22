import React, { useEffect, useState } from 'react';
import { getUserConversions, getUserStats, deleteConversion, ConversionRecord } from '../lib/database';
import { Search, Trash2, Image, HardDrive, FolderOpen } from 'lucide-react';

interface DashboardProps {
  userId: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Dashboard({ userId }: DashboardProps) {
  const [records, setRecords] = useState<ConversionRecord[]>([]);
  const [stats, setStats] = useState({ totalImages: 0, totalSaved: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [userId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [conversions, userStats] = await Promise.all([
        getUserConversions(userId),
        getUserStats(userId),
      ]);
      setRecords(conversions);
      setStats(userStats);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (conversionId: string) => {
    try {
      await deleteConversion(userId, conversionId);
      setRecords((prev) => prev.filter((r) => r.id !== conversionId));
      setStats((prev) => ({
        totalImages: prev.totalImages - 1,
        totalSaved: Math.max(0, prev.totalSaved - (records.find(r => r.id === conversionId)?.originalSize ?? 0) + (records.find(r => r.id === conversionId)?.processedSize ?? 0)),
      }));
    } catch (err) {
      console.error('Failed to delete conversion:', err);
    }
  };

  const filteredRecords = records.filter((r) =>
    r.fileName.toLowerCase().includes(search.toLowerCase())
  );

  const styles: Record<string, React.CSSProperties> = {
    container: {
      padding: '24px',
      maxWidth: '1200px',
      margin: '0 auto',
    },
    header: {
      marginBottom: '24px',
    },
    title: {
      fontSize: '22px',
      fontWeight: 700,
      color: '#e5e5e5',
      margin: '0 0 16px 0',
    },
    statsBar: {
      display: 'flex',
      gap: '16px',
      marginBottom: '20px',
    },
    statCard: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '16px 20px',
      background: 'rgba(255,255,255,0.03)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '14px',
    },
    statIcon: {
      width: '40px',
      height: '40px',
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    statValue: {
      fontSize: '20px',
      fontWeight: 700,
      color: '#e5e5e5',
      margin: 0,
    },
    statLabel: {
      fontSize: '12px',
      color: 'rgba(255,255,255,0.4)',
      margin: 0,
    },
    searchContainer: {
      position: 'relative',
      marginBottom: '20px',
    },
    searchIcon: {
      position: 'absolute',
      left: '14px',
      top: '50%',
      transform: 'translateY(-50%)',
      color: 'rgba(255,255,255,0.3)',
      pointerEvents: 'none',
    },
    searchInput: {
      width: '100%',
      padding: '12px 16px 12px 42px',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '12px',
      color: '#e5e5e5',
      fontSize: '14px',
      outline: 'none',
      boxSizing: 'border-box' as const,
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: '16px',
    },
    card: {
      background: 'rgba(255,255,255,0.03)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '14px',
      overflow: 'hidden',
      transition: 'border-color 0.2s, transform 0.2s',
      cursor: 'default',
      position: 'relative',
    },
    cardThumb: {
      width: '100%',
      height: '160px',
      background: 'rgba(255,255,255,0.02)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    thumbImg: {
      width: '100%',
      height: '100%',
      objectFit: 'cover' as const,
    },
    thumbPlaceholder: {
      color: 'rgba(255,255,255,0.15)',
    },
    cardBody: {
      padding: '14px 16px',
    },
    cardFileName: {
      fontSize: '14px',
      fontWeight: 600,
      color: '#e5e5e5',
      margin: '0 0 6px 0',
      whiteSpace: 'nowrap' as const,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    cardDate: {
      fontSize: '11px',
      color: 'rgba(255,255,255,0.35)',
      margin: '0 0 10px 0',
    },
    cardMeta: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    cardSizes: {
      fontSize: '12px',
      color: 'rgba(255,255,255,0.5)',
    },
    cardSaved: {
      fontSize: '12px',
      fontWeight: 700,
      color: '#34d399',
      background: 'rgba(52,211,153,0.1)',
      padding: '3px 8px',
      borderRadius: '6px',
    },
    cardPreset: {
      fontSize: '11px',
      color: 'rgba(168,85,247,0.9)',
      background: 'rgba(168,85,247,0.1)',
      padding: '3px 8px',
      borderRadius: '6px',
      marginTop: '8px',
      display: 'inline-block',
    },
    deleteBtn: {
      position: 'absolute',
      top: '10px',
      right: '10px',
      width: '32px',
      height: '32px',
      borderRadius: '8px',
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(10px)',
      border: 'none',
      color: '#f87171',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: 0,
      transition: 'opacity 0.2s',
    },
    emptyState: {
      textAlign: 'center' as const,
      padding: '80px 20px',
    },
    emptyIcon: {
      color: 'rgba(255,255,255,0.1)',
      marginBottom: '16px',
    },
    emptyTitle: {
      fontSize: '18px',
      fontWeight: 600,
      color: 'rgba(255,255,255,0.5)',
      margin: '0 0 8px 0',
    },
    emptySub: {
      fontSize: '14px',
      color: 'rgba(255,255,255,0.25)',
      margin: 0,
    },
    loading: {
      textAlign: 'center' as const,
      padding: '60px 20px',
      color: 'rgba(255,255,255,0.4)',
      fontSize: '14px',
    },
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading your history...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>Catalog</h2>
      </div>

      {/* Stats */}
      <div style={styles.statsBar}>
        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, background: 'rgba(99,102,241,0.15)' }}>
            <Image size={20} color="#6366f1" />
          </div>
          <div>
            <p style={styles.statValue}>{stats.totalImages}</p>
            <p style={styles.statLabel}>Images Processed</p>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, background: 'rgba(52,211,153,0.15)' }}>
            <HardDrive size={20} color="#34d399" />
          </div>
          <div>
            <p style={styles.statValue}>{formatBytes(stats.totalSaved)}</p>
            <p style={styles.statLabel}>Total Saved</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={styles.searchContainer}>
        <div style={styles.searchIcon}>
          <Search size={16} />
        </div>
        <input
          type="text"
          placeholder="Search by file name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      {/* Grid or Empty */}
      {filteredRecords.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>
            <FolderOpen size={64} />
          </div>
          <h3 style={styles.emptyTitle}>
            {search ? 'No matching images' : 'No images yet'}
          </h3>
          <p style={styles.emptySub}>
            {search
              ? 'Try a different search term'
              : 'Your processed images will appear here'}
          </p>
        </div>
      ) : (
        <div style={styles.grid}>
          {filteredRecords.map((record) => (
            <div
              key={record.id}
              style={styles.card}
              onMouseEnter={(e) => {
                const del = e.currentTarget.querySelector('[data-delete]') as HTMLElement;
                if (del) del.style.opacity = '1';
                e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)';
              }}
              onMouseLeave={(e) => {
                const del = e.currentTarget.querySelector('[data-delete]') as HTMLElement;
                if (del) del.style.opacity = '0';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
              }}
            >
              {/* Thumbnail */}
              <div style={styles.cardThumb}>
                {record.thumbnailUrl ? (
                  <img src={record.thumbnailUrl} alt="" style={styles.thumbImg} />
                ) : (
                  <div style={styles.thumbPlaceholder}>
                    <Image size={40} />
                  </div>
                )}
              </div>

              {/* Delete */}
              <button
                data-delete
                style={styles.deleteBtn}
                onClick={() => record.id && handleDelete(record.id)}
              >
                <Trash2 size={14} />
              </button>

              {/* Body */}
              <div style={styles.cardBody}>
                <p style={styles.cardFileName}>{record.fileName}</p>
                <p style={styles.cardDate}>{formatDate(record.createdAt)}</p>
                <div style={styles.cardMeta}>
                  <span style={styles.cardSizes}>
                    {formatBytes(record.originalSize)} → {formatBytes(record.processedSize)}
                  </span>
                  <span style={styles.cardSaved}>
                    -{record.savedPercentage}%
                  </span>
                </div>
                {record.preset && record.preset !== 'none' && (
                  <span style={styles.cardPreset}>{record.preset}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
