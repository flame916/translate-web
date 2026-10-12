"""Sync only the project-authored Lexicon UI skill to project discovery."""
import shutil
from pathlib import Path
root = Path(__file__).resolve().parents[2]
source = root / 'ui-toolkit/skill/lexicon-ui'
target = root / '.agents/skills/lexicon-ui'
assert source.is_dir() and target.resolve().is_relative_to(root / '.agents/skills')
shutil.copytree(source, target, dirs_exist_ok=True)
print('Synced lexicon-ui project Skill.')
