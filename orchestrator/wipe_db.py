#!/usr/bin/env python3
"""
Wipe Supabase Database - Deletes all behavior_events
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SECRET_KEY")


def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ Error: SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env")
        sys.exit(1)
    
    print("╔══════════════════════════════════════════════════════════════╗")
    print("║          🗑️  SUPABASE DATABASE WIPE UTILITY  🗑️              ║")
    print("╚══════════════════════════════════════════════════════════════╝")
    print()
    print(f"  📍 Target: {SUPABASE_URL}")
    print(f"  📋 Table:  behavior_events")
    print()
    
    # Confirm before wiping
    confirm = input("⚠️  Are you sure you want to DELETE ALL behavior_events? (type 'yes' to confirm): ")
    
    if confirm.lower() != 'yes':
        print("\n❌ Aborted. No data was deleted.")
        sys.exit(0)
    
    print("\n🔄 Connecting to Supabase...")
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    try:
        # Get count before deletion
        count_response = supabase.table("behavior_events").select("id", count="exact").execute()
        count_before = count_response.count or 0
        
        print(f"📊 Found {count_before} events in database")
        
        if count_before == 0:
            print("\n✅ Database is already empty. Nothing to delete.")
            sys.exit(0)
        
        # Delete all rows - use neq with empty string to match all UUIDs
        print("🗑️  Deleting all events...")
        supabase.table("behavior_events").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        
        # Verify deletion
        verify_response = supabase.table("behavior_events").select("id", count="exact").execute()
        count_after = verify_response.count or 0
        
        if count_after == 0:
            print(f"\n✅ Successfully deleted {count_before} events!")
            print("   Database is now empty.")
        else:
            print(f"\n⚠️  Warning: {count_after} events remain in database")
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)
    
    print("\n" + "═" * 60)
    print("Done! 🎉")


if __name__ == "__main__":
    main()
