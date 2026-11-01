from tests.conftest import account


def test_profiles_keep_identity_workspace_and_tabs_separate(client, owner):
    primary = client.get('/api/v1/company/profile', headers=owner).json()
    initial = client.get('/api/v1/account/profiles', headers=owner)
    assert initial.status_code == 200
    assert initial.json()['profiles'][0]['company_id'] == primary['id']
    created = client.post('/api/v1/account/profiles', headers=owner, json={'role': 'supplier'})
    assert created.status_code == 200
    supplier_id = created.json()['company_id']
    assert supplier_id != primary['id']
    assert client.post('/api/v1/account/profiles', headers=owner, json={'role':'supplier'}).json()['company_id'] == supplier_id
    seller = {**owner, 'X-Company-Profile': supplier_id}
    profile = client.get('/api/v1/company/profile', headers=seller).json()
    assert profile['name'] == '' and profile['inn'] is None
    assert profile['login_email'] == primary['login_email']
    assert client.put('/api/v1/company/profile', headers=seller, json={'profile_revision':profile['profile_revision'], 'name':'Отдельный поставщик', 'inn':'1234567890', 'contact_name':'Контакт поставщика'}).status_code == 200
    assert client.get('/api/v1/company/profile', headers=owner).json()['name'] == primary['name']
    assert client.get('/api/v1/company/profile', headers=owner).json()['contact_name'] is None
    state = client.get('/api/v1/prototype/state', headers=seller).json()
    assert state['state']['role'] == 'supplier'
    assert state['state']['vendorProducts'] == [] and state['state']['needs'] == []
    state['state']['vendorProducts'] = [{'id':'own-item','name':'Свой товар'}]
    assert client.put('/api/v1/prototype/state', headers=seller, json={'revision':state['revision'],'state':state['state']}).status_code == 200
    assert client.get('/api/v1/prototype/state', headers=owner).json()['state']['vendorProducts'] == []
    state = client.get('/api/v1/prototype/state', headers=seller).json()
    state['state']['role'] = 'buyer'
    assert client.put('/api/v1/prototype/state', headers=seller, json={'revision':state['revision'],'state':state['state']}).status_code == 409


def test_profile_selection_never_grants_access_to_another_account(client, owner):
    other = account(client, email='other-profile@example.com')
    other_id = client.post('/api/v1/account/profiles', headers=other, json={'role':'supplier'}).json()['company_id']
    forged = {**owner, 'X-Company-Profile':other_id}
    for path in ['/api/v1/company/profile','/api/v1/prototype/state','/api/v1/prototype/scene']:
        assert client.get(path, headers=forged).status_code == 403
    assert client.post('/api/v1/account/profiles', headers=owner, json={'role':'admin'}).status_code == 422
    assert client.get('/api/v1/account/profiles').status_code == 401
