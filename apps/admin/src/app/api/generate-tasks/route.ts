import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize the Admin client with Service Role Key to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // This is NOT public, server-side only
);

export async function POST(req: Request) {
  try {
    const { weddingType, guestCount, selectedBrideId, shouldAssign } = await req.json();

    console.log('DEBUG: AI Generating tasks for:', { weddingType, guestCount, selectedBrideId, shouldAssign });

    // 1. Generate Tasks
    const taskDatabase: Record<string, any[]> = {
      Beach: [
        { title: 'Secure Beach Permit', category: 'Venue', priority: 'HIGH' },
        { title: 'Buy Tide-Safe Decorations', category: 'Decor', priority: 'MEDIUM' },
        { title: 'Hire Sand-Friendly Sound System', category: 'Technique', priority: 'HIGH' },
        { title: 'Arrange Flip-Flop Basket for Guests', category: 'Guest Experience', priority: 'LOW' },
        { title: 'Book Sunset Photography Session', category: 'Photo', priority: 'MEDIUM' }
      ],
      Traditional: [
        { title: 'Book Cathedral/Church Ceremony', category: 'Venue', priority: 'HIGH' },
        { title: 'Design Formal Invitation Suites', category: 'Stationery', priority: 'MEDIUM' },
        { title: 'Select Traditional Multi-Tier Cake', category: 'Food', priority: 'MEDIUM' },
        { title: 'Hire Classical String Quartet', category: 'Music', priority: 'HIGH' },
        { title: 'Organize Reception Seating Chart', category: 'Planning', priority: 'HIGH' }
      ],
      Modern: [
        { title: 'Rent Industrial Loft Workspace/Venue', category: 'Venue', priority: 'HIGH' },
        { title: 'Coordinate Neon Signage Install', category: 'Decor', priority: 'LOW' },
        { title: 'Design Minimalist E-Invitations', category: 'Stationery', priority: 'MEDIUM' },
        { title: 'Book Live Fusion Band/DJ', category: 'Music', priority: 'MEDIUM' },
        { title: 'Hire Gourmet Food Truck Mix', category: 'Food', priority: 'HIGH' }
      ],
      Rustic: [
        { title: 'Book Restored Barn Venue', category: 'Venue', priority: 'HIGH' },
        { title: 'Gather Reclaimed Wood Table Decor', category: 'Decor', priority: 'MEDIUM' },
        { title: 'Hire Country Folk Acoustic Duo', category: 'Music', priority: 'MEDIUM' },
        { title: 'Order Naked Cake with Wildflowers', category: 'Food', priority: 'LOW' },
        { title: 'Coordinate Hay Bale Seating', category: 'Decor', priority: 'MEDIUM' }
      ]
    };

    const baseTasks = taskDatabase[weddingType as string] || taskDatabase.Traditional;
    const finalTasks = [...baseTasks];

    if (guestCount > 150) {
      finalTasks.push({ title: 'Hire Additional Security/Staff', category: 'Staff', priority: 'MEDIUM' });
    }

    // 2. Optional: Bulk Assign using Service Role (Bypass RLS)
    if (shouldAssign && selectedBrideId) {
      console.log('DEBUG: Bypassing RLS with Admin Client for Bridge:', selectedBrideId);
      
      const tasksToInsert = finalTasks.map(t => ({
        ...t,
        user_id: selectedBrideId,
        status: 'TODO'
      }));

      const { data, error } = await supabaseAdmin
        .from('tasks')
        .insert(tasksToInsert)
        .select();

      if (error) {
        console.error('SERVER-SIDE INSERT ERROR:', error.message);
        throw new Error(error.message);
      }

      return NextResponse.json({ success: true, count: data.length });
    }

    // Default: Just return the suggestions
    return NextResponse.json({ tasks: finalTasks });
  } catch (error: any) {
    console.error('API ROUTE ERROR:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
