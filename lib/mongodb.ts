import mongoose, { Schema, Model, Document } from 'mongoose';

function getMongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not configured');
  }
  return uri;
}

// Cached connection to avoid re-connecting on every hot reload in dev
declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
}

let cached = global._mongooseCache;
if (!cached) {
  cached = global._mongooseCache = { conn: null, promise: null };
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    const uri = getMongoUri();
    cached.promise = mongoose
      .connect(uri, { serverSelectionTimeoutMS: 5000 })
      .then((m) => m)
      .catch((err) => {
        cached.promise = null; // 失敗時重置，讓下次請求重試
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

// ---- Message Schema ----
export interface IMessage extends Document {
  from: string;
  to: string;
  text: string;
  channel: string;
  createdAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    from:    { type: String, required: true },
    to:      { type: String, required: true },
    text:    { type: String, required: true },
    channel: { type: String, required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Message: Model<IMessage> =
  mongoose.models.Message ?? mongoose.model<IMessage>('Message', MessageSchema);
