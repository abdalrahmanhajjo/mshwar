"""Native PostgreSQL race tests: the last seat, and one guide in one place. Requires a separate EMPTY test database.
DATABASE_URL=... python tests/concurrency.py
Never run against production. No truncation or database deletion is performed.
"""
import os
import subprocess
import sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import psycopg
root = Path(__file__).resolve().parents[1]
url = os.environ['DATABASE_URL']
with psycopg.connect(url) as c:
    if c.execute("SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='app')").fetchone()[0]:
        raise RuntimeError('Requires an EMPTY test database without app schema')
subprocess.run([sys.executable,str(root/'scripts/migrate.py')],check=True)
with psycopg.connect(url) as c:
    c.execute((root/'tests/seed.sql').read_text())
    c.execute("UPDATE app.slots SET capacity=1")
barrier=Barrier(2)
def reserve(i):
    try:
        with psycopg.connect(url) as c:
            c.execute("SET LOCAL lock_timeout='10s'")
            actor=f'00000000-0000-0000-0000-{i:012}'
            c.execute("SELECT set_config('app.user_id',%s,true)",(actor,))
            barrier.wait(timeout=10)
            c.execute("""SELECT app.reserve_booking(%s,'40000000-0000-0000-0000-000000000001',1,%s,%s,
              '50000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001',true)""",
              (actor,f'concurrency-key-{i}',f'concurrency-hash-{i}'))
        return 'reserved'
    except psycopg.errors.RaiseException as e:
        if 'insufficient capacity' not in str(e):
            raise
        return 'sold_out'
with ThreadPoolExecutor(max_workers=2) as executor:
    results=list(executor.map(reserve,[1,2]))
assert sorted(results)==['reserved','sold_out'],results
with psycopg.connect(url) as c:
    slot_id='40000000-0000-0000-0000-000000000001'
    assert c.execute('SELECT reserved FROM app.slots WHERE id=%s',(slot_id,)).fetchone()[0]==1
    assert c.execute('SELECT count(*) FROM app.bookings WHERE slot_id=%s',(slot_id,)).fetchone()[0]==1
print('PASS: two independent connections contested the final seat; exactly one reservation committed')

# One guide, one place (061): two travellers book two overlapping runs of the same guide
# at the same moment. The per-guide lock in the booking guard lets exactly one through.
GUIDE_SEED = """
SET search_path=app,public;
INSERT INTO app.users(id,auth_issuer,auth_subject,display_name) VALUES
 ('00000000-0000-0000-0000-000000000003','test','guide','Test Guide'),
 ('00000000-0000-0000-0000-000000000004','test','maya','Test Maya'),
 ('00000000-0000-0000-0000-000000000005','test','omar','Test Omar');
INSERT INTO app.organizations(id,name,slug,verification) VALUES
 ('10000000-0000-0000-0000-000000000003','Synthetic Guide','synthetic-guide','verified');
INSERT INTO app.guide_profiles(user_id,tier,display_name,slug,status,organization_id) VALUES
 ('00000000-0000-0000-0000-000000000003','licensed','Test Guide','synthetic-guide','approved','10000000-0000-0000-0000-000000000003');
INSERT INTO app.guide_availability(guide_profile_id,min_notice_hours,max_tours_per_day,buffer_minutes,travel_aware)
 SELECT id,0,4,30,false FROM app.guide_profiles WHERE slug='synthetic-guide';
INSERT INTO app.venues(id,organization_id,name,address,location,location_source) VALUES
 ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000003','Synthetic meeting point','Synthetic address',
 ST_SetSRID(ST_MakePoint(35.5018,33.8938),4326)::geography,'synthetic');
INSERT INTO app.experiences(id,organization_id,venue_id,slug,title,status,booking_mode,duration_minutes,max_party,setting) VALUES
 ('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000003',
 'synthetic-morning','Synthetic morning walk','draft','request',120,8,'outdoor'),
 ('30000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000003',
 'synthetic-noon','Synthetic noon walk','draft','request',120,8,'outdoor');
INSERT INTO app.slots(id,experience_id,starts_at,ends_at,capacity,authoritative,source,observed_at) VALUES
 ('40000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000003',now()+interval '7 days',now()+interval '7 days 2 hours',8,true,'synthetic',now()),
 ('40000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000004',now()+interval '7 days 1 hour',now()+interval '7 days 3 hours',8,true,'synthetic',now());
INSERT INTO app.price_rules(id,experience_id,currency,price_type,unit,amount_minor,valid_during,source) VALUES
 ('50000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000003','USD','fixed','person',2500,'(,)','synthetic'),
 ('50000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000004','USD','fixed','person',2500,'(,)','synthetic');
INSERT INTO app.policies(id,experience_id,version,cancellation_rules,terms_text) VALUES
 ('60000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000003',1,'{}','Synthetic policy; no commercial effect'),
 ('60000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000004',1,'{}','Synthetic policy; no commercial effect');
UPDATE app.experiences SET status='published' WHERE id IN ('30000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000004');
"""
with psycopg.connect(url) as c:
    c.execute(GUIDE_SEED)
guide_barrier=Barrier(2)
def book_guide(i):
    slot, rule, policy = (f'40000000-0000-0000-0000-00000000000{i-1}', f'50000000-0000-0000-0000-00000000000{i-1}',
                          f'60000000-0000-0000-0000-00000000000{i-1}')
    try:
        with psycopg.connect(url) as c:
            c.execute("SET LOCAL lock_timeout='10s'")
            actor=f'00000000-0000-0000-0000-{i:012}'
            c.execute("SELECT set_config('app.user_id',%s,true)",(actor,))
            guide_barrier.wait(timeout=10)
            c.execute("SELECT app.reserve_booking(%s,%s,2,%s,%s,%s,%s,false)",
              (actor,slot,f'guide-race-key-{i}',f'guide-race-hash-{i}',rule,policy))
        return 'reserved'
    except psycopg.errors.ExclusionViolation as e:
        if 'another tour' not in str(e):
            raise
        return 'guide_busy'
with ThreadPoolExecutor(max_workers=2) as executor:
    results=list(executor.map(book_guide,[4,5]))
assert sorted(results)==['guide_busy','reserved'],results
with psycopg.connect(url) as c:
    booked=c.execute("SELECT count(*) FROM app.bookings WHERE organization_id='10000000-0000-0000-0000-000000000003'").fetchone()[0]
    assert booked==1,booked
print('PASS: two connections booked two overlapping runs of one guide; exactly one booking committed')
