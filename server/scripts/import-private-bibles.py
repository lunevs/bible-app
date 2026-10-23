import re,json,zipfile,sys,xml.etree.ElementTree as E
from pathlib import Path
out=Path(__file__).resolve().parents[1]/'private-bible'
out.mkdir(exist_ok=True)
if len(sys.argv)!=3: raise SystemExit('Usage: python3 import-private-bibles.py IBS.txt RBO.epub')
books={'Мф':('Матфей',28),'Мк':('Марк',16),'Лк':('Лука',24),'Ин':('Иоанн',21)}
# IBS RTF converted with macOS textutil. Chapter and verse markers are separate lines.
s=Path(sys.argv[1]).read_text(); result={}
for code,name in [('Мф','Матфея'),('Мк','Марка'),('Лк','Луки'),('Ин','Иоанна')]:
 start=s.index('\nОт '+name+'\n'); end=s.find('\nОт ',start+1)
 if code=='Ин':end=s.index('\nДеяния',start)
 section=s[start:end if end!=-1 else None];chapters=[];current=None
 for line in section.splitlines():
  line=line.strip()
  if re.fullmatch(r'Глава \d+',line):chapters.append([]);current=None;continue
  if not chapters or not line or line.startswith('{'):continue
  m=re.match(r'^(\d+)\s+(.+)$',line)
  if m:
   current={'v':int(m[1]),'t':m[2]};chapters[-1].append(current)
  elif current:current['t']+=' '+line
 result[code]={'name':name,'chapters':chapters}
 assert len(chapters)==books[code][1],(code,len(chapters))
 for ch in chapters:
  assert [v['v'] for v in ch]==sorted(set(v['v'] for v in ch)),code
(out/'ibs.json').write_text(json.dumps({'translation':'IBS Biblica (из личного файла)','source':'Предоставленный пользователем IBS Biblica RTF','books':result},ensure_ascii=False))
# RBO EPUB: keep merged verses as ranges; never invent individual verse boundaries.
p=sys.argv[2]
ns={'n':'http://www.daisy.org/z3986/2005/ncx/'};h={'h':'http://www.w3.org/1999/xhtml'};result={}
with zipfile.ZipFile(p) as z:
 root=E.fromstring(z.read(next(n for n in z.namelist() if n.endswith('.ncx'))))
 for code,(name,expected) in books.items():
  nav=next(pt for pt in root.findall('.//n:navPoint',ns) if pt.find('n:navLabel/n:text',ns).text.startswith(name+' рассказывает'))
  files=list(dict.fromkeys(c.attrib['src'].split('#')[0] for c in nav.findall('.//n:content',ns)))
  chapters=[];current=None
  for file in files:
   doc=E.fromstring(z.read('OPS/'+file))
   for el in doc.findall('.//h:p',h):
    text=''.join(el.itertext()).strip()
    if re.fullmatch(r'Глава \d+',text):chapters.append([]);current=None;continue
    if el.attrib.get('class')!='p1' or not chapters:continue
    # Convert superscript verse labels to explicit markers, preserving surrounding text.
    def tokens(e):
     value=e.text or ''
     for child in e:
      tag=child.tag.split('}')[-1]
      if tag=='sup':
       label=''.join(child.itertext())
       value+='\x01'+label+'\x02'
      elif tag!='a':value+=tokens(child)
      value+=child.tail or ''
     return value
    raw=tokens(el)
    for part in re.split(r'(\x01[^\x02]+\x02)',raw):
     if part.startswith('\x01'):
      label=part[1:-1];nums=re.findall(r'\d+',label)
      if not nums:continue
      current={'v':int(nums[0]),'t':''}
      if len(nums)>1:current['endVerse']=int(nums[-1])
      current['label']=label;chapters[-1].append(current)
     elif part.strip():
      if current is None:current={'v':1,'t':''};chapters[-1].append(current)
      current['t']+=(' ' if current['t'] else '')+part.strip()
  assert len(chapters)==expected,(code,len(chapters))
  assert all(v['t'] for ch in chapters for v in ch),code
  result[code]={'name':name,'chapters':chapters}
# В EPUB часть номеров потеряна внутри абзацев. Не делим текст по догадке:
# сохраняем такие абзацы объединённым диапазоном. Отсутствующие стихи не добавляем.
merged={'Мф':{3:[8],6:[33]},'Мк':{14:[55]},'Лк':{2:[7],17:[7],19:[25],23:[25]},'Ин':{19:[9],20:[5]}}
canonical=json.loads((Path(__file__).resolve().parents[1]/'data/bible/synodal.json').read_text())
for code,book in result.items():
 for i,ch in enumerate(book['chapters']):
  covered={k for v in ch for k in range(v['v'],v.get('endVerse',v['v'])+1)}
  for verse in sorted({v['v'] for v in canonical['books'][code]['chapters'][i]}-covered):
   if verse in merged.get(code,{}).get(i+1,[]):
    previous=next(v for v in ch if v['v']==verse-1)
    previous['endVerse']=verse;previous['label']=str(previous['v'])+'–'+str(verse)
  ch.sort(key=lambda v:v['v'])
(out/'rbo.json').write_text(json.dumps({'translation':'Современный русский перевод (РБО, 2011)','source':'Предоставленный пользователем EPUB РБО','books':result},ensure_ascii=False))
for file in out.glob('*.json'):
 d=json.loads(file.read_text());print(file,[(b,len(x['chapters']),sum(len(ch) for ch in x['chapters'])) for b,x in d['books'].items()])
