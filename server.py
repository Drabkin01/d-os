#!/usr/bin/env python3
"""D-OS local server — serves static files and proxies Anthropic API calls.

Usage:
  python3 server.py

Requires ANTHROPIC_API_KEY in .env or environment.
No external packages needed — stdlib only.
"""

import http.server
import json
import os
import urllib.request
import urllib.error
from pathlib import Path

PORT = 8080


def load_env():
    """Load .env file into environment (no external deps)."""
    env_path = Path(__file__).parent / '.env'
    try:
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, val = line.split('=', 1)
                    os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))
    except FileNotFoundError:
        pass


class DOSHandler(http.server.SimpleHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path == '/api/config':
            self._handle_config()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/ai':
            self._handle_ai()
        else:
            self.send_error(404)

    def _handle_config(self):
        config = {'google_client_id': os.environ.get('GOOGLE_CLIENT_ID', '')}
        self._ok(config)

    def _handle_ai(self):
        length = int(self.headers.get('Content-Length', 0))
        try:
            body = json.loads(self.rfile.read(length))
        except json.JSONDecodeError:
            self._err(400, 'Invalid JSON body')
            return

        api_key = os.environ.get('ANTHROPIC_API_KEY', '').strip()
        if not api_key:
            self._err(500, 'ANTHROPIC_API_KEY not set. Create a .env file — see README.')
            return

        payload = json.dumps({
            'model': 'claude-haiku-4-5-20251001',
            'max_tokens': 1024,
            'system': body.get('system', ''),
            'messages': body.get('messages', [])
        }).encode('utf-8')

        req = urllib.request.Request(
            'https://api.anthropic.com/v1/messages',
            data=payload,
            headers={
                'x-api-key': api_key,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            }
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read().decode('utf-8'))
                self._ok({'content': result['content'][0]['text']})
        except urllib.error.HTTPError as e:
            detail = e.read().decode('utf-8')
            self._err(502, f'Anthropic API error {e.code}: {detail}')
        except urllib.error.URLError as e:
            self._err(502, f'Network error reaching Anthropic: {e.reason}')
        except Exception as e:
            self._err(500, str(e))

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def _ok(self, data):
        body = json.dumps(data).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(body))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def _err(self, code, msg):
        body = json.dumps({'error': msg}).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(body))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        path = str(args[0]) if args else ''
        if not any(path.startswith(s) for s in ['/css/', '/js/', '/data/', '/assets/', '/favicon']):
            print(f'[D-OS] {fmt % args}')


if __name__ == '__main__':
    load_env()
    os.chdir(Path(__file__).parent)

    api_key = os.environ.get('ANTHROPIC_API_KEY', '')
    print(f'\n  D-OS Local Server')
    print(f'  ─────────────────────────────────')
    print(f'  URL:        http://localhost:{PORT}')
    print(f'  API key:    {"✓ set" if api_key else "✗ NOT SET — add ANTHROPIC_API_KEY to .env"}')
    print(f'  ─────────────────────────────────')
    print(f'  Ctrl+C to stop\n')

    with http.server.HTTPServer(('', PORT), DOSHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\n[D-OS] Server stopped.')
