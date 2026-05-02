import { Box, Typography } from '@mui/material';
import type { MetricOverlay } from '@anytime-markdown/trail-core/c4';

export interface CommunityLegendItem {
  readonly community: number;
  readonly color: string;
  readonly name: string;
  readonly summary?: string;
}

interface OverlayLegendProps {
  readonly overlay: MetricOverlay;
  readonly isDark: boolean;
  /** DSM依存数の最大値（dsm-out/in の場合に表示） */
  readonly dsmMax?: number;
  /** Community オーバーレイ凡例（指定時はメトリクス凡例の上に表示） */
  readonly communityLegend?: readonly CommunityLegendItem[];
  /** 凡例タイトル（i18n 済み文字列） */
  readonly communityTitle?: string;
  /** true のとき position:absolute を使わずインライン表示する */
  readonly inline?: boolean;
}

const SWATCH_SIZE = 12;

function Swatch({ color, label }: Readonly<{ color: string; label: string }>) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Box sx={{ width: SWATCH_SIZE, height: SWATCH_SIZE, borderRadius: 0.5, bgcolor: color, flexShrink: 0 }} />
      <Typography variant="caption" sx={{ fontSize: '0.65rem', lineHeight: 1 }}>{label}</Typography>
    </Box>
  );
}

export function OverlayLegend({ overlay, isDark, dsmMax, communityLegend, communityTitle, inline }: Readonly<OverlayLegendProps>) {
  const hasCommunity = !!communityLegend && communityLegend.length > 0;
  const hasMetric = overlay !== 'none';
  if (!hasCommunity && !hasMetric) return null;

  const bg = isDark ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.85)';
  const textColor = isDark ? '#e0e0e0' : '#212121';
  const dividerColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';

  let metricItems: React.ReactNode = null;

  if (overlay === 'coverage-lines' || overlay === 'coverage-branches' || overlay === 'coverage-functions') {
    metricItems = (
      <>
        <Swatch color="#2e7d32" label="≥ 80%" />
        <Swatch color="#f9a825" label="50–79%" />
        <Swatch color="#c62828" label="< 50%" />
        <Swatch color="#616161" label="—" />
      </>
    );
  } else if (overlay === 'dsm-out' || overlay === 'dsm-in') {
    metricItems = (
      <>
        <Swatch color="#c62828" label={`max${dsmMax !== undefined ? ` (${dsmMax})` : ''}`} />
        <Swatch color="#1565c0" label="0" />
      </>
    );
  } else if (overlay === 'dsm-cyclic') {
    metricItems = (
      <>
        <Swatch color="#c62828" label="cyclic" />
        <Swatch color="#2e7d32" label="ok" />
      </>
    );
  } else if (overlay === 'complexity-most' || overlay === 'complexity-highest') {
    metricItems = (
      <>
        <Swatch color="#c62828" label="high" />
        <Swatch color="#f9a825" label="multi-file" />
        <Swatch color="#1565c0" label="search" />
        <Swatch color="#2e7d32" label="low" />
      </>
    );
  } else if (overlay === 'importance') {
    metricItems = (
      <>
        <Swatch color="#c62828" label="≥ 70" />
        <Swatch color="#f9a825" label="40–69" />
        <Swatch color="#2e7d32" label="< 40" />
      </>
    );
  } else if (overlay === 'defect-risk') {
    metricItems = (
      <>
        <Swatch color="#c62828" label="≥ 0.7" />
        <Swatch color="#f9a825" label="0.35–0.7" />
        <Swatch color="#2e7d32" label="< 0.35" />
      </>
    );
  }

  const positionSx = inline
    ? {}
    : {
        position: 'absolute',
        bottom: 12,
        right: 12,
        // 上端に Minimap (top: 8, height ~150px) がいるため、bottom 起点で
        // 上方向に成長する高さを Minimap 領域分（約 180px）控えて制限する。
        maxHeight: 'calc(100% - 180px)',
        overflowY: 'auto',
        overflowX: 'hidden',
        pointerEvents: 'auto',
        zIndex: 10,
        backdropFilter: 'blur(4px)',
        minWidth: 80,
        maxWidth: 220,
        // Webkit 系ブラウザのスクロールバー細身化
        '&::-webkit-scrollbar': { width: 6 },
        '&::-webkit-scrollbar-thumb': {
          bgcolor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
          borderRadius: 3,
        },
      };

  return (
    <Box
      sx={{
        ...positionSx,
        bgcolor: bg,
        color: textColor,
        borderRadius: 1,
        px: 1,
        py: 0.75,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.4,
      }}
    >
      {hasCommunity && (
        <>
          {communityTitle && (
            <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 700, opacity: 0.85 }}>
              {communityTitle}
            </Typography>
          )}
          {communityLegend!.map((item) => (
            <Swatch
              key={item.community}
              color={item.color}
              label={item.summary ? `${item.name} — ${item.summary}` : item.name}
            />
          ))}
        </>
      )}
      {hasCommunity && hasMetric && (
        <Box sx={{ height: '1px', bgcolor: dividerColor, my: 0.25 }} />
      )}
      {metricItems}
    </Box>
  );
}
