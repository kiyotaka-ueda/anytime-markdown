'use client';

import { RefObject } from 'react';
import {
  Box,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionIcon from '@mui/icons-material/Description';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import type { useTranslations } from 'next-intl';
import type { DocFile, LayoutCard } from '../../../types/layout';

interface FileListPanelProps {
  files: DocFile[];
  cards: LayoutCard[];
  fileInputRef: RefObject<HTMLInputElement | null>;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddCard: (file: DocFile) => void;
  onDeleteRequest: (file: DocFile) => void;
  t: ReturnType<typeof useTranslations>;
}

export default function FileListPanel({
  files,
  cards,
  fileInputRef,
  onUpload,
  onAddCard,
  onDeleteRequest,
  t,
}: FileListPanelProps) {
  return (
    <Box sx={{ width: { xs: '100%', md: 300 }, flexShrink: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
          {t('sitesFileList')}
        </Typography>
        <Button
          size="small"
          startIcon={<UploadFileIcon />}
          onClick={() => fileInputRef.current?.click()}
          sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.8rem' }}
        >
          {t('docsUpload')}
        </Button>
      </Box>
      <input ref={fileInputRef} type="file" accept=".md" hidden onChange={onUpload} />
      <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper', maxHeight: 400, overflow: 'auto' }}>
        <List dense disablePadding>
          {files.map((file) => {
            const alreadyAdded = cards.some((c) => c.docKey === file.key);
            return (
              <ListItem
                key={file.key}
                disablePadding
                secondaryAction={
                  <IconButton
                    edge="end"
                    size="small"
                    aria-label={t('docsDelete')}
                    onClick={() => onDeleteRequest(file)}
                    sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                }
              >
                <ListItemButton
                  onClick={() => onAddCard(file)}
                  disabled={alreadyAdded}
                  sx={{ opacity: alreadyAdded ? 0.5 : 1 }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <DescriptionIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={file.name}
                    primaryTypographyProps={{ fontSize: '0.85rem', noWrap: true }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>
    </Box>
  );
}
