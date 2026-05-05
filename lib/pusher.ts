import Pusher from 'pusher';

let _pusherServer: Pusher | null = null;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export function getPusherServer(): Pusher {
  if (_pusherServer) return _pusherServer;

  _pusherServer = new Pusher({
    appId: requireEnv('PUSHER_APP_ID'),
    key: requireEnv('PUSHER_KEY'),
    secret: requireEnv('PUSHER_SECRET'),
    cluster: requireEnv('PUSHER_CLUSTER'),
    useTLS: true,
  });

  return _pusherServer;
}
