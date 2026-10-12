"""Download official resources and install the two project skills. No package code is executed."""
from pathlib import Path
import base64, hashlib, io, json, re, shutil, subprocess, sys, tarfile, urllib.request, zipfile
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[2]
KIT = ROOT / 'ui-toolkit'
GIT = Path(r'C:\Users\10035\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe')
INSTALLER = Path(r'C:\Users\10035\.codex\skills\.system\skill-installer\scripts\install-skill-from-github.py')
STAMP = datetime.now(timezone.utc).isoformat()

def get(url):
    request = urllib.request.Request(url, headers={'User-Agent':'Lexicon-resource-setup/1.0'})
    with urllib.request.urlopen(request, timeout=60) as response:
        data = response.read(80 * 1024 * 1024 + 1)
    if len(data) > 80 * 1024 * 1024:
        raise ValueError('Download exceeds 80 MB')
    return data

def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return {'path': path.relative_to(ROOT).as_posix(), 'sha256':hashlib.sha256(data).hexdigest(), 'bytes':len(data)}

def commit(repo):
    result = subprocess.run([str(GIT),'ls-remote',f'https://github.com/{repo}.git','HEAD'],capture_output=True,text=True,check=True)
    sha = result.stdout.split()[0]
    if not re.fullmatch('[a-f0-9]{40}',sha): raise ValueError('Invalid commit')
    return sha

lock = []
for package, wanted in [('@radix-ui/colors', ['gray.css','bronze.css','green.css','red.css','LICENSE']),
                         ('@fontsource/inter', ['files/inter-latin-400-normal.woff2','files/inter-latin-600-normal.woff2','LICENSE'])]:
    meta = json.loads(get(f'https://registry.npmjs.org/{package}/latest'))
    archive = get(meta['dist']['tarball'])
    algorithm, encoded = meta['dist']['integrity'].split('-',1)
    if algorithm != 'sha512' or hashlib.sha512(archive).digest() != base64.b64decode(encoded):
        raise ValueError('NPM integrity mismatch')
    entry = {'name':package,'version':meta['version'],'url':meta['dist']['tarball'],'retrievedAt':STAMP,'files':[]}
    with tarfile.open(fileobj=io.BytesIO(archive), mode='r:gz') as tar:
        names = tar.getnames()
        for name in wanted:
            candidates = [n for n in names if n == 'package/'+name or (name == 'LICENSE' and n.lower().endswith('/license'))]
            if not candidates: raise ValueError(f'Missing resource: {package}/{name}')
            member = tar.extractfile(candidates[0])
            data = member.read()
            if name == 'LICENSE':
                target = KIT/'licenses'/('radix-colors.txt' if package.startswith('@radix') else 'inter.txt')
            elif name.endswith('.woff2'): target = KIT/'assets/fonts'/Path(name).name
            else: target = KIT/'vendor/radix'/name
            entry['files'].append(write(target,data))
    lock.append(entry)
    print(f'Downloaded {package} {meta["version"]}',flush=True)

galaxy_sha = commit('uiverse-io/galaxy')
archive = get(f'https://codeload.github.com/uiverse-io/galaxy/zip/{galaxy_sha}')
materials = []
with zipfile.ZipFile(io.BytesIO(archive)) as z:
    prefix = z.namelist()[0]
    license_data = z.read(prefix+'LICENSE')
    write(KIT/'licenses/uiverse-galaxy.txt',license_data)
    categories = [('loaders','loader'),('Buttons','button'),('Inputs','input'),('Toggle-switches','switch'),('loaders','loader'),('Buttons','button')]
    chosen_paths = set()
    for folder, category in categories:
        choices = []
        for info in z.infolist():
            if info.filename in chosen_paths or not info.filename.startswith(prefix+folder+'/') or not info.filename.endswith('.html') or info.file_size>20000: continue
            content = z.read(info).decode('utf-8')
            if any(k in content.lower() for k in ['<script','@import','url(','<iframe','tailwind','onclick=']): continue
            # Compact CSS examples are easier to audit and adapt. Preserve candidate status.
            if '<style' not in content or 'uiverse.io/' not in content: continue
            choices.append((info.file_size,info.filename,content))
        choices.sort()
        if not choices: raise ValueError(f'No eligible examples in {folder}')
        _, source_path, content = choices[0]
        chosen_paths.add(source_path)
        author_url = re.search(r'https://uiverse\.io/([A-Za-z0-9_-]+)/([A-Za-z0-9_-]+)', content)
        if not author_url: raise ValueError('Missing element URL')
        author, slug = author_url.groups()
        material_id = f'uiverse-{category}-{slug}'
        record = write(KIT/'materials'/material_id/'original.html',content.encode('utf-8'))
        materials.append({'id':material_id,'providerId':'uiverse','name':f'Uiverse {category} · {author}','sourceUrl':author_url.group(0),
            'author':author,'category':category,'format':'html-css','status':'candidate','license':'MIT','licenseStatus':'confirmed',
            'licenseEvidence':f'https://github.com/uiverse-io/galaxy/blob/{galaxy_sha}/LICENSE','licenseFile':'ui-toolkit/licenses/uiverse-galaxy.txt',
            'retrievedAt':STAMP,'version':galaxy_sha,'contentHash':record['sha256'],'sourceFiles':[record['path']],
            'adaptedFiles':[],'usedIn':[],'verification':[]})
        print(f'Candidate {category}: {author_url.group(0)}',flush=True)
lock.append({'name':'uiverse-galaxy','version':galaxy_sha,'url':'https://github.com/uiverse-io/galaxy','retrievedAt':STAMP,'files':[{'path':'ui-toolkit/licenses/uiverse-galaxy.txt','sha256':hashlib.sha256(license_data).hexdigest(),'bytes':len(license_data)}]})

skills_dest = ROOT/'.agents/skills'
shadcn_sha = commit('shadcn-ui/ui')
if not (skills_dest/'shadcn').exists():
    subprocess.run([sys.executable,str(INSTALLER),'--repo','shadcn-ui/ui','--path','skills/shadcn','--ref',shadcn_sha,'--dest',str(skills_dest),'--method','download'],check=True)
else: raise ValueError('Existing shadcn skill: inspect instead of overwriting')
license_data = get(f'https://raw.githubusercontent.com/shadcn-ui/ui/{shadcn_sha}/LICENSE.md')
write(KIT/'licenses/shadcn.txt',license_data)
project_skill = skills_dest/'lexicon-ui'
if project_skill.exists(): raise ValueError('Existing lexicon-ui skill: inspect instead of overwriting')
shutil.copytree(KIT/'skill/lexicon-ui',project_skill)
skill_files = [write(p,p.read_bytes()) for p in (skills_dest/'shadcn').rglob('*') if p.is_file()]
lock.append({'name':'shadcn-official-skill','version':shadcn_sha,'url':'https://github.com/shadcn-ui/ui/tree/'+shadcn_sha+'/skills/shadcn','retrievedAt':STAMP,'files':skill_files})

for name, data in [('resources.lock.json',{'schemaVersion':1,'resources':lock}),('materials.json',{'schemaVersion':1,'materials':materials})]:
    target=KIT/'registry'/name
    if target.exists(): raise ValueError(f'Existing registry: {target}')
    write(target,(json.dumps(data,ensure_ascii=False,indent=2)+'\n').encode('utf-8'))
print('Installed project skill and official shadcn skill; downloaded six Uiverse candidates, colors and local fonts.',flush=True)
