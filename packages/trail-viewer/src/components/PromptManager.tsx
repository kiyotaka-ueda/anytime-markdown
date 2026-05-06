import { useMemo, useState } from 'react';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

import type { TrailPromptEntry } from '../domain/parser/types';
import { useTrailI18n } from '../i18n';
import { useTrailTheme } from './TrailThemeContext';
import { buildPromptTree } from './promptTree';

export interface PromptManagerProps {
  readonly prompts: readonly TrailPromptEntry[];
}

const PROMPT_LIST_WIDTH = 320;

export function PromptManager({
  prompts,
}: Readonly<PromptManagerProps>) {
  const { colors, codeSx, scrollbarSx } = useTrailTheme();
  const { t } = useTrailI18n();
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const promptTree = useMemo(() => buildPromptTree(prompts), [prompts]);
  const [collapsedCategories, setCollapsedCategories] = useState<ReadonlySet<string>>(new Set());
  const selected = prompts.find((p) => p.id === selectedId);

  const toggleCategory = (category: string): void => {
    setCollapsedCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  return (
    <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <Box
        sx={{
          width: PROMPT_LIST_WIDTH,
          minWidth: PROMPT_LIST_WIDTH,
          borderRight: 1,
          borderColor: colors.border,
          overflowY: 'auto',
          ...scrollbarSx,
        }}
      >
        <List dense disablePadding>
          {promptTree.map((group) => {
            const collapsed = collapsedCategories.has(group.category);
            return (
              <Box key={group.category}>
                <ListItemButton
                  onClick={() => toggleCategory(group.category)}
                  sx={{ py: 0.5, bgcolor: colors.sectionBg }}
                >
                  <ListItemText
                    primary={group.category}
                    secondary={`${group.prompts.length} files`}
                    primaryTypographyProps={{
                      variant: 'subtitle2',
                      sx: { textTransform: 'none' },
                    }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                  {collapsed ? <ExpandMore fontSize="small" /> : <ExpandLess fontSize="small" />}
                </ListItemButton>
                <Collapse in={!collapsed} timeout="auto" unmountOnExit>
                  <List dense disablePadding>
                    {group.prompts.map((prompt) => (
                      <ListItemButton
                        key={prompt.id}
                        selected={prompt.id === selectedId}
                        onClick={() => setSelectedId(prompt.id)}
                        sx={{
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          py: 1,
                          pl: 3,
                          '&.Mui-selected': { bgcolor: colors.iceBlueBg },
                          '&.Mui-selected:hover': { bgcolor: colors.iceBlueSubtle },
                          '&:hover': { bgcolor: colors.hoverBg },
                        }}
                      >
                        <Typography variant="subtitle2" noWrap sx={{ width: '100%' }}>
                          {prompt.name}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                          {prompt.tags.map((tag) => (
                            <Chip key={tag} label={tag} size="small" variant="outlined" sx={{ borderColor: colors.iceBlue, color: colors.iceBlue }} />
                          ))}
                        </Box>
                        <Typography
                          variant="caption"
                          sx={{ mt: 0.5, color: colors.textSecondary }}
                        >
                          {new Date(prompt.updatedAt).toLocaleDateString()}
                        </Typography>
                      </ListItemButton>
                    ))}
                  </List>
                </Collapse>
              </Box>
            );
          })}
        </List>
        {prompts.length === 0 && (
          <Typography
            variant="body2"
            sx={{ p: 2, textAlign: 'center', color: colors.textSecondary }}
          >
            {t('prompt.noPrompts')}
          </Typography>
        )}
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', p: 2, ...scrollbarSx }}>
        {selected ? (
          <Paper
            elevation={0}
            sx={{
              ...codeSx,
              p: 2,
              fontSize: '0.85rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              minHeight: '100%',
            }}
          >
            {selected.content}
          </Paper>
        ) : (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
            }}
          >
            <Typography variant="body2" sx={{ color: colors.textSecondary }}>
              {t('prompt.selectPrompt')}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
