import { NextResponse } from 'next/server';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

const s3 = new S3Client({
    region: process.env.S3_REGION,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    },
});

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const bucketName = process.env.S3_BUCKET_NAME;
        if (!bucketName) {
            return NextResponse.json({ error: 'S3_BUCKET_NAME not configured' }, { status: 500 });
        }

        const command = new ListObjectsV2Command({
            Bucket: bucketName,
        });

        const response = await s3.send(command);

        // Filter for JSON files and map to simple structure
        const files = (response.Contents || [])
            .filter(obj => obj.Key?.endsWith('.json'))
            .map(obj => ({
                key: obj.Key,
                lastModified: obj.LastModified,
                size: obj.Size,
            }));

        return NextResponse.json({ files });
    } catch (error: any) {
        console.error('S3 List Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to list S3 objects' }, { status: 500 });
    }
}
