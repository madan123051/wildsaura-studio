import React, { useState } from 'react';

export interface ConversionSettingsData {
  quality: number;
  resize4k: boolean;
  lossless: boolean;
  smartName: boolean;
  keepExif: boolean;
  autoConvert: boolean;
}

interface FileStats {
  total: number;
  done: number;
  pending: number;
  totalBefore: number;
  totalAfter: number;
}

interface ConversionSettingsProps {
  settings: ConversionSettingsData;
  onChange: (settings: ConversionSettingsData) => void;
  intensity: number;
  onIntensityChange: (v: number) => void;
  activeLut: string | null;
  onConvertAll: () => void;
  onDownloadZip: () => void;
  onReset: () => void;
  onClearAll: () => void;
  isProcessingAll: boolean;
  fileStats: FileStats;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
};

const ChevronIcon: React.FC<{ open: boolean }> = ({ open }) => (
  <svg
    width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const ToggleRow: React.FC<{
  label: string; checked: boolean; onChange: (v: boolean) => void; description?: string;
}> = ({ label, checked, onChange, description }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 0',
  }}>
    <div>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
      {description && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{description}</div>
      )}
    </div>
    <label className="toggle-switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-slider" />
    </label>
  </div>
);

const ConversionSettings: React.FC<ConversionSettingsProps> = ({
  settings,
  onChange,
  intensity,
  onIntensityChange,
  activeLut,
  onConvertAll,
  onDownloadZip,
  onReset,
  onClearAll,
  isProcessingAll,
  fileStats,
}) => {
  const [intensityOpen, setIntensityOpen] = useState(true);
  const [exportOpen, setExportOpen] = useState(true);
  const [actionsOpen, setActionsOpen] = useState(true);

  const update = (partial: Partial<ConversionSettingsData>) => {
    onChange({ ...settings, ...partial });
  };

  const savingsPercent = fileStats.totalBefore > 0 && fileStats.totalAfter > 0
    ? Math.round((1 - fileStats.totalAfter / fileStats.totalBefore) * 100)
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: 1.2, color: 'var(--text-muted)',
        }}>Edit Panel</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* ═══ Intensity Section (only when LUT active) ═══ */}
        {activeLut !== null && (
          <div style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="panel-header" onClick={() => setIntensityOpen(!intensityOpen)}>
              <h3>
                <span style={{ marginRight: 6 }}>🎨</span>
                Intensity
              </h3>
              <ChevronIcon open={intensityOpen} />
            </div>
            {intensityOpen && (
              <div style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="range"
                    min={0} max={100} value={intensity}
                    onChange={(e) => onIntensityChange(Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{
                    fontSize: 13, fontWeight: 700, color: 'var(--accent)',
                    minWidth: 38, textAlign: 'right',
                  }}>{intensity}%</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ Export Settings Section ═══ */}
        <div style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="panel-header" onClick={() => setExportOpen(!exportOpen)}>
            <h3>
              <span style={{ marginRight: 6 }}>⚙️</span>
              Export Settings
            </h3>
            <ChevronIcon open={exportOpen} />
          </div>
          {exportOpen && (
            <div style={{ padding: '8px 14px 14px' }}>
              {/* Quality slider */}
              <div style={{ marginBottom: 12 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 6,
                }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>Quality</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{settings.quality}%</span>
                </div>
                <input
                  type="range"
                  min={30} max={100} value={settings.quality}
                  onChange={(e) => update({ quality: Number(e.target.value) })}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Smaller</span>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Best</span>
                </div>
              </div>

              {/* Toggle options */}
              <ToggleRow label="4K Resize" checked={settings.resize4k} onChange={(v) => update({ resize4k: v })}
                description="Max 3840px wide" />
              <ToggleRow label="Lossless" checked={settings.lossless} onChange={(v) => update({ lossless: v })}
                description="WebP lossless mode" />
              <ToggleRow label="Smart Name" checked={settings.smartName} onChange={(v) => update({ smartName: v })}
                description="Add LUT name to filename" />
              <ToggleRow label="Keep EXIF" checked={settings.keepExif} onChange={(v) => update({ keepExif: v })}
                description="Preserve metadata" />
              <ToggleRow label="Auto Convert" checked={settings.autoConvert} onChange={(v) => update({ autoConvert: v })}
                description="Convert on file add" />
            </div>
          )}
        </div>

        {/* ═══ Actions Section ═══ */}
        <div style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="panel-header" onClick={() => setActionsOpen(!actionsOpen)}>
            <h3>
              <span style={{ marginRight: 6 }}>🚀</span>
              Actions
            </h3>
            <ChevronIcon open={actionsOpen} />
          </div>
          {actionsOpen && (
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Convert All */}
              <button
                className="btn-primary"
                onClick={onConvertAll}
                disabled={isProcessingAll || fileStats.total === 0}
                style={{
                  width: '100%', padding: '10px 14px',
                  fontSize: 12, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {isProcessingAll ? (
                  <>
                    <div className="animate-spin" style={{
                      width: 14, height: 14, borderRadius: '50%',
                      border: '2px solid transparent', borderTopColor: '#fff',
                    }} />
                    Processing ({fileStats.done}/{fileStats.total})
                  </>
                ) : (
                  <>
                    <span>🎬</span>
                    Convert All ({fileStats.pending} pending)
                  </>
                )}
              </button>

              {/* Download Zip */}
              <button
                className="btn-success"
                onClick={onDownloadZip}
                disabled={fileStats.done === 0}
                style={{
                  width: '100%', padding: '10px 14px',
                  fontSize: 12, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <span>📥</span>
                Download Zip ({fileStats.done} files)
              </button>

              {/* Reset + Clear */}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button
                  onClick={onReset}
                  style={{
                    flex: 1, padding: '8px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                    color: 'var(--text-secondary)', cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                >
                  ↻ Reset
                </button>
                <button
                  onClick={onClearAll}
                  style={{
                    flex: 1, padding: '8px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                    background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
                    color: 'var(--error)', cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.12)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.06)')}
                >
                  ✕ Clear All
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ═══ Stats display ═══ */}
        {fileStats.totalAfter > 0 && (
          <div style={{ padding: '12px 14px' }}>
            <div style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 8,
            }}>Summary</div>

            <div style={{
              padding: 10, borderRadius: 8,
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Original</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {formatBytes(fileStats.totalBefore)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Converted</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {formatBytes(fileStats.totalAfter)}
                </span>
              </div>
              <div style={{
                height: 1, background: 'var(--border)', margin: '6px 0',
              }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Savings</span>
                <span style={{
                  fontSize: 12, fontWeight: 700,
                  color: savingsPercent > 0 ? 'var(--success)' : 'var(--warning)',
                }}>
                  {savingsPercent > 0 ? `−${savingsPercent}%` : `+${Math.abs(savingsPercent)}%`}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversionSettings;
