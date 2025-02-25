async function tool({ number1, number2 }) {
    const mathjs = require('mathjs');
    console.log(`${number1} + ${number2} = ${mathjs.add(number1, number2)}`);
}
