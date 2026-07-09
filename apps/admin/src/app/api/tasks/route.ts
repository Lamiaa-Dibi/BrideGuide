import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Lazy initializer for the Admin Client to avoid build-time errors
let supabaseAdmin: any = null;

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('Supabase URL and Service Role Key are required.');
    }
    supabaseAdmin = createClient(url, key);
  }
  return supabaseAdmin;
}

export async function POST(req: Request) {
  try {
    const { title, user_id, status, priority, category } = await req.json();

    if (!title || !user_id) {
      return NextResponse.json({ error: 'Missing title or user_id' }, { status: 400 });
    }

    console.log('DEBUG: Master Bypass Insert for Task:', { title, user_id });

    const adminClient = getSupabaseAdmin();
    const { data, error } = await adminClient
      .from('tasks')
      .insert([{ 
        title, 
        user_id, 
        status: status || 'TODO', 
        priority: priority || 'MEDIUM', 
        category: category || 'General' 
      }])
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('SERVER-SIDE INSERT ERROR:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, updates } = await req.json();

    if (!id || !updates) {
      return NextResponse.json({ error: 'Missing ID or updates' }, { status: 400 });
    }

    console.log('DEBUG: Master Bypass Update for Task:', id, updates);

    const adminClient = getSupabaseAdmin();
    const { data, error } = await adminClient
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('SERVER-SIDE UPDATE ERROR:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
    }

    console.log('DEBUG: Master Bypass Delete for Task:', id);

    const adminClient = getSupabaseAdmin();
    const { error } = await adminClient
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('SERVER-SIDE DELETE ERROR:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
