import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, DOCS_BUCKET, DOCS_PREFIX } from '../../../../lib/s3Client';
import { checkBasicAuth } from '../../../../lib/basicAuth';

const LAYOUT_KEY = DOCS_PREFIX + '_layout.json';

export async function GET() {
  if (!DOCS_BUCKET) {
    return NextResponse.json(
      { error: 'S3_DOCS_BUCKET is not configured' },
      { status: 500 },
    );
  }

  try {
    const command = new GetObjectCommand({
      Bucket: DOCS_BUCKET,
      Key: LAYOUT_KEY,
    });
    const response = await s3Client.send(command);
    const body = await response.Body?.transformToString('utf-8');

    if (!body) {
      return NextResponse.json({ cards: [] });
    }

    return NextResponse.json(JSON.parse(body));
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'NoSuchKey') {
      return NextResponse.json({ cards: [] });
    }
    console.error('Failed to get layout:', e);
    return NextResponse.json(
      { error: 'Failed to load layout' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const authError = checkBasicAuth(request);
  if (authError) return authError;

  if (!DOCS_BUCKET) {
    return NextResponse.json(
      { error: 'S3_DOCS_BUCKET is not configured' },
      { status: 500 },
    );
  }

  try {
    const layout = await request.json();

    const command = new PutObjectCommand({
      Bucket: DOCS_BUCKET,
      Key: LAYOUT_KEY,
      Body: JSON.stringify(layout, null, 2),
      ContentType: 'application/json; charset=utf-8',
    });
    await s3Client.send(command);

    return NextResponse.json({ saved: true });
  } catch (e) {
    console.error('Failed to save layout:', e);
    return NextResponse.json(
      { error: 'Failed to save layout' },
      { status: 500 },
    );
  }
}
