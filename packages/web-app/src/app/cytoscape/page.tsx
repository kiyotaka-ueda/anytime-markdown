import type { Metadata } from 'next';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import ScienceIcon from '@mui/icons-material/Science';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';

export const metadata: Metadata = {
  title: 'Cytoscape.js - Anytime Markdown',
  description: 'Graph visualization with Cytoscape.js - Demo, Editor, and Viewer',
  alternates: { canonical: '/cytoscape' },
};

const pages = [
  {
    title: 'Demo & Showcase',
    description: 'Explore layout algorithms and graph analysis. Compare cose, breadthfirst, circle layouts and visualize Dijkstra, PageRank, clustering results.',
    href: '/cytoscape/demo',
    icon: ScienceIcon,
  },
  {
    title: 'Graph Editor',
    description: 'Build and edit graphs interactively. Add nodes and edges, customize styles, apply layouts, and import/export JSON.',
    href: '/cytoscape/editor',
    icon: EditIcon,
  },
  {
    title: 'Data Viewer',
    description: 'Visualize graph data from JSON input, file upload, or preset samples. Choose layouts and explore your data.',
    href: '/cytoscape/viewer',
    icon: VisibilityIcon,
  },
] as const;

export default function CytoscapePage() {
  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 4 }}>
      <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
        Cytoscape.js
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Graph visualization powered by Cytoscape.js
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3 }}>
        {pages.map((page) => (
          <Card key={page.href} variant="outlined">
            <CardActionArea component={Link} href={page.href} sx={{ height: '100%' }}>
              <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', py: 4 }}>
                <page.icon sx={{ fontSize: 48, mb: 2, color: 'primary.main' }} />
                <Typography variant="h5" component="h2" gutterBottom>
                  {page.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {page.description}
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    </Box>
  );
}
