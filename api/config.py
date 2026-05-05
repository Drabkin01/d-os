"""D-OS Config endpoint — serves public env vars to the frontend.

Add these in Vercel → Project Settings → Environment Variables:
  GOOGLE_CLIENT_ID   — from Google Cloud Console (OAuth 2.0 Web Client)

Never put secret keys here — only public client-side config.
"""

from http.server import BaseHTTPRequestHandler
import json
import os


class handler(BaseHTTPRequestHandler):

    def do_GET(self):
        config = {
            'google_client_id': os.environ.get('GOOGLE_CLIENT_ID', ''),
        }
        body = json.dumps(config).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type',                 'application/json')
        self.send_header('Content-Length',               str(len(body)))
        self.send_header('Access-Control-Allow-Origin',  '*')
        self.send_header('Cache-Control',                'no-cache')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin',  '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.end_headers()

    def log_message(self, fmt, *args):
        pass
