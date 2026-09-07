from sqlalchemy import select
from app.models import User
from conftest import TestingSession


def test_personal_progress_resume_conflict_and_finish(authenticated_client):
    c = authenticated_client
    assert c.get('/api/onboarding').json() == {'step': 0, 'status': 'new', 'revision': 0}
    body = {'step': 2, 'status': 'in_progress', 'expected_revision': 0}
    assert c.put('/api/onboarding', json=body).json()['revision'] == 1
    assert c.get('/api/onboarding').json()['step'] == 2
    assert c.put('/api/onboarding', json=body).status_code == 409
    assert c.put('/api/onboarding', json={**body, 'expected_revision': 1, 'status': 'completed'}).status_code == 422
    assert c.put('/api/onboarding', json={'step': 7, 'status': 'completed', 'expected_revision': 1}).status_code == 200
    assert c.put('/api/onboarding', json={'step': 0, 'status': 'in_progress', 'expected_revision': 2}).status_code == 200
    c.post('/api/auth/logout')
    assert c.get('/api/onboarding').status_code == 401
    c.post('/api/auth/login', json={'email': 'ana@prisma.com', 'password': 'contrasena-segura'})
    assert c.get('/api/onboarding').json()['revision'] == 3


def test_tenant_isolation_and_no_target_override(authenticated_client):
    c = authenticated_client
    c.put('/api/onboarding', json={'step': 4, 'status': 'in_progress', 'expected_revision': 0})
    c.post('/api/auth/register', json={'agency_name': 'Other', 'name': 'Other', 'email': 'other@example.com', 'password': 'a-safe-password'})
    assert c.get('/api/onboarding').json()['step'] == 0
    assert c.put('/api/onboarding', json={'step': 0, 'status': 'in_progress', 'expected_revision': 0, 'user_id': 'other'}).status_code == 422
    c.post('/api/auth/login', json={'email': 'ana@prisma.com', 'password': 'contrasena-segura'})
    assert c.get('/api/onboarding').json()['step'] == 4
    with TestingSession.begin() as db:
        owner = db.scalar(select(User).where(User.email == 'ana@prisma.com'))
        db.add(User(agency_id=owner.agency_id, name='Teammate', email='team@example.com', password_hash=owner.password_hash))
    c.post('/api/auth/login', json={'email': 'team@example.com', 'password': 'contrasena-segura'})
    assert c.get('/api/onboarding').json()['status'] == 'new'


def test_operator_and_suspended_agency(authenticated_client):
    c = authenticated_client
    with TestingSession.begin() as db:
        u = db.scalar(select(User).where(User.email == 'ana@prisma.com'))
        u.role = 'operator'
    assert c.get('/api/onboarding').status_code == 200
    assert c.put('/api/onboarding', json={'step': 7, 'status': 'completed', 'expected_revision': 0}).status_code == 422
    assert c.put('/api/onboarding', json={'step': 2, 'status': 'completed', 'expected_revision': 0}).status_code == 200
    with TestingSession.begin() as db:
        db.scalar(select(User).where(User.email == 'ana@prisma.com')).agency.is_active = False
    assert c.get('/api/onboarding').status_code == 403
    assert c.put('/api/onboarding', json={'step': 0, 'status': 'in_progress', 'expected_revision': 1}).status_code == 403
