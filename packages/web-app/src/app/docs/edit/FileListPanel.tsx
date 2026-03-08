'use client';

import { RefObject } from 'react';
import {
  Box,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionIcon from '@mui/icons-material/Description';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import type { useTranslations } from 'next-intl';
import type { DocFile } from '../../../types/layout';

interface FileListPanelProps {
  files: DocFile[];
  fileInputRef: RefObject<HTMLInputElement | null>;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteRequest: (file: DocFile) => void;
  t: ReturnType<typeof useTranslations>;
}

export default function FileListPanel({
  files,
  fileInputRef,
  onUpload,
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
          {files.map((file) => (
            <ListItem
              key={file.key}
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
              <ListItemIcon sx={{ minWidth: 36 }}>
                <DescriptionIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              </ListItemIcon>
              <ListItemText
                primary={file.name}
                primaryTypographyProps={{ fontSize: '0.85rem', noWrap: true }}
              />
            </ListItem>
          ))}
        </List>
      </Box>
    </Box>
  );
}
