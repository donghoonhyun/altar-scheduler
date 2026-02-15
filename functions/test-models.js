const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error('❌ ERROR: process.env.GEMINI_API_KEY is missing.');
    process.exit(1);
}
const genAI = new GoogleGenerativeAI(apiKey);

const modelsToTest = [
    'gemini-pro',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.0-pro',
];

async function testModel(modelName) {
    try {
        console.log(`\nTesting model: ${modelName}...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent('Say hello in Korean');
        const response = await result.response;
        const text = response.text();
        console.log(`✅ SUCCESS: ${modelName}`);
        console.log(`Response: ${text.substring(0, 50)}...`);
        return true;
    } catch (error) {
        console.log(`❌ FAILED: ${modelName}`);
        console.log(`Error: ${error.message}`);
        return false;
    }
}

async function main() {
    console.log('Testing Google AI SDK models...\n');

    for (const modelName of modelsToTest) {
        await testModel(modelName);
    }
}

main();
