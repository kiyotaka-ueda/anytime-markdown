'use client';

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import LandingHeader from '../../components/LandingHeader';
import SiteFooter from '../../components/SiteFooter';
import FileListPanel from './FileListPanel';
import CardAreaPanel from './CardAreaPanel';
import { useLayoutEditor } from './useLayoutEditor';

export default function EditBody() {
  const editor = useLayoutEditor();
  const {
    t,
    tCommon,
    files,
    cards,
    siteDescription,
    setSiteDescription,
    loading,
    snackbar,
    setSnackbar,
    editCard,
    setEditCard,
    deleteTarget,
    setDeleteTarget,
    fileInputRef,
    editFormRef,
    sensors,
    activeCard,
    handleUpload,
    handleDeleteFile,
    handleAddCard,
    handleDeleteCard,
    handleDragStart,
    handleDragEnd,
    handleEditOpen,
    handleEditSave,
    handleSave,
  } = editor;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <LandingHeader />
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }} role="status">
          <CircularProgress aria-label="Loading" />
        </Box>
        <SiteFooter />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <LandingHeader />
      <Container maxWidth="lg" sx={{ flex: 1, py: 4, px: { xs: 2, md: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography
            variant="h3"
            component="h1"
            sx={{
              fontWeight: 700,
              color: 'text.primary',
              fontSize: { xs: '1.8rem', md: '2.4rem' },
            }}
          >
            {t('sitesEdit')}
          </Typography>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: 2,
              bgcolor: 'secondary.main',
              color: '#000000',
              '&:hover': { bgcolor: 'secondary.dark' },
            }}
          >
            {t('sitesSave')}
          </Button>
        </Box>

        <TextField
          label={t('siteDescription')}
          value={siteDescription}
          onChange={(e) => setSiteDescription(e.target.value)}
          fullWidth
          size="small"
          sx={{ mb: 3 }}
        />

        <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
          <FileListPanel
            files={files}
            cards={cards}
            fileInputRef={fileInputRef}
            onUpload={handleUpload}
            onAddCard={handleAddCard}
            onDeleteRequest={setDeleteTarget}
            t={t}
          />
          <CardAreaPanel
            cards={cards}
            activeCard={activeCard}
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onEdit={handleEditOpen}
            onDelete={handleDeleteCard}
            t={t}
          />
        </Box>
      </Container>
      <SiteFooter />

      {/* ファイル削除確認ダイアログ */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} aria-labelledby="delete-dialog-title">
        <DialogTitle id="delete-dialog-title">{t('docsDelete')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('docsDeleteConfirm')}
            {deleteTarget && (
              <Box component="span" sx={{ display: 'block', mt: 1, fontWeight: 600 }}>
                {deleteTarget.name}
              </Box>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>{tCommon('cancel')}</Button>
          <Button onClick={handleDeleteFile} color="error" variant="contained">
            {t('docsDelete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* カード編集ダイアログ */}
      <Dialog open={!!editCard} onClose={() => setEditCard(null)} maxWidth="sm" fullWidth aria-labelledby="edit-dialog-title">
        <DialogTitle id="edit-dialog-title">{t('sitesEdit')}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField
            label={t('sitesCardTitle')}
            defaultValue={editCard?.title ?? ''}
            onChange={(e) => { editFormRef.current.title = e.target.value; }}
            fullWidth
            size="small"
          />
          <TextField
            label={t('sitesCardDescription')}
            defaultValue={editCard?.description ?? ''}
            onChange={(e) => { editFormRef.current.description = e.target.value; }}
            fullWidth
            size="small"
            multiline
            rows={3}
          />
          <TextField
            label={t('sitesCardThumbnail')}
            defaultValue={editCard?.thumbnail ?? ''}
            onChange={(e) => { editFormRef.current.thumbnail = e.target.value; }}
            fullWidth
            size="small"
            placeholder="https://..."
          />
          <TextField
            label={t('sitesCardTags')}
            defaultValue={(editCard?.tags ?? []).join(', ')}
            onChange={(e) => { editFormRef.current.tags = e.target.value; }}
            fullWidth
            size="small"
            placeholder="tag1, tag2, tag3"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditCard(null)}>{tCommon('cancel')}</Button>
          <Button onClick={handleEditSave} variant="contained">{tCommon('ok')}</Button>
        </DialogActions>
      </Dialog>

      {/* スナックバー */}
      <Snackbar
        open={!!snackbar}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snackbar ? (
          <Alert severity={snackbar.severity} onClose={() => setSnackbar(null)} variant="filled">
            {snackbar.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}
