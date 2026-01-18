import requests
import time
import uuid
import sys

# Default to the port in server.mjs (8787)
SERVER_URL = "http://127.0.0.1:8787/begin_experiment"

def run_test(counter):
    experiment_id = f"test_{int(time.time())}_{counter}"
    
    # Toggle between adding and removing to keep file clean-ish
    if counter % 2 != 0:
        prompt = f"Add a comment '// LATENCY TEST {counter}' to the very top of the file."
    else:
        prompt = f"Remove the comment '// LATENCY TEST {counter - 1}' from the top of the file."
        
    print(f"\n--- Sending Request {counter} ---")
    print(f"ID: {experiment_id}")
    print(f"Prompt: {prompt}")
    
    start = time.time()
    try:
        response = requests.post(SERVER_URL, json={
            "experimentID": experiment_id,
            "prompt": prompt
        })
        duration = time.time() - start
        
        print(f"Status Code: {response.status_code}")
        print(f"Total Roundtrip Duration: {duration:.4f}s")
        
        if response.status_code == 200:
            data = response.json()
            output = data.get("output", "")
            print(f"Output length: {len(output)} chars")
            # print(f"Output preview: {output[:100]}...")
        else:
            print("Error response:", response.text)
            
    except Exception as e:
        print(f"Request failed: {e}")

def main():
    print(f"Targeting: {SERVER_URL}")
    print("Press Enter to send a request. Ctrl+C to exit.")
    
    counter = 1
    try:
        while True:
            input(f"\nPress Enter to run test #{counter}...")
            run_test(counter)
            counter += 1
    except KeyboardInterrupt:
        print("\nExiting.")

if __name__ == "__main__":
    main()
