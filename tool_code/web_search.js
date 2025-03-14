async function web_search(input) {
    let results = [];
    const DDG = require('duck-duck-scrape');
    while (true) {
        try {
            const searchResults = await DDG.search(input.query, {
                safeSearch: DDG.SafeSearchType.STRICT
            });
            if (searchResults.noResults) {
                console.log('❌ No search results found.');
                return [];
            }
            results = searchResults.results.map(result => ({
                title: result.title,
                description: result.description,
                url: result.url
            }));
            console.log(`🔍 "${input.query}" search results: ${results.length} found.`);
            for (const result of results) {
                if (result.url.indexOf('google.') !== -1) continue;
                if (result.url.indexOf('youtube.') !== -1) continue;
                if (result.url.indexOf('youtu.be') !== -1) continue;
                if (result.url.indexOf('gmail') !== -1) continue;
                if (result.url.indexOf('facebook') !== -1) continue;
                // if (result.url.indexOf('skyscanner') !== -1) continue;
                // if (result.url.indexOf('airbnb') !== -1) continue;
                // if (result.url.indexOf('booking') !== -1) continue;
                // if (result.url.indexOf('tripadvisor') !== -1) continue;
                // if (result.url.indexOf('booking.com') !== -1) continue;
                // if (result.url.indexOf('booking.com') !== -1) continue;
                // if (result.url.indexOf('booking.com') !== -1) continue;
                console.log(`🔍 ${result.title}`);
                console.log(`📝 ${result.description}`);
                console.log(`🔗 ${result.url}`);
                console.log(`---`);
            }
            break;
        } catch {
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    }
    return results;
}