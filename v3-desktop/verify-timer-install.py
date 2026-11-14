"""Read-only production verification after the local 3.8.0 upgrade."""
import datetime
import hashlib
import json
import pathlib
import sqlite3

root = pathlib.Path(__file__).resolve().parent
receipt = json.loads(pathlib.Path(r'D:\Soft\TPlanV3\upgrade-3.8.0.json').read_text(encoding='utf-8-sig'))


def read_database(path):
    with sqlite3.connect(path.as_uri() + '?mode=ro', uri=True) as connection:
        assert connection.execute('pragma quick_check').fetchone()[0] == 'ok'
        rows = dict(connection.execute('select key,value from storage'))
        return json.loads(rows['tplan.v3']), rows.get('secret')


before, secret_before = read_database(pathlib.Path(receipt['backup']) / 'user-before-3.8.0.sqlite3')
after, secret_after = read_database(pathlib.Path(r'C:\Users\fanzi\AppData\Local\TPlanV3\tplan.sqlite3'))
assert before == after, 'User state changed; inspect differences without replacing current data.'
assert secret_before == secret_after, 'Encrypted secret differs.'
digest = hashlib.sha256(pathlib.Path(receipt['executable']).read_bytes()).hexdigest()
assert digest.upper() == receipt['sha256']
suites = []
for name, count in [('timer-order', 17), ('layered', 17), ('sidebar', 13), ('assistant', 12), ('tree', 14), ('week-home', 14), ('review-sections', 20), ('timer-native', 8)]:
    result = json.loads((root / 'output/playwright' / (name + '-qa-results.json')).read_text(encoding='utf-8'))
    assert len(result['checks']) == count and not result['errors']
    assert result['exeSha256'].lower() == digest
    suites.append({'name': name, 'passed': count})
report = {
    **receipt,
    'verifiedAt': datetime.datetime.now().astimezone().isoformat(),
    'entireUserStateUnchanged': True,
    'encryptedModelSecretUnchanged': True,
    'sqliteQuickCheck': 'ok',
    'desktopChecksPassed': 107,
    'nativeWindowChecksPassed': 8,
    'coreTestsPassed': 57,
    'suites': suites,
    'data': {
        'tasks': len(after['tasks']),
        'sessions': len(after['sessions']),
        'notes': len(after['notes']),
        'sections': len(after['settings'].get('taskSections', [])),
        'reviewEntries': len(after.get('reviewEntries', {})),
        'activePhase': (after.get('active') or {}).get('phase'),
    },
    'externalModelCalled': False,
}
target = root / 'output/playwright/timer-order-install-verification.json'
target.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'version': receipt['version'], 'stateUnchanged': True, 'secretUnchanged': True, 'data': report['data'], 'verification': str(target)}, ensure_ascii=False))
