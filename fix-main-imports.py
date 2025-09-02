#!/usr/bin/env python3
import os
import re
import glob

def fix_main_imports_in_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    original_content = content
    
    # Fix main smart-order-router imports (without /build/main/)
    pattern = r"from '@uniswap/smart-order-router'(?!/build)"
    content = re.sub(pattern, "from '@uniswap/smart-order-router/build/main/index.js'", content)
    
    # Fix partial imports with trailing slash
    pattern2 = r"from '@uniswap/smart-order-router/';"
    content = re.sub(pattern2, "from '@uniswap/smart-order-router/build/main/index.js';", content)
    
    if content != original_content:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Fixed main imports in: {filepath}")
        return True
    return False

# Find all .js files in dist directory
dist_dir = '/Users/cyrilthommen/Documents/GitHub/JuiceSwapxyz/routing-api/dist'
js_files = glob.glob(os.path.join(dist_dir, '**/*.js'), recursive=True)

fixed_count = 0
for js_file in js_files:
    if fix_main_imports_in_file(js_file):
        fixed_count += 1

print(f"\nFixed main imports in {fixed_count} files")