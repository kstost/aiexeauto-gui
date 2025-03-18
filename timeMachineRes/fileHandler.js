// 로그 파일 목록 가져오기
export async function fetchLogFiles() {
    try {
        const response = await fetch('/logs');
        const files = await response.json();
        return files.filter(file => {
            const mainParts = file.split('_');
            if (mainParts.length >= 2) {
                const type = mainParts[1];
                return type === 'UNI' || type === 'RES';
            }
            return false;
        });
    } catch (error) {
        console.error('로그 파일 목록을 가져오는데 실패했습니다:', error);
        throw error;
    }
}

// 파일 내용 가져오기
export async function fetchFileContent(filename) {
    try {
        const response = await fetch(`/logs/${filename}`);
        const content = await response.text();
        return content;
    } catch (error) {
        console.error('파일 내용을 불러오는데 실패했습니다:', error);
        throw error;
    }
}

// 파일명 파싱
export function parseFileName(filename) {
    let dateTime = '';
    let type = '';
    let name = '';

    const mainParts = filename.split('_');
    if (mainParts.length >= 2) {
        const timestampPart = mainParts[0];
        const dateParts = timestampPart.split('T');
        
        if (dateParts.length >= 2) {
            const date = dateParts[0];
            const timeParts = dateParts[1].split('-');
            
            if (timeParts.length >= 3) {
                const hour = parseInt(timeParts[0]) + 9;
                const minute = timeParts[1];
                const second = timeParts[2];

                let adjustedHour = hour;
                let adjustedDate = date;

                if (hour >= 24) {
                    adjustedHour = hour - 24;
                }

                dateTime = `${adjustedDate} ${adjustedHour}:${minute}:${second}`;
            }
        }

        if (mainParts.length >= 3) {
            type = mainParts[1];
            name = mainParts[2].replace('.txt', '');
        } else if (mainParts.length >= 2) {
            type = mainParts[1].replace('.txt', '');
        }
    }

    return { dateTime, type, name };
}

// 파일 저장하기
export async function saveFileContent(filename, content) {
    try {
        // 여기에 파일 저장 로직 구현
        console.log('파일 저장:', filename, content);
        return true;
    } catch (error) {
        console.error('파일 저장에 실패했습니다:', error);
        throw error;
    }
} 