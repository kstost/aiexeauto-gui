async function web_search(input) {
    const DDG = require('duck-duck-scrape');
    const searchResults = await DDG.search(input.query, {
        safeSearch: DDG.SafeSearchType.STRICT
    });
    if (searchResults.noResults) {
        console.log('❌ No search results found.');
        return [];
    }
    const results = searchResults.results.map(result => ({
        title: result.title,
        description: result.description,
        url: result.url
    }));
    console.log(`🔍 "${input.query}" search results: ${results.length} found.`);
    for (const result of results) {
        console.log(`🔍 ${result.title}`);
        console.log(`📝 ${result.description}`);
        console.log(`🔗 ${result.url}`);
        console.log(`---`);
    }
    return results;
}