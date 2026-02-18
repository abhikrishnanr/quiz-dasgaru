import { NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

const s3 = new S3Client({
    region: process.env.S3_REGION,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    },
});

// Helper to convert stream to string
const streamToString = (stream: Readable): Promise<string> => {
    return new Promise((resolve, reject) => {
        const chunks: any[] = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
};

export async function POST(req: Request) {
    try {
        const { key } = await req.json();

        if (!key) {
            return NextResponse.json({ error: 'Key is required' }, { status: 400 });
        }

        const bucketName = process.env.S3_BUCKET_NAME;
        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: key,
        });

        const response = await s3.send(command);

        if (!response.Body) {
            return NextResponse.json({ error: 'Empty file content' }, { status: 404 });
        }

        const content = await streamToString(response.Body as Readable);

        // Return content directly (frontend will parse it as JSON)
        // We parse it here first to ensure it is valid JSON
        try {
            const jsonContent = JSON.parse(content);
            return NextResponse.json({ content: jsonContent });
        } catch (e) {
            return NextResponse.json({ error: 'File content is not valid JSON' }, { status: 400 });
        }

    } catch (error: any) {
        console.error('S3 Read Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to read S3 object' }, { status: 500 });
    }
}
