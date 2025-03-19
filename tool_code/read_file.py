import os
import re
def path_sanitizer(file_path):
    normalized = os.path.normpath(file_path.replace('\\', '/'))
    return re.sub(r'/+', '/', normalized)
def read_file(input_data):
    if not input_data or not isinstance(input_data.get('file_path'), str):
        print('❌ Invalid input values.')
        return ''
    file_path = path_sanitizer(input_data['file_path'])
    try:
        with open(file_path, mode='r', encoding='utf8') as f:
            content = f.read()
            print(f'✅ File read successfully: {file_path}')
            print(content)
            return content
    except Exception as err:
        print(f'❌ Error reading file: {file_path}', err)
        return ''