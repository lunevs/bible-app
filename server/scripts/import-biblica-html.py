"""Import only the four Gospels from textutil's HTML export of the supplied RTF."""
import html
import json
import re
import sys
from pathlib import Path

if len(sys.argv) != 2:
    raise SystemExit('Usage: python3 import-biblica-html.py Biblica.html')
source = Path(sys.argv[1]).read_text()
names = {'Матфей': ('Мф', 28), 'Марк': ('Мк', 16), 'Лука': ('Лк', 24), 'Иоанн': ('Ин', 21)}
books = {}
book = None
chapter = None
verse = None
notes = False
for raw in re.findall(r'<p\b[^>]*>(.*?)</p>', source, re.S):
    plain = html.unescape(re.sub(r'<[^>]+>', '', raw)).strip()
    if plain == 'Деяния апостолов':
        break
    name = next((n for n in names if plain == n + ' рассказывает об Иисусе'), None)
    if name:
        code, _ = names[name]
        book = {'name': name, 'chapters': []}
        books[code] = book
        chapter = verse = None
        continue
    if book is None:
        continue
    if re.fullmatch(r'Глава \d+', plain):
        chapter = []
        book['chapters'].append(chapter)
        verse = None
        notes = False
        continue
    if plain == 'Примечания':
        notes = True
    if notes or chapter is None or not plain:
        continue
    # Bold titles and cross references are not part of a verse.
    if '<b>' in raw and not re.search(r'<sup>\d+', raw):
        continue
    marked = re.sub(r'<sup>(.*?)</sup>', lambda m: '\x01' + m[1] + '\x02' if re.fullmatch(r'\d+', m[1]) else '', raw)
    marked = html.unescape(re.sub(r'<[^>]+>', '', marked))
    for part in re.split(r'(\x01\d+\x02)', marked):
        if part.startswith('\x01'):
            verse = {'v': int(part[1:-1]), 't': ''}
            chapter.append(verse)
        elif part.strip() and verse is not None:
            verse['t'] += (' ' if verse['t'] else '') + part.strip()

assert set(books) == {'Мф', 'Мк', 'Лк', 'Ин'}
for _, (code, expected) in names.items():
    assert len(books[code]['chapters']) == expected, code
    for index, ch in enumerate(books[code]['chapters']):
        assert ch and all(v['t'] for v in ch), (code, index + 1)
        assert [v['v'] for v in ch] == sorted(set(v['v'] for v in ch)), (code, index + 1)
target = Path(__file__).resolve().parents[1] / 'private-bible' / 'biblica.json'
target.parent.mkdir(exist_ok=True)
target.write_text(json.dumps({'translation': 'Новый русский перевод (Biblica)', 'source': 'Предоставленный пользователем RTF Biblica', 'books': books}, ensure_ascii=False))
print(target)
for code, book in books.items():
    print(code, len(book['chapters']), sum(len(ch) for ch in book['chapters']))
