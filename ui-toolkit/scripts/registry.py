import argparse
import json
from registry_store import Registry

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Validate local UI resource provenance')
    parser.add_argument('command', choices=['validate'])
    parser.parse_args()
    print(json.dumps(Registry().validate(), ensure_ascii=False))
