import mongoose from "mongoose";

if (!process.env.MONGODB_URI) {
  throw new Error('Invalid environment variable: "MONGODB_URI"');
}

if (!process.env.MONGODB_DB) {
  throw new Error('Invalid environment variable: "MONGODB_DB"');
}

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;

interface MongooseCache {
  /** Set once the connection event listeners have been attached. */
  listenersBound?: boolean;
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongoose: MongooseCache;
}

// Initialize the cached connection
if (!global.mongoose) {
  global.mongoose = {
    conn: null,
    promise: null,
    listenersBound: false,
  };
}

async function dbConnect() {
  try {
    // If we have a connection, return it
    if (global.mongoose.conn) {
      return global.mongoose.conn;
    }

    // If we have a connecting promise, wait for it
    if (global.mongoose.promise) {
      global.mongoose.conn = await global.mongoose.promise;
      return global.mongoose.conn;
    }

    // Set up connection options.
    //
    // The cluster is an Atlas M0 (500-connection cap) shared with bounce-v3
    // and several other apps, and every pool option is charged PER
    // REPLICA-SET MEMBER (3 nodes), not per client. With only the defaults
    // this app could hold up to 100 sockets per node per warm instance and
    // never closed an idle one (maxIdleTimeMS 0), which is what pushed the
    // cluster to 97% of its cap on 2026-10-25. Values mirror bounce-v3's
    // src/lib/db/mongoose.ts, which documents the reasoning in full.
    const opts = {
      bufferCommands: true,
      dbName: dbName,
      minPoolSize: 0, // no permanent sockets; idle pools drain to zero
      maxPoolSize: 10,
      maxIdleTimeMS: 10000, // reap a socket ~10s after its last use
      waitQueueTimeoutMS: 5000, // fail fast instead of hanging to maxDuration
      serverSelectionTimeoutMS: 5000,
      // Sent in the handshake so this app is identifiable in Atlas.
      appName: `ritas-v1-${process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "local"}`,
    };

    // Create the connection promise
    global.mongoose.promise = mongoose.connect(uri, opts).then((mongoose) => {
      return mongoose;
    });

    // Wait for the connection
    global.mongoose.conn = await global.mongoose.promise;

    // Registered once. The `disconnected` handler nulls the cache, so the
    // next dbConnect() re-entered this block and added another pair of
    // listeners every reconnect, up to MaxListenersExceededWarning.
    if (!global.mongoose.listenersBound) {
      global.mongoose.listenersBound = true;

      global.mongoose.conn.connection.on("error", (error) => {
        console.error("MongoDB connection error:", error);
      });

      global.mongoose.conn.connection.on("disconnected", () => {
        console.warn("MongoDB disconnected");
        global.mongoose.conn = null;
        global.mongoose.promise = null;
      });
    }

    return global.mongoose.conn;
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    global.mongoose.promise = null;
    throw error;
  }
}

export default dbConnect;
