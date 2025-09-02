#!/usr/bin/env python3
import os
import re
import glob

def fix_imports_in_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Fix relative imports that don't have .js extension
    # Match: from './xxx' or from '../xxx' where xxx doesn't already end in .js or .json
    pattern = r"from\s+['\"](\.\./[^'\"]+|\.\/[^'\"]+)(?<!\.js)(?<!\.json)['\"]"
    
    def add_js_extension(match):
        path = match.group(1)
        # Don't add .js if it's already there, or if it's a JSON file
        if not path.endswith('.js') and not path.endswith('.json'):
            return f"from '{path}.js'"
        return match.group(0)
    
    fixed_content = re.sub(pattern, add_js_extension, content)
    
    if fixed_content != content:
        with open(filepath, 'w') as f:
            f.write(fixed_content)
        print(f"Fixed imports in: {filepath}")
        return True
    return False

# Find all .js files in dist directory
dist_dir = '/Users/cyrilthommen/Documents/GitHub/JuiceSwapxyz/routing-api/dist'
js_files = glob.glob(os.path.join(dist_dir, '**/*.js'), recursive=True)

fixed_count = 0
for js_file in js_files:
    if fix_imports_in_file(js_file):
        fixed_count += 1

print(f"\nFixed imports in {fixed_count} files")