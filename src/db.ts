import { Pool } from 'pg';

export type StoredMessage = {
  id: string | number;
  user_id: string;
  channel_id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
};

const connectionString = process.env.DATABASE_URL;

const pool: Pool | null = connectionString
  ? new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
    })
  : null;

export const isDbEnabled: boolean = !!pool;

export async function fetchChannelMessages(channelId: string, limit: number): Promise<StoredMessage[]> {
  if (!pool) return [];
  const sql = `
    SELECT id, user_id, channel_id, role, content, timestamp
    FROM messages
    WHERE channel_id = $1
    ORDER BY timestamp DESC
    LIMIT $2
  `;
  const res = await pool.query(sql, [channelId, limit]);
  return res.rows.map((r: any) => ({
    id: r.id,
    user_id: r.user_id,
    channel_id: r.channel_id,
    role: r.role,
    content: r.content,
    timestamp: r.timestamp instanceof Date ? r.timestamp : new Date(r.timestamp)
  }));
}

export async function insertMessage(params: {
  userId: string;
  channelId: string;
  role: 'user' | 'model';
  content: string;
  timestamp?: Date;
}): Promise<void> {
  if (!pool) return;
  const { userId, channelId, role, content } = params;
  const ts = params.timestamp ?? new Date();
  const sql = `
    INSERT INTO messages (user_id, channel_id, role, content, timestamp)
    VALUES ($1, $2, $3, $4, $5)
  `;
  await pool.query(sql, [userId, channelId, role, content, ts]);
}

export async function clearChannelMessages(channelId: string): Promise<void> {
  if (!pool) return;
  await pool.query('DELETE FROM messages WHERE channel_id = $1', [channelId]);
}

