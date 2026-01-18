#!/usr/bin/env python3
"""
Shutdown Orchestrator Server
"""

import subprocess
import httpx
import sys

ORCHESTRATOR_URL = "http://127.0.0.1:8787"

def kill_by_port():
    """Kill any process listening on port 8787"""
    try:
        # Find process on port 8787
        result = subprocess.run(
            ["lsof", "-ti", ":8787"],
            capture_output=True,
            text=True
        )
        pids = result.stdout.strip().split('\n')
        pids = [p for p in pids if p]
        
        if not pids:
            return False
        
        for pid in pids:
            subprocess.run(["kill", "-9", pid], check=True)
            print(f"   Killed process {pid}")
        
        return True
    except Exception:
        return False

def main():
    print("🛑 Shutting down orchestrator server...")
    
    # Try graceful shutdown first
    try:
        response = httpx.post(f"{ORCHESTRATOR_URL}/shutdown", json={}, timeout=5.0)
        if response.status_code == 200:
            print("✅ Server shutdown initiated gracefully!")
            return
    except httpx.ConnectError:
        print("   Server not responding on port 8787")
    except Exception:
        pass
    
    # Fall back to killing by port
    print("   Attempting force kill...")
    if kill_by_port():
        print("✅ Server forcefully terminated!")
    else:
        print("❌ No server process found on port 8787")
        sys.exit(1)

if __name__ == "__main__":
    main()
