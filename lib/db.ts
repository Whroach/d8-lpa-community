import mongoose from 'mongoose';

// Hardcoded fallback URI for v0 preview
const FALLBACK_URI = 'mongodb+srv://lpa-d8:Qd1gXd48ljTQDzGP3477UeNrlQrdRjhG7eXpQ@cluster0.iogpu.mongodb.net/d8lpa?retryWrites=true&w=majority&appName=Cluster0';

// Use environment variable only if it's a valid MongoDB URI, otherwise use fallback
const envUri = process.env.MONGODB_URI;
const MONGODB_URI = (envUri && envUri.startsWith('mongodb')) ? envUri : FALLBACK_URI;

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var myMongoose: MongooseCache | undefined;
}

let cached: MongooseCache = global.myMongoose || { conn: null, promise: null };

if (!global.myMongoose) {
  global.myMongoose = cached;
}

async function dbConnect(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default dbConnect;
