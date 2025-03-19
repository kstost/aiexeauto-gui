import fitz
import os
import re
def path_sanitizer(file_path):
    normalized = os.path.normpath(file_path.replace('\\', '/'))
    return re.sub(r'/+', '/', normalized)
def retrieve_from_file(input):
    file_path = path_sanitizer(input['file_path'])
    if not os.path.exists(file_path):
        print('❌ File not found: ' + file_path)
        return ''
    with open(file_path, 'r', encoding='utf-8') as file:
        text = file.read()
    print(text)
    return text