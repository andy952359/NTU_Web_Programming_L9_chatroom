import { NextRequest, NextResponse } from 'next/server';
import { connectDB, Message } from '@/lib/mongodb';
import { getPusherServer } from '@/lib/pusher';

// Helper: deterministic channel name for any two users
function channelName(a: string, b: string): string {
  return `chat-${[a, b].sort().join('-')}`;
}

// POST /api/message — send a new message
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { from, to, text } = body as { from: string; to: string; text: string };

    if (!from || !to || !text) {
      return NextResponse.json({ error: 'from, to, and text are required' }, { status: 400 });
    }

    await connectDB();

    const channel = channelName(from, to);
    const message = await Message.create({ from, to, text, channel });
    const pusherServer = getPusherServer();

    // Broadcast via Pusher
    await pusherServer.trigger(channel, 'new-message', {
      _id:       message._id.toString(),
      from:      message.from,
      to:        message.to,
      text:      message.text,
      createdAt: message.createdAt,
    });

    return NextResponse.json({ ok: true, message }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/message]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/message?user1=alice&user2=bob — fetch last 50 messages
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const user1 = searchParams.get('user1');
    const user2 = searchParams.get('user2');

    if (!user1 || !user2) {
      return NextResponse.json({ error: 'user1 and user2 query params are required' }, { status: 400 });
    }

    await connectDB();

    const channel = channelName(user1, user2);
    const messages = await Message.find({ channel })
      .sort({ createdAt: 1 })
      .limit(50)
      .lean();

    return NextResponse.json({ messages });
  } catch (err) {
    console.error('[GET /api/message]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
