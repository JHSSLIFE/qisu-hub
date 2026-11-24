import importlib
import os
import sys
import tempfile

os.environ['QISUSHUO_DATA']=tempfile.mkdtemp(prefix='qisushuo-tests-')
sys.path.insert(0,os.path.dirname(os.path.dirname(__file__)))
from fastapi.testclient import TestClient
import server

HEADERS={'X-Qisushuo':'workspace'}

def client():
    c=TestClient(server.app)
    assert c.get('/api/bootstrap').status_code==200
    return c

def records(c):
    return c.get('/api/bootstrap').json()['records']

def test_first_run_and_isolation():
    a,b=client(),client()
    assert len(records(a))==50
    row=next(r for r in records(a) if r['id']=='k1')
    row['title']='只有我的研究空间可见'
    assert a.post('/api/records',json=row,headers=HEADERS).status_code==200
    assert next(r for r in records(b) if r['id']=='k1')['title']!=row['title']
    assert next(r for r in records(a) if r['id']=='k1')['title']==row['title']

def test_versions_and_optimistic_concurrency():
    c=client();row=next(r for r in records(c) if r['id']=='k1');old=row['body']
    row['body']='修改后的研究记录'
    response=c.post('/api/records',json=row,headers=HEADERS)
    assert response.status_code==200 and response.json()['version']==2
    assert c.post('/api/records',json=row,headers=HEADERS).status_code==409
    versions=c.get('/api/records/k1/versions').json()
    assert [v['version'] for v in versions]==[2,1]
    assert versions[-1]['body']==old

def test_chinese_search_and_query_characters():
    c=client()
    assert 'k1' in c.get('/api/search',params={'q':'斗拱'}).json()['ids']
    assert 'k1' in c.get('/api/search',params={'q':'木构建筑'}).json()['ids']
    for query in ['"','%','_',"' OR 1=1 --",'不存在的天外文物']:
        result=c.get('/api/search',params={'q':query})
        assert result.status_code==200

def test_import_batch_transaction():
    c=client();row=records(c)[0].copy();row.update(id='test_import',version=0,title='新增笔记')
    invalid={**row,'id':'invalid','title':''}
    assert c.post('/api/imports',json={'records':[row,invalid]},headers=HEADERS).status_code==422
    assert not any(r['id']=='test_import' for r in records(c))
    assert c.post('/api/imports',json={'records':[row]},headers=HEADERS).status_code==200

def test_archive_keeps_historical_source():
    c=client();row=next(r for r in records(c) if r['id']=='s1');row['archived']=True
    assert c.post('/api/records',json=row,headers=HEADERS).status_code==200
    assert c.get('/api/records/s1/versions').json()[-1]['version']==1
    assert 's1' not in c.get('/api/search',params={'q':'木构营造读书札记'}).json()['ids']

def test_backup_roundtrip_preserves_revisions():
    c=client();row=next(r for r in records(c) if r['id']=='d1');row['body']='新的稿件'
    assert c.post('/api/records',json=row,headers=HEADERS).status_code==200
    backup=c.get('/api/export').json();other=client()
    assert other.post('/api/restore',json=backup,headers=HEADERS).status_code==200
    assert sorted(records(other),key=lambda r:r['id'])==sorted(backup['records'],key=lambda r:r['id'])
    assert len(other.get('/api/records/d1/versions').json())==2

def test_guards_and_malformed_data():
    c=client();row=records(c)[0]
    assert c.post('/api/records',json=row).status_code==403
    assert c.post('/api/records',json=row,headers={**HEADERS,'Origin':'https://evil.example'}).status_code==403
    assert c.post('/api/records',json={**row,'category':{}},headers=HEADERS).status_code==422
    assert c.get('/server.py').status_code==404
    assert c.get('/data/research.sqlite3').status_code==404
    stranger=TestClient(server.app)
    assert stranger.get('/api/export').status_code==401

def test_packaged_assets_and_static_boundary(tmp_path,monkeypatch):
    # Use an isolated fake build; CI does not need a production bundle for backend tests.
    dist=tmp_path/'dist';(dist/'icons').mkdir(parents=True)
    for name,text in {'index.html':'online','app.html':'local',
                      'manifest.webmanifest':'{"start_url":"./app.html"}',
                      'sw.js':'// static worker','icons/icon-192.png':'png'}.items():
        (dist/name).write_text(text)
    monkeypatch.setattr(server,'ROOT',tmp_path)
    c=TestClient(server.app)
    assert c.get('/').text=='online'
    assert c.get('/preview.html').text=='online'
    assert c.get('/app.html').text=='local'
    assert c.get('/manifest.webmanifest').headers['content-type'].startswith('application/manifest+json')
    worker=c.get('/sw.js')
    assert worker.status_code==200
    assert worker.headers['content-type'].startswith('application/javascript')
    assert worker.headers['cache-control']=='no-cache'
    for name in ['/.git/config','/.env','/launch.py','/server.py','/data/research.sqlite3','/icons/other.png']:
        assert c.get(name).status_code==404

def test_no_evidence_and_extract_fallback(monkeypatch):
    monkeypatch.delenv('OPENAI_API_KEY',raising=False)
    c=client()
    absent=c.post('/api/assistant',json={'question':'量子火星不存在概念'},headers=HEADERS).json()
    assert absent['citations']==[] and '资料不足' in absent['text']
    result=c.post('/api/assistant',json={'question':'斗拱的研究方法'},headers=HEADERS).json()
    assert result['mode']=='extract' and result['citations']
    keys={r['id'] for r in records(c)}
    assert all(citation['id'] in keys for citation in result['citations'])

def test_assistant_scope_with_large_library(monkeypatch):
    monkeypatch.delenv('OPENAI_API_KEY',raising=False)
    c=client()
    template=next(r for r in records(c) if r['id']=='k1')
    batch=[{**template,'id':f'scoped_{i}','title':f'斗拱新增记录{i}','version':0} for i in range(40)]
    assert c.post('/api/imports',json={'records':batch},headers=HEADERS).status_code==200
    result=c.post('/api/assistant',json={'question':'斗拱','scope':'knowledge'},headers=HEADERS)
    assert result.status_code==200
    kinds={r['id']:r['kind'] for r in records(c)}
    assert result.json()['citations']
    assert all(kinds[citation['id']]=='knowledge' for citation in result.json()['citations'])
    source=c.post('/api/assistant',json={'question':'木构','scope':'source'},headers=HEADERS).json()
    assert source['citations'] and all(kinds[x['id']]=='source' for x in source['citations'])
    assert c.post('/api/assistant',json={'question':'斗拱','scope':'draft'},headers=HEADERS).status_code==422
