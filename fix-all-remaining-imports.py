#!/usr/bin/env python3
import os
import re
import glob

def fix_remaining_imports_in_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    original_content = content
    
    # Fix any remaining bare @uniswap/smart-order-router imports
    patterns = [
        # Basic import without /build
        (r"from '@uniswap/smart-order-router'(?!/)(?!.*\.js)", "from '@uniswap/smart-order-router/build/main/index.js'"),
        # Imports with trailing slash but no build
        (r"from '@uniswap/smart-order-router/'(?!build)", "from '@uniswap/smart-order-router/build/main/index.js'"),
        # Dynamic import style
        (r"import\('@uniswap/smart-order-router'(?!/)\)", "import('@uniswap/smart-order-router/build/main/index.js')"),
    ]
    
    for pattern, replacement in patterns:
        content = re.sub(pattern, replacement, content)
    
    if content != original_content:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Fixed remaining imports in: {filepath}")
        return True
    return False

# Find all .js files in dist directory
dist_dir = '/Users/cyrilthommen/Documents/GitHub/JuiceSwapxyz/routing-api/dist'
js_files = glob.glob(os.path.join(dist_dir, '**/*.js'), recursive=True)

fixed_count = 0
for js_file in js_files:
    if fix_remaining_imports_in_file(js_file):
        fixed_count += 1

print(f"\nFixed remaining imports in {fixed_count} files")

# Also search for any references to smart-order-router that might be problematic
print("\nSearching for any remaining problematic imports...")
problem_files = []
for js_file in js_files:
    with open(js_file, 'r') as f:
        content = f.read()
        if "@uniswap/smart-order-router'" in content and "/build/main/" not in content:
            problem_files.append(js_file)

if problem_files:
    print(f"Found {len(problem_files)} files with potential import issues:")
    for file in problem_files[:5]:  # Show first 5
        print(f"  - {file}")
        with open(file, 'r') as f:
            lines = f.readlines()
            for i, line in enumerate(lines):
                if "@uniswap/smart-order-router'" in line and "/build/main/" not in line:
                    print(f"    Line {i+1}: {line.strip()}")
else:
    print("No problematic imports found!")