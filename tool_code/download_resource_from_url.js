async function download_resource_from_url(input) {
    const pathSanitizer = (path) => {
        path = path.split('\\').join('/');
        while (true) {
            if (path.indexOf('//') === -1) break;
            path = path.split('//').join('/');
        }
        return path;
    };

    let { url, file_path } = input;
    const fs = require('fs');
    const https = require('https');
    const http = require('http');
    
    file_path = pathSanitizer(file_path);
    
    const result = await new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        protocol.get(url, (response) => {
            let data = '';
            response.on('data', (chunk) => {
                data += chunk;
            });
            response.on('end', () => {
                resolve(data);
            });
        }).on('error', (err) => {
            console.error('❌ 다운로드 중 오류 발생: ' + err.message);
            reject(err);
        });
    });
    
    try {
        fs.writeFileSync(file_path, result);
        const exists = fs.existsSync(file_path);
        if (!exists) { 
            console.error('❌ 파일이 존재하지 않습니다: ' + file_path); 
            return false; 
        }
        console.log('✅ 리소스가 성공적으로 다운로드되었습니다: ' + file_path);
        return true;
    } catch (error) {
        console.error('❌ 파일 저장 중 오류 발생: ' + error.message);
        return false;
    }
}
