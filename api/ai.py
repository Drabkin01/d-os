"""D-OS AI endpoint — Google Gemini 1.5 Flash (free tier).

Free tier: 15 req/min · 1M tokens/min · 1,500 req/day
Get a key at: https://aistudio.google.com/  (no card required)
Add GEMINI_API_KEY to Vercel → Project Settings → Environment Variables.
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import urllib.request
import urllib.error

GEMINI_MODEL = 'gemini-1.5-flash'


class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        try:
            body = json.loads(self.rfile.read(length))
        except (json.JSONDecodeError, ValueError):
            self._err(400, 'Invalid JSON body')
            return

        api_key = os.environ.get('GEMINI_API_KEY', '').strip()
        if not api_key:
            self._err(500, (
                'GEMINI_API_KEY not configured. '
                'Get a free key at aistudio.google.com, then add it in '
                'Vercel → Project Settings → Environment Variables.'
            ))
            return

        system_text = body.get('system', '')
        messages    = body.get('messages', [])
        user_text   = messages[0]['content'] if messages else ''

        payload = json.dumps({
            'systemInstruction': {
                'parts': [{'text': system_text}]
            },
            'contents': [
                {'role': 'user', 'parts': [{'text': user_text}]}
            ],
            'generationConfig': {
                'maxOutputTokens': 1024,
                'temperature': 0.7,
                'responseMimeType': 'application/json'
            }
        }).encode('utf-8')

        url = (
            f'https://generativelanguage.googleapis.com/v1beta/models/'
            f'{GEMINI_MODEL}:generateContent?key={api_key}'
        )

        req = urllib.request.Request(
            url,
            data=payload,
            headers={'Content-Type': 'application/json'}
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read().decode('utf-8'))
                text   = result['candidates'][0]['content']['parts'][0]['text']
                self._ok({'content': text})

        except urllib.error.HTTPError as e:
            detail = e.read().decode('utf-8')
            try:
                err_json = json.loads(detail)
                msg = err_json.get('error', {}).get('message', detail)
            except Exception:
                msg = detail
            self._err(502, f'Gemini error: {msg}')

        except urllib.error.URLError as e:
            self._err(502, f'Network error: {e.reason}')

        except (KeyError, IndexError) as e:
            self._err(502, f'Unexpected response format from Gemini: {e}')

        except Exception as e:
            self._err(500, str(e))

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin',  '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def _ok(self, data):
        body = json.dumps(data).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type',   'application/json')
        self.send_header('Content-Length', str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def _err(self, code, msg):
        body = json.dumps({'error': msg}).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type',   'application/json')
        self.send_header('Content-Length', str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        pass  # silence Vercel request logs
