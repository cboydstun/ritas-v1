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

    // Set up connection options
    const opts = {
      bufferCommands: true,
      dbName: dbName,
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
