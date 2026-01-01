import requests
import time
API_BASE = 'http://127.0.0.1:8000'
username = f'dbg_{int(time.time())}'
password = 'TestPass123!'
print('Registering:', username)
requests.post(f'{API_BASE}/api/v1/auth/register/', data={'username': username, 'password': password})
tr = requests.post(f'{API_BASE}/api/v1/auth/token/', data={'username': username, 'password': password})
print('Token status', tr.status_code)
print('Token body', tr.text)
access = tr.json().get('access')
headers = {'Authorization': f'Bearer {access}'}
print('Patching profile...')
pr = requests.patch(f'{API_BASE}/api/v1/me/profile/', headers=headers, json={'display_name': 'DBG Tester', 'social_links': [{'type': 'twitter', 'url': 'https://twitter.com/dbgtest'}]})
print('PATCH status:', pr.status_code)
print('PATCH body:', pr.text)
print('Getting /api/v1/me/')
me = requests.get(f'{API_BASE}/api/v1/me/', headers=headers)
print('ME status', me.status_code)
print('ME body', me.text)
# fetch the public user profile
print('Fetching user profile...')
uid = me.json().get('id')
up = requests.get(f'{API_BASE}/api/v1/users/{uid}/profile/')
print('USERPROFILE status', up.status_code)
print('USERPROFILE body', up.text)
