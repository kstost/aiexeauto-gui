async function tool({ number1, number2 }) {
    const mathjs = require('mathjs');
    const result = mathjs.add(number1, number2);
    console.log(`${number1} + ${number2} = ${   result}`);
    return result;
}
