import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Document } from "langchain/document";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base"; // 콜백 핸들러 추가

// 커스텀 콜백 핸들러 정의
class LoggingCallbackHandler extends BaseCallbackHandler {
    name = "LoggingCallbackHandler";

    async handleLLMStart(llm, prompts) {
        console.log("=== Raw POST Body to OpenAI ===");
        console.log(JSON.stringify({
            model: llm.modelName,
            messages: prompts.map(prompt => ({ role: "user", content: prompt })),
            temperature: llm.temperature,
        }, null, 2));
    }
}

export class Retriver {
    constructor(config) {
        this.dbPath = config.dbPath;
        this.APIKey = config.APIKey;
        this.modelName = config.modelName;
        this.embeddingModelName = config.embeddingModelName;
        this.temperature = config.temperature;

        // 데이터베이스 디렉토리 확인 및 생성
        const dbDir = path.join(this.dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        // 프롬프트 템플릿 설정
        this.setPromptTemplate();

        // LLM 인스턴스 생성 (콜백 추가)
        this.llm = new ChatOpenAI({
            modelName: this.modelName,
            temperature: this.temperature,
            openAIApiKey: this.APIKey,
            callbacks: [new LoggingCallbackHandler()], // POST body 로깅용 콜백
        });

        // 임베딩 인스턴스 생성
        this.embeddings = new OpenAIEmbeddings({
            modelName: this.embeddingModelName,
            openAIApiKey: this.APIKey,
        });
    }

    /**
     * 프롬프트 템플릿 설정
     * @param {Object} prompt 
     */
    // setPromptTemplate(prompt = {
    //   instruction: "Based on the following context, please answer the user's question.",
    //   context: "{context}",
    //   question: "{input}",
    //   answer_format: "Please provide a clear and concise answer based only on the information given in the context.",
    // }) 

    setPromptTemplate(prompt = {
        instruction: "Answer detailed and specific the question using only the provided context.",
        context: "{context}",
        question: "{input}",
        answer_format: "Provide a clear and concise answer.",
    }) {
        // 프롬프트 템플릿 생성
        const promptString = Object.entries(prompt).map(([key, value]) => `<${key}>\n${value}\n</${key}>`).join("\n");
        this.prompt = ChatPromptTemplate.fromTemplate(promptString);
        this.promptTemplateRaw = promptString; // 원본 템플릿 저장
    }

    async addDatabase(dbname) {
        const filename = path.join(this.dbPath, `${dbname}.json`);
        // console.log(filename);
        await this.saveData(filename, { data: {}, cache: {} });
    }

    async addContent(dbname, keyname, content) {
        // 데이터베이스가 없으면 생성
        try {
            await this.getDatabase(dbname);
        } catch {
            await this.addDatabase(dbname);
        }

        const data = await this.getDatabase(dbname);
        data.data[keyname] = content;
        await this.saveData(path.join(this.dbPath, `${dbname}.json`), data);
    }

    async getDatabase(dbname) {
        const filename = path.join(this.dbPath, `${dbname}.json`);
        // 데이터베이스 존재 확인
        try {
            await fs.promises.access(filename);
        } catch {
            throw new Error(`Database '${dbname}' does not exist`);
        }
        return await this.readExistingData(filename);
    }

    async getContent(dbname, keyname) {
        const data = await this.getDatabase(dbname);
        const content = data.data[keyname];
        if (!content) {
            throw new Error(`Content with key '${keyname}' not found in database '${dbname}'`);
        }
        return content;
    }

    async isContentEmbedded(dbname, keyname) {
        try {
            const data = await this.getDatabase(dbname);
            const cache = data.cache && data.cache[keyname];
            return !!(cache && cache.content === data.data[keyname] &&
                cache.chunks && cache.embeddings &&
                cache.chunks.length === cache.embeddings.length);
        } catch {
            return false;
        }
    }

    async embedContent(dbname, keyname) {
        const content = await this.getContent(dbname, keyname);
        const filename = path.join(this.dbPath, `${dbname}.json`);
        const data = await this.getDatabase(dbname);

        // 문서를 청크로 분할
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 2000, // 청크 크기 (문자 수)
            chunkOverlap: 200, // 겹치는 부분
        });
        const chunks = await splitter.splitText(content);

        // 각 청크를 임베딩
        const docs = chunks.map(chunk => new Document({ pageContent: chunk, metadata: { file: keyname } }));
        let embeddings;
        try {
            embeddings = await this.embeddings.embedDocuments(chunks);
        } catch (error) {
            console.error(`Failed to embed content for ${keyname}: ${error.message}`);
            throw error;
        }

        if (!data.cache) data.cache = {};
        data.cache[keyname] = {
            content: content, // 원본 콘텐츠 저장
            chunks: chunks,   // 분할된 청크 저장
            embeddings: embeddings // 각 청크의 임베딩
        };

        await this.saveData(filename, data);
    }

    async embedDatabaseForce(dbname) {
        const data = await this.getDatabase(dbname);
        for (const keyname in data.data) {
            await this.embedContent(dbname, keyname);
        }
    }

    async retrieve(dbname, question, prompt) {
        if (prompt) this.setPromptTemplate(prompt);

        const data = await this.getDatabase(dbname);
        const allDocs = [];
        const allEmbeddings = [];

        for (const key in data.data) {
            if (!await this.isContentEmbedded(dbname, key)) {
                await this.embedContent(dbname, key);
            }

            const data = await this.getDatabase(dbname);
            const cache = data.cache[key];
            cache.chunks.forEach((chunk, idx) => {
                allDocs.push(new Document({ pageContent: chunk, metadata: { file: key } }));
                allEmbeddings.push(cache.embeddings[idx]);
            });
        }

        const vectorStore = new MemoryVectorStore(this.embeddings);
        await vectorStore.addVectors(allEmbeddings, allDocs);

        const combineDocsChain = await createStuffDocumentsChain({
            llm: this.llm,
            prompt: this.prompt,
        });

        const retriever = vectorStore.asRetriever();
        const retrievalChain = await createRetrievalChain({
            retriever,
            combineDocsChain,
        });

        // LLM 요청 payload 로깅
        console.log("=== LLM Request Payload ===");
        console.log("Question:", question);
        console.log("Prompt Template:", this.promptTemplateRaw); // 저장된 원본 템플릿 사용

        // 검색된 문서(컨텍스트)를 미리 가져와 로깅
        const retrievedDocs = await retriever.invoke(question);
        console.log("Retrieved Context:", retrievedDocs.map(doc => ({
            content: doc.pageContent,
            metadata: doc.metadata,
        })));

        // 바인딩된 최종 프롬프트 생성 및 로깅
        const contextString = retrievedDocs.map(doc => doc.pageContent).join("\n");
        const finalPrompt = await this.prompt.invoke({
            context: contextString,
            input: question,
        });
        console.log("Final Prompt (Bound):", finalPrompt.messages[0].content);

        console.log("==========================");
        console.log(JSON.stringify(finalPrompt, null, 3));

        // 최종 LLM 호출 및 응답 로깅
        const response = await retrievalChain.invoke({ input: question });
        console.log("Answer from retrievalChain:", response.answer);
        console.log("==========================");

        return response.answer;
    }

    async deleteContent(dbname, keyname) {
        const data = await this.getDatabase(dbname);
        const filename = path.join(this.dbPath, `${dbname}.json`);

        if (data.data[keyname]) {
            delete data.data[keyname];
        }
        if (data.cache && data.cache[keyname]) {
            delete data.cache[keyname];
        }
        await this.saveData(filename, data);
    }

    async deleteDatabase(dbname) {
        const filename = path.join(this.dbPath, `${dbname}.json`);
        try {
            await this.getDatabase(dbname); // 데이터베이스 존재 확인
            await fs.promises.unlink(filename);
        } catch (error) {
            throw new Error(`Failed to delete database: ${error.message}`);
        }
    }

    async readExistingData(filename) {
        try {
            const fileContent = await fs.promises.readFile(filename, 'utf8');
            return JSON.parse(fileContent);
        } catch (error) {
            return {
                data: {},
                cache: {}
            };
        }
    }

    async saveData(filename, data) {
        await fs.promises.writeFile(
            filename,
            JSON.stringify(data, null, 2)
        );
    }
}