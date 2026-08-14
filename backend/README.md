# Ask Sangam RAG backend

## Run locally

```powershell
cd backend
.\myvenv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python app.py
```

Install Ollama, then download the local LLM and embedding model:

```powershell
ollama pull llama3.2
ollama pull nomic-embed-text
```

The server runs at `http://localhost:5000`. Set `GOOGLE_API_KEY` in `.env` to use Gemini as an automatic LLM fallback if Ollama is down.

## Knowledge base and API

Start with Sangam University's public website by calling:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/sources/crawl -ContentType application/json -Body '{"url":"https://sangamuniversity.ac.in/","max_pages":40}'
```

The crawler stays on the same domain, checks `robots.txt`, skips non-HTML assets, waits briefly between requests, and limits the crawl to 75 pages maximum. It replaces the current FAISS index. Re-run it whenever the website changes.

Later, place `.txt`, `.md`, or `.pdf` university material in `backend/documents`, then call `POST /api/documents/reindex`. Alternatively, send `POST /api/documents` with `{ "documents": [{ "content": "...", "source": "handbook.md" }] }`.

`POST /api/chat` accepts `{ "message": "...", "history": [] }` and returns a grounded `reply`, `sources`, and the `model` used. Retrieval combines FAISS MMR semantic search, BM25 keyword retrieval, multi-query expansion, and contextual compression.
