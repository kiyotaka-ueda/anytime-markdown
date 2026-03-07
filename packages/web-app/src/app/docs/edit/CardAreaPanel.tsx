'use client';

import {
  Box,
  Card,
  CardContent,
  IconButton,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import EditIcon from '@mui/icons-material/Edit';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  type SensorDescriptor,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { useTranslations } from 'next-intl';
import type { LayoutCard } from '../../../types/layout';

function SortableCard({
  card,
  onEdit,
  onDelete,
  t,
}: {
  card: LayoutCard;
  onEdit: (card: LayoutCard) => void;
  onDelete: (id: string) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} sx={{ mb: 1 }}>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, '&:last-child': { pb: 1 } }}>
        <IconButton size="small" {...attributes} {...listeners} aria-roledescription="sortable" aria-label={`${card.title} - drag to reorder`} sx={{ cursor: 'grab', color: 'text.secondary' }}>
          <DragIndicatorIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
            {card.title}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {card.docKey}
          </Typography>
        </Box>
        <IconButton size="small" onClick={() => onEdit(card)} aria-label={t('sitesEdit')}>
          <EditIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          onClick={() => onDelete(card.id)}
          aria-label={t('sitesCardDelete')}
          sx={{ '&:hover': { color: 'error.main' } }}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </CardContent>
    </Card>
  );
}

interface CardAreaPanelProps {
  cards: LayoutCard[];
  activeCard: LayoutCard | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sensors: ReturnType<typeof import('@dnd-kit/core').useSensors>;
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onEdit: (card: LayoutCard) => void;
  onDelete: (id: string) => void;
  t: ReturnType<typeof useTranslations>;
}

export default function CardAreaPanel({
  cards,
  activeCard,
  sensors,
  onDragStart,
  onDragEnd,
  onEdit,
  onDelete,
  t,
}: CardAreaPanelProps) {
  return (
    <Box sx={{ flex: 1 }}>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'text.secondary' }}>
        {t('sitesCardArea')}
      </Typography>
      <Box
        sx={{
          border: 2,
          borderColor: 'divider',
          borderStyle: 'dashed',
          borderRadius: 2,
          p: 2,
          minHeight: 200,
          bgcolor: 'background.paper',
        }}
      >
        {cards.length === 0 ? (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            {t('sitesEmpty')}
          </Typography>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          >
            <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              {cards.map((card) => (
                <SortableCard
                  key={card.id}
                  card={card}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  t={t}
                />
              ))}
            </SortableContext>
            <DragOverlay>
              {activeCard ? (
                <Card sx={{ opacity: 0.8 }}>
                  <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {activeCard.title}
                    </Typography>
                  </CardContent>
                </Card>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </Box>
    </Box>
  );
}
