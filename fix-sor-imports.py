#!/usr/bin/env python3
import os
import re
import glob

def fix_sor_imports_in_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Fix @uniswap/smart-order-router/build/main imports that don't have .js extension
    pattern = r"from '@uniswap/smart-order-router/build/main/([^']+)(?<!\.js)'"
    
    def add_js_extension(match):
        path = match.group(1)
        return f"from '@uniswap/smart-order-router/build/main/{path}.js'"
    
    fixed_content = re.sub(pattern, add_js_extension, content)
    
    if fixed_content != content:
        with open(filepath, 'w') as f:
            f.write(fixed_content)
        print(f"Fixed SOR imports in: {filepath}")
        return True
    return False

# Find all .js files in dist directory
dist_dir = '/Users/cyrilthommen/Documents/GitHub/JuiceSwapxyz/routing-api/dist'
js_files = glob.glob(os.path.join(dist_dir, '**/*.js'), recursive=True)

fixed_count = 0
for js_file in js_files:
    if fix_sor_imports_in_file(js_file):
        fixed_count += 1

print(f"\nFixed SOR imports in {fixed_count} files")