import { Box, Skeleton } from '@mui/material';

export function TabSkeleton({ height = '70vh' }: Readonly<{ height?: string | number }>) {
    return (
        <Box sx={{ p: 2, height }}>
            <Skeleton variant="text" width="40%" sx={{ mb: 2 }} />
            <Skeleton variant="rectangular" width="100%" height={120} sx={{ mb: 2 }} />
            <Skeleton variant="rectangular" width="100%" height={300} sx={{ mb: 2 }} />
            <Skeleton variant="rectangular" width="100%" height={200} />
        </Box>
    );
}
