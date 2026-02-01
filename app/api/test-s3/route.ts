import { NextResponse } from 'next/server';
import { S3Client, HeadBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3';

export async function GET() {
  try {
    // Configure S3 client
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
      forcePathStyle: false,
    });

    const bucketName = process.env.AWS_S3_BUCKET_NAME || '';

    if (!bucketName || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return NextResponse.json({
        success: false,
        message: 'Missing S3 configuration. Please check your .env file.',
        details: {
          hasRegion: !!process.env.AWS_REGION,
          hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
          hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
          hasBucketName: !!bucketName,
        }
      }, { status: 400 });
    }

    // Test 1: Check if bucket exists and is accessible
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));

    // Test 2: Try to write a test file
    const testFileName = `test/connection-test-${Date.now()}.txt`;
    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: testFileName,
      Body: 'S3 connection test successful!',
      ContentType: 'text/plain',
    }));

    const testFileUrl = `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${testFileName}`;

    return NextResponse.json({
      success: true,
      message: 'S3 connection successful! ✅',
      details: {
        region: process.env.AWS_REGION,
        bucket: bucketName,
        testFileUrl,
        note: 'Test file uploaded successfully. Photo uploads should work!'
      }
    });

  } catch (error: any) {
    console.error('S3 Test Error:', error);
    
    let errorMessage = 'Unknown error occurred';
    let troubleshooting = [];

    if (error.$metadata?.httpStatusCode === 301) {
      errorMessage = 'Bucket region mismatch (HTTP 301 redirect)';
      troubleshooting.push('Your bucket is likely in a different region than specified');
      troubleshooting.push('Check your bucket region in AWS Console: https://s3.console.aws.amazon.com/s3/buckets');
      troubleshooting.push('Update AWS_REGION in .env to match your bucket region');
      troubleshooting.push('Common regions: us-east-1, us-east-2, us-west-1, us-west-2');
    } else if (error.name === 'NoSuchBucket') {
      errorMessage = 'Bucket does not exist';
      troubleshooting.push('Verify bucket name in .env matches your S3 bucket');
      troubleshooting.push('Check that the bucket exists in your AWS console');
    } else if (error.name === 'InvalidAccessKeyId') {
      errorMessage = 'Invalid AWS Access Key ID';
      troubleshooting.push('Verify AWS_ACCESS_KEY_ID in .env is correct');
    } else if (error.name === 'SignatureDoesNotMatch') {
      errorMessage = 'Invalid AWS Secret Access Key';
      troubleshooting.push('Verify AWS_SECRET_ACCESS_KEY in .env is correct');
    } else if (error.name === 'AccessDenied' || error.name === 'Forbidden') {
      errorMessage = 'Access denied to bucket';
      troubleshooting.push('Verify IAM user has S3 permissions');
      troubleshooting.push('Check bucket policy allows public-read ACL');
      troubleshooting.push('Ensure "Block all public access" is OFF in bucket settings');
    } else if (error.name === 'NetworkingError') {
      errorMessage = 'Network error connecting to AWS';
      troubleshooting.push('Check your internet connection');
      troubleshooting.push('Verify AWS_REGION is correct');
    } else {
      errorMessage = error.message || 'Connection failed';
    }

    return NextResponse.json({
      success: false,
      message: `S3 connection failed: ${errorMessage}`,
      error: error.name,
      troubleshooting,
      details: {
        errorType: error.name,
        errorCode: error.$metadata?.httpStatusCode,
      }
    }, { status: 500 });
  }
}
