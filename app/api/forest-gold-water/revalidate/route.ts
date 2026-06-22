import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.REVALIDATE_SECRET || 'dev-secret'}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Revalidate the Forest Gold Water dashboard page and stats API
    revalidatePath('/clients/forest-gold-water');
    revalidatePath('/api/forest-gold-water/stats');

    return NextResponse.json({
      message: 'Cache revalidated - all Forest Gold Water dashboard data refreshed',
      revalidated: true,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Revalidate error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
