"""Local-first LangChain RAG pipeline using Ollama and FAISS."""

from __future__ import annotations

import json
import os
import re
from operator import itemgetter
from pathlib import Path
from threading import RLock
from typing import Any

from langchain.retrievers import ContextualCompressionRetriever, EnsembleRetriever, MultiQueryRetriever
from langchain.retrievers.document_compressors import EmbeddingsFilter
from langchain_community.retrievers import BM25Retriever
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder, PromptTemplate
from langchain_core.runnables import RunnableLambda, RunnablePassthrough
from langchain_ollama import ChatOllama, OllamaEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter


QUERY_EXPANSION_PROMPT = PromptTemplate.from_template(
    """You create search queries for a Sangam University knowledge base.
Generate exactly two concise alternative search queries, one per line. Preserve
important names, course titles, dates, codes, phone numbers, and policy terms.
Do not answer the question and do not add commentary.

User question: {question}"""
)

ANSWER_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """You are Ask Sangam, a precise Sangam University assistant.
The newest user message is the task to answer. Chat history is supporting
context only: never answer an earlier question unless the newest message
explicitly refers to it. First check whether the retrieved passages directly
answer the newest question. Do not use unrelated event pages as evidence.
Answer only from the supplied knowledge-base context. Treat it as the sole
source of truth. If the answer is not directly supported, reply: \"I couldn't
find that in the current Sangam University knowledge base.\" Do not make up
facts or give generic advice to search elsewhere.

Write a clear, student-friendly answer. Use short paragraphs or bullets when
they improve readability. Do not mention the retrieval process and do not put
URLs in the answer; the application renders sources separately.

Knowledge-base context:
{context}""",
        ),
        MessagesPlaceholder("chat_history"),
        ("human", "{input}"),
    ]
)

CASUAL_RESPONSE_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """You are Ask Sangam, the official, warm, and professional Sangam
University AI assistant. Respond to the user's newest casual message only.
Keep the response brief (one or two sentences), welcoming, and helpful. Never
invent university facts, dates, offices, or policies. Offer to help with Sangam
University programmes, admissions, academics, campus resources, notices, or
other university questions.""",
        ),
        ("human", "{input}"),
    ]
)


def format_context(documents: list[Document]) -> str:
    """Preserve source identity in the prompt while keeping complete passages."""
    return "\n\n".join(
        f"[Source: {document.metadata.get('source', 'Unknown source')}]\n{document.page_content}"
        for document in documents
    )


class RagPipeline:
    """Indexes university material and answers grounded questions."""

    def __init__(self, backend_dir: str | Path):
        self.backend_dir = Path(backend_dir)
        self.documents_dir = self.backend_dir / "documents"
        self.index_dir = self.backend_dir / "data" / "faiss"
        self.documents_dir.mkdir(parents=True, exist_ok=True)
        self.index_dir.mkdir(parents=True, exist_ok=True)
        self._vector_store: FAISS | None = None
        self._chunks: list[Document] = []
        self._lock = RLock()

    @property
    def _chunks_file(self) -> Path:
        return self.index_dir / "chunks.json"

    def _embeddings(self):
        """Use OllamaEmbeddings if available, otherwise fall back to GoogleGenerativeAIEmbeddings."""
        api_key = os.getenv("GOOGLE_API_KEY")
        if api_key:
            try:
                from langchain_google_genai import GoogleGenerativeAIEmbeddings
                return GoogleGenerativeAIEmbeddings(
                    model="models/text-embedding-004",
                    google_api_key=api_key,
                )
            except Exception:
                pass
        return OllamaEmbeddings(
            model=os.getenv("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text"),
            base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
        )

    def _ollama_llm(self) -> ChatOllama:
        return ChatOllama(
            model=os.getenv("OLLAMA_LLM_MODEL", "llama3.2"),
            base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
            temperature=0,
        )

    @staticmethod
    def _google_llm():
        """Initialise Google GenAI only when local Ollama fails or when GOOGLE_API_KEY is active."""
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise RuntimeError("Ollama is unavailable and GOOGLE_API_KEY is not configured.")

        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            model=os.getenv("GOOGLE_GENAI_MODEL", "gemini-3.6-flash"),
            google_api_key=api_key,
            temperature=0,
        )

    def _read_local_documents(self) -> list[Document]:
        documents: list[Document] = []
        for path in self.documents_dir.rglob("*"):
            if not path.is_file() or path.suffix.lower() not in {".txt", ".md", ".pdf"}:
                continue
            if path.suffix.lower() == ".pdf":
                from pypdf import PdfReader

                text = "\n".join(page.extract_text() or "" for page in PdfReader(str(path)).pages)
            else:
                text = path.read_text(encoding="utf-8", errors="ignore")
            if text.strip():
                documents.append(Document(page_content=text, metadata={"source": path.name}))
        return documents

    @staticmethod
    def _split(documents: list[Document]) -> list[Document]:
        return RecursiveCharacterTextSplitter(chunk_size=900, chunk_overlap=150).split_documents(documents)

    def rebuild_index(self, documents: list[Document] | None = None) -> int:
        """Create and persist a fresh FAISS index using Ollama embeddings."""
        with self._lock:
            source_documents = documents if documents is not None else self._read_local_documents()
            if not source_documents:
                raise ValueError("No source documents found. Add files to backend/documents first.")
            self._chunks = self._split(source_documents)
            self._vector_store = FAISS.from_documents(self._chunks, self._embeddings())
            self._vector_store.save_local(str(self.index_dir))
            self._chunks_file.write_text(
                json.dumps(
                    [{"content": chunk.page_content, "metadata": chunk.metadata} for chunk in self._chunks],
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )
            return len(self._chunks)

    def _load_index(self) -> bool:
        with self._lock:
            if self._vector_store is not None:
                return True
            if not (self.index_dir / "index.faiss").exists():
                return False
            # Only load indexes written by this local application.
            self._vector_store = FAISS.load_local(
                str(self.index_dir), self._embeddings(), allow_dangerous_deserialization=True
            )
            return True

    def _load_chunks(self) -> list[Document]:
        """Load persisted chunk text for the lexical part of the hybrid retriever."""
        if self._chunks:
            return self._chunks
        if self._chunks_file.exists():
            serialized = json.loads(self._chunks_file.read_text(encoding="utf-8"))
            self._chunks = [
                Document(page_content=item["content"], metadata=item.get("metadata", {}))
                for item in serialized
            ]
        else:
            self._chunks = self._split(self._read_local_documents())
        return self._chunks

    def _advanced_retriever(self, llm):
        """Combine MMR semantic search, BM25 keyword search, and query expansion."""
        if not self._load_index() or self._vector_store is None:
            return None

        semantic = self._vector_store.as_retriever(
            search_type="mmr", search_kwargs={"k": 6, "fetch_k": 20, "lambda_mult": 0.55}
        )
        chunks = self._load_chunks()
        if not chunks:
            return semantic
        keyword = BM25Retriever.from_documents(chunks)
        keyword.k = 6
        hybrid = EnsembleRetriever(retrievers=[semantic, keyword], weights=[0.7, 0.3])
        # Keep the user's exact wording as well as LLM-generated alternatives.
        # This is especially important for precise queries such as contact
        # numbers, programme codes, dates, and policy titles.
        expanded = MultiQueryRetriever.from_llm(
            retriever=hybrid,
            llm=llm,
            prompt=QUERY_EXPANSION_PROMPT,
            include_original=True,
        )
        # Rerank the expanded set using the local embedding model. Unlike an
        # LLM extractor, this retains complete passages and therefore preserves
        # precise facts such as phone numbers, dates, and policy codes.
        return ContextualCompressionRetriever(
            base_retriever=expanded,
            base_compressor=EmbeddingsFilter(embeddings=self._embeddings(), k=6),
        )

    @staticmethod
    def _is_small_talk(message: str) -> bool:
        """Avoid retrieving unrelated university pages for conversational turns."""
        normalized = re.sub(r"[^a-z0-9 ]+", "", message.lower()).strip()
        greetings = {
            "hi", "hello", "hey", "good morning", "good afternoon", "good evening",
            "thanks", "thank you", "ok", "okay", "bye", "goodbye", "who are you",
            "what can you do", "how are you",
        }
        return normalized in greetings

    @staticmethod
    def _history(items: list[dict[str, Any]] | None) -> list[BaseMessage]:
        messages: list[BaseMessage] = []
        for item in (items or [])[-8:]:
            content = item.get("content", "") if isinstance(item, dict) else ""
            if not isinstance(content, str) or not content.strip():
                continue
            messages.append(
                AIMessage(content=content) if item.get("role") == "assistant" else HumanMessage(content=content)
            )
        return messages

    @staticmethod
    def _rag_chain(llm, retriever):
        """Build the RAG flow explicitly with LangChain Expression Language."""
        retrieve_documents = RunnablePassthrough.assign(
            documents=itemgetter("input") | retriever
        )
        answer = (
            {
                "context": itemgetter("documents") | RunnableLambda(format_context),
                "chat_history": itemgetter("chat_history"),
                "input": itemgetter("input"),
            }
            | ANSWER_PROMPT
            | llm
            | StrOutputParser()
        )
        # Keep retrieved documents in the output so the API can return trusted
        # source URLs without asking the model to invent or format citations.
        return retrieve_documents | {"answer": answer, "context": itemgetter("documents")}

    @staticmethod
    def _casual_chain(llm):
        """A small LCEL path for greetings that deliberately skips retrieval."""
        return {"input": itemgetter("input")} | CASUAL_RESPONSE_PROMPT | llm | StrOutputParser()

    def answer(self, message: str, history: list[dict[str, Any]] | None = None) -> dict[str, Any]:
        """Try Ollama first, then run the entire RAG chain through Google GenAI."""
        if not self._load_index():
            return {
                "reply": "The knowledge base has not been indexed yet. Add documents and call /api/documents/reindex.",
                "sources": [],
                "model": None,
            }

        payload = {"input": message, "chat_history": self._history(history)}
        failures: list[str] = []
        for provider, create_llm in (("ollama", self._ollama_llm), ("google-genai", self._google_llm)):
            try:
                llm = create_llm()
                if self._is_small_talk(message):
                    reply = self._casual_chain(llm).invoke(payload)
                    return {"reply": reply, "sources": [], "model": provider}
                result = self._rag_chain(llm, self._advanced_retriever(llm)).invoke(payload)
                sources = list(dict.fromkeys(doc.metadata.get("source", "Unknown source") for doc in result["context"]))
                return {"reply": result["answer"], "sources": sources, "model": provider}
            except Exception as error:
                failures.append(f"{provider}: {error}")
        raise RuntimeError("Both LLM providers failed. " + " | ".join(failures))

    def ingest_payload(self, items: list[dict[str, Any]]) -> int:
        documents: list[Document] = []
        for number, item in enumerate(items, start=1):
            content = item.get("content") if isinstance(item, dict) else None
            if not isinstance(content, str) or not content.strip():
                raise ValueError(f"Document {number} must include non-empty string field 'content'.")
            documents.append(Document(page_content=content, metadata={"source": str(item.get("source", f"API document {number}"))}))
        return self.rebuild_index(documents)
