import fitz
import os
import re
def path_sanitizer(file_path):
    normalized = os.path.normpath(file_path.replace('\\', '/'))
    return re.sub(r'/+', '/', normalized)
def retrieve_from_pdf(input):
    pdf_file_path = path_sanitizer(input['pdf_file_path'])
    if not os.path.exists(pdf_file_path):
        print('❌ File not found: ' + pdf_file_path)
        return ''
    pdf_document = fitz.open(pdf_file_path)
    text = ''
    for page_num in range(len(pdf_document)):
        page = pdf_document[page_num]
        text += page.get_text()
    pdf_document.close()
    print(text)
    return text