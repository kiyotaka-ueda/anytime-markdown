'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import { useTranslations } from 'next-intl';
import type { DocFile, LayoutCard } from '../../../types/layout';

function generateId() {
  return crypto.randomUUID();
}

export function useLayoutEditor() {
  const t = useTranslations('Landing');
  const tCommon = useTranslations('Common');
  const [files, setFiles] = useState<DocFile[]>([]);
  const [cards, setCards] = useState<LayoutCard[]>([]);
  const [siteDescription, setSiteDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);
  const [editCard, setEditCard] = useState<LayoutCard | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocFile | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFormRef = useRef<{ title: string; description: string; thumbnail: string; tags: string }>({
    title: '',
    description: '',
    thumbnail: '',
    tags: '',
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const fetchFiles = useCallback(() => {
    return fetch('/api/docs')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ files: DocFile[] }>;
      })
      .then((data) => setFiles(data.files));
  }, []);

  useEffect(() => {
    Promise.all([
      fetchFiles(),
      fetch('/api/sites/layout').then((r) => r.json()) as Promise<{ cards: LayoutCard[]; siteDescription?: string }>,
    ])
      .then(([, layoutData]) => {
        setCards(layoutData.cards.map((c) => ({ ...c, tags: c.tags ?? [] })).sort((a, b) => a.order - b.order));
        if (layoutData.siteDescription) setSiteDescription(layoutData.siteDescription);
      })
      .catch(() => setSnackbar({ message: t('sitesLoadError'), severity: 'error' }))
      .finally(() => setLoading(false));
  }, [t, fetchFiles]);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/docs/upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSnackbar({ message: t('docsUploadSuccess'), severity: 'success' });
      fetchFiles();
    } catch {
      setSnackbar({ message: t('docsUploadError'), severity: 'error' });
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [t, fetchFiles]);

  const handleDeleteFile = useCallback(async () => {
    if (!deleteTarget) return;

    try {
      const res = await fetch(`/api/docs/delete?key=${encodeURIComponent(deleteTarget.key)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSnackbar({ message: t('docsDeleteSuccess'), severity: 'success' });
      setCards((prev) => prev.filter((c) => c.docKey !== deleteTarget.key));
      fetchFiles();
    } catch {
      setSnackbar({ message: t('docsDeleteError'), severity: 'error' });
    }

    setDeleteTarget(null);
  }, [deleteTarget, t, fetchFiles]);

  const handleAddCard = useCallback((file: DocFile) => {
    setCards((prev) => {
      if (prev.some((c) => c.docKey === file.key)) return prev;
      return [
        ...prev,
        {
          id: generateId(),
          docKey: file.key,
          title: file.name.replace(/\.md$/, ''),
          description: '',
          thumbnail: '',
          tags: [],
          order: prev.length,
        },
      ];
    });
  }, []);

  const handleDeleteCard = useCallback((id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setCards((prev) => {
      const oldIndex = prev.findIndex((c) => c.id === active.id);
      const newIndex = prev.findIndex((c) => c.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex).map((c, i) => ({ ...c, order: i }));
    });
  }, []);

  const handleEditOpen = useCallback((card: LayoutCard) => {
    setEditCard(card);
    editFormRef.current = {
      title: card.title,
      description: card.description,
      thumbnail: card.thumbnail,
      tags: (card.tags ?? []).join(', '),
    };
  }, []);

  const handleEditSave = useCallback(() => {
    if (!editCard) return;
    setCards((prev) =>
      prev.map((c) =>
        c.id === editCard.id
          ? {
              ...c,
              title: editFormRef.current.title,
              description: editFormRef.current.description,
              thumbnail: editFormRef.current.thumbnail,
              tags: editFormRef.current.tags.split(',').map((s) => s.trim()).filter(Boolean),
            }
          : c,
      ),
    );
    setEditCard(null);
  }, [editCard]);

  const handleSave = useCallback(async () => {
    const layout = { cards: cards.map((c, i) => ({ ...c, order: i })), siteDescription };

    try {
      const res = await fetch('/api/sites/layout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(layout),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSnackbar({ message: t('sitesSaveSuccess'), severity: 'success' });
    } catch {
      setSnackbar({ message: t('sitesSaveError'), severity: 'error' });
    }
  }, [cards, t]);

  const activeCard = activeId ? cards.find((c) => c.id === activeId) ?? null : null;

  return {
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
  };
}
