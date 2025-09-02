#!/usr/bin/env python3
import os
import re
import glob

def fix_all_imports_in_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    original_content = content
    
    # Fix relative imports that don't have .js extension
    pattern1 = r"from\s+['\"](\.\./[^'\"]+|\.\/[^'\"]+)(?<!\.js)(?<!\.json)['\"]"
    content = re.sub(pattern1, lambda m: f"from '{m.group(1)}.js'", content)
    
    # Fix @uniswap/smart-order-router imports
    pattern2 = r"from '@uniswap/smart-order-router/build/main/([^']+)(?<!\.js)'"
    content = re.sub(pattern2, lambda m: f"from '@uniswap/smart-order-router/build/main/{m.group(1)}.js'", content)
    
    # Fix JSON imports to add assertion
    pattern3 = r"import\s+([^'\"]+)\s+from\s+['\"]([^'\"]+\.json)['\"];"
    content = re.sub(pattern3, r"import \1 from '\2' with { type: 'json' };", content)
    
    # Fix specific problematic imports
    content = re.sub(r"from 'uuid/index'", "from 'uuid'", content)
    content = re.sub(r"from 'aws-sdk/clients/s3'", "from 'aws-sdk/clients/s3.js'", content)
    content = re.sub(r"from 'aws-sdk/clients/dynamodb'", "from 'aws-sdk/clients/dynamodb.js'", content)
    
    if content != original_content:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Fixed imports in: {filepath}")
        return True
    return False

# Find all .js files in dist directory
dist_dir = '/Users/cyrilthommen/Documents/GitHub/JuiceSwapxyz/routing-api/dist'
js_files = glob.glob(os.path.join(dist_dir, '**/*.js'), recursive=True)

fixed_count = 0
for js_file in js_files:
    if fix_all_imports_in_file(js_file):
        fixed_count += 1

print(f"\nFixed imports in {fixed_count} files")