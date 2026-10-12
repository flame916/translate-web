"""Save a portable source snapshot for review and rollback; no runtime dependencies."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from registry_store import ROOT, Registry

Registry().validate()
target = ROOT / 'output/ui/lexicon-ui-v0.1.0.zip'
target.parent.mkdir(parents=True, exist_ok=True)
folders = ['ui-toolkit', 'stage0-prototype', '.agents/skills/lexicon-ui', '.agents/skills/shadcn', 'docs/ui']
with ZipFile(target, 'w', ZIP_DEFLATED) as archive:
    for folder in folders:
        for path in sorted((ROOT / folder).rglob('*')):
            if not path.is_file() or {'__pycache__', '.scratch', 'node_modules'}.intersection(path.parts):
                continue
            if path.suffix in {'.pyc', '.tmp'}:
                continue
            assert path.resolve().is_relative_to(ROOT)
            archive.write(path, path.relative_to(ROOT).as_posix())
with ZipFile(target) as archive:
    assert archive.testzip() is None
    print(f'Archive ready: {len(archive.namelist())} files, {target.stat().st_size} bytes')
