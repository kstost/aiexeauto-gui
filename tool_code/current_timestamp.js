function current_timestamp() {
    const timestamp = new Date().toISOString();
    console.log(timestamp);
    return timestamp;
}