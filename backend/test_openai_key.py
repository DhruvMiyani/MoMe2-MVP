"""Test if OpenAI API key is working"""
import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

api_key = os.getenv("OPENAI_API_KEY")

print("Testing OpenAI API Key...")
print(f"Key present: {bool(api_key)}")
print(f"Key starts with: {api_key[:10] if api_key else 'N/A'}...")

try:
    client = OpenAI(api_key=api_key)

    response = client.chat.completions.create(
        model="gpt-3.5-turbo",  # Use cheaper model for testing
        messages=[
            {"role": "user", "content": "Say 'hello' if you can read this"}
        ],
        max_tokens=10
    )

    print("\n✅ OpenAI API key is VALID!")
    print(f"Response: {response.choices[0].message.content}")
    print(f"Model: {response.model}")
    print(f"Tokens: {response.usage.total_tokens}")

except Exception as e:
    print(f"\n❌ OpenAI API Error: {str(e)}")
    import traceback
    traceback.print_exc()
