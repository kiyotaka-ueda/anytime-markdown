'use client';

import { DEFAULT_DARK_BG, DEFAULT_LIGHT_BG } from '@anytime-markdown/editor-core';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionIcon from '@mui/icons-material/Description';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FolderIcon from '@mui/icons-material/Folder';
import ImageIcon from '@mui/icons-material/Image';
import LinkIcon from '@mui/icons-material/Link';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import {
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { useTranslations } from 'next-intl';
import { RefObject, useMemo, useState } from 'react';

import type { DocFile } from '../../../types/layout';

interface FileListPanelProps {
  files: DocFile[];
  fileInputRef: RefObject<HTMLInputElement | null>;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteRequest: (file: DocFile) => void;
  urlLinks: { url: string; displayName: string }[];
  onAddUrlLink: (url: string, displayName: string) => void;
  onDeleteUrlLink: (url: string) => void;
  t: ReturnType<typeof useTranslations>;
}

export default function FileListPanel({
  files,
  fileInputRef,
  onUpload,
  onDeleteRequest,
  urlLinks,
  onAddUrlLink,
  onDeleteUrlLink,
  t,
}: FileListPanelProps) {
  const theme = useTheme();
  const bgColor = theme.palette.mode === 'dark' ? DEFAULT_DARK_BG : DEFAULT_LIGHT_BG;
  const [urlDraft, setUrlDraft] = useState('');
  const [nameDraft, setNameDraft] = useState('');

  // md ファイル名のセット（日英ペア判定用）
  const mdFileNames = new Set(files.filter((f) => f.name.endsWith('.md')).map((f) => f.name));

  // フォルダごとにグルーピング
  const folderGroups = useMemo(() => {
    const groups = new Map<string, DocFile[]>();
    for (const file of files) {
      // key から docs/ プレフィックスを除去し、最初のフォルダ名を取得
      const withoutPrefix = file.key.replace(/^docs\//, '');
      const slashIdx = withoutPrefix.indexOf('/');
      const folder = slashIdx >= 0 ? withoutPrefix.slice(0, slashIdx) : '';
      if (!groups.has(folder)) groups.set(folder, []);
      groups.get(folder)!.push(file);
    }
    return groups;
  }, [files]);

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const toggleFolder = (folder: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      return next;
    });
  };

  const handleAdd = () => {
    const trimmedUrl = urlDraft.trim();
    const trimmedName = nameDraft.trim() || trimmedUrl;
    if (!trimmedUrl) return;
    if (!trimmedUrl.startsWith('/') && !trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) return;
    onAddUrlLink(trimmedUrl, trimmedName);
    setUrlDraft('');
    setNameDraft('');
  };

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
      <input ref={fileInputRef} type="file" accept=".md,.png,.jpg,.jpeg,.gif,.svg,.webp" multiple hidden onChange={onUpload} />
      <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: bgColor, maxHeight: 400, overflow: 'auto' }}>
        <List dense disablePadding>
          {[...folderGroups.entries()].map(([folder, folderFiles]) => {
            if (!folder) {
              // ルート直下のファイル（フォルダなし）
              return folderFiles.map((file) => (
                <FileListItem key={file.key} file={file} mdFileNames={mdFileNames} onDeleteRequest={onDeleteRequest} t={t} />
              ));
            }
            const isExpanded = expandedFolders.has(folder);
            return (
              <Box key={folder}>
                <ListItemButton onClick={() => toggleFolder(folder)} dense sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <FolderIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        {folder}/
                      </Typography>
                    }
                  />
                  {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                </ListItemButton>
                <Collapse in={isExpanded}>
                  <List dense disablePadding>
                    {folderFiles.map((file) => (
                      <FileListItem key={file.key} file={file} mdFileNames={mdFileNames} onDeleteRequest={onDeleteRequest} t={t} indent />
                    ))}
                  </List>
                </Collapse>
              </Box>
            );
          })}
        </List>
      </Box>

      {/* URLリンク */}
      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary', mt: 3, mb: 1 }}>
        {t('sitesUrlLinks')}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 1 }}>
        <TextField
          size="small"
          placeholder={t('sitesUrlPlaceholder')}
          value={urlDraft}
          onChange={(e) => setUrlDraft(e.target.value)}
          fullWidth
        />
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            size="small"
            placeholder={t('sitesUrlDisplayName')}
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            fullWidth
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleAdd}
            disabled={!urlDraft.trim()}
            sx={{ textTransform: 'none', fontWeight: 600, flexShrink: 0 }}
          >
            {t('sitesUrlAdd')}
          </Button>
        </Box>
      </Box>
      {urlLinks.length > 0 && (
        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: bgColor, maxHeight: 200, overflow: 'auto' }}>
          <List dense disablePadding>
            {urlLinks.map((link) => (
              <ListItem
                key={link.url}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/x-url-link', JSON.stringify({ url: link.url, displayName: link.displayName }));
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                secondaryAction={
                  <IconButton
                    edge="end"
                    size="small"
                    aria-label={t('docsDelete')}
                    onClick={() => onDeleteUrlLink(link.url)}
                    sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                }
                sx={{ cursor: 'grab', '&:active': { cursor: 'grabbing' } }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <LinkIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                </ListItemIcon>
                <ListItemText
                  primary={link.displayName}
                  secondary={link.url}
                  primaryTypographyProps={{ fontSize: '0.85rem', noWrap: true }}
                  secondaryTypographyProps={{ fontSize: '0.7rem', noWrap: true }}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </Box>
  );
}

function isImageFile(name: string) {
  return /\.(png|jpe?g|gif|svg|webp)$/i.test(name);
}

function FileListItem({ file, mdFileNames, onDeleteRequest, t, indent }: {
  file: DocFile;
  mdFileNames: Set<string>;
  onDeleteRequest: (file: DocFile) => void;
  t: ReturnType<typeof useTranslations>;
  indent?: boolean;
}) {
  // フォルダ内のファイル名のみ表示（パスから最後の部分を取得）
  const displayName = file.name.includes('/') ? file.name.split('/').pop()! : file.name;
  const isImage = isImageFile(displayName);

  return (
    <ListItem
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-doc-file', JSON.stringify({ key: file.key, name: file.name }));
        e.dataTransfer.effectAllowed = 'copy';
      }}
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
      sx={{ cursor: 'grab', '&:active': { cursor: 'grabbing' }, ...(indent && { pl: 4 }) }}
    >
      <ListItemIcon sx={{ minWidth: 36 }}>
        {isImage
          ? <ImageIcon fontSize="small" sx={{ color: 'text.secondary' }} />
          : <DescriptionIcon fontSize="small" sx={{ color: 'text.secondary' }} />
        }
      </ListItemIcon>
      <ListItemText
        primary={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography sx={{ fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName}
            </Typography>
            {displayName.endsWith('.md') && (
              <LanguageBadges fileName={displayName} mdFileNames={mdFileNames} />
            )}
          </Box>
        }
      />
    </ListItem>
  );
}

function LanguageBadges({ fileName, mdFileNames }: { fileName: string; mdFileNames: Set<string> }) {
  const isEn = fileName.endsWith('-en.md');
  const baseName = isEn ? fileName.slice(0, -6) + '.md' : fileName;
  const enName = isEn ? fileName : fileName.slice(0, -3) + '-en.md';
  const hasJa = mdFileNames.has(baseName);
  const hasEn = mdFileNames.has(enName);
  return (
    <>
      <Chip label="JA" size="small" sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700, bgcolor: hasJa ? 'primary.main' : 'action.disabledBackground', color: hasJa ? 'primary.contrastText' : 'text.disabled' }} />
      <Chip label="EN" size="small" sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700, bgcolor: hasEn ? 'primary.main' : 'action.disabledBackground', color: hasEn ? 'primary.contrastText' : 'text.disabled' }} />
    </>
  );
}
