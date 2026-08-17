import json
import re

from groq import Groq

from app.config import settings

_client = Groq(api_key=settings.groq_api_key)

# Reasoning models (qwen3.x) otherwise wrap their answer in a <think> block, which
# would show up in answers and break the JSON parsing in detect_metadata(). The token
# budget has to cover any reasoning as well, or the answer gets truncated away.
_extra: dict = {"max_completion_tokens": settings.llm_max_tokens}
if settings.llm_reasoning_format:
    _extra["reasoning_format"] = settings.llm_reasoning_format
if settings.llm_reasoning_effort:
    _extra["reasoning_effort"] = settings.llm_reasoning_effort

# detect_metadata() is mechanical extraction — thinking adds seconds per upload for no
# gain. Only override when the configured model takes the param at all.
_metadata_extra = (
    {**_extra, "reasoning_effort": "none"} if settings.llm_reasoning_effort else _extra
)

SYSTEM_PROMPT = """You are a product management study assistant. You answer questions \
using ONLY the excerpts provided below, which come from the user's personal PM book \
library. Rules:

1. Ground every claim in the excerpts. Do not invent facts.
2. When multiple sources discuss the topic, synthesize their views and note where \
they agree.
3. If sources meaningfully disagree or use different frameworks for the same problem, \
call this out explicitly under a "Where sources differ" section.
4. Write for a PM preparing for interviews or on-the-job practice: be clear and \
practical, not academic.
5. If the excerpts don't contain enough information to answer, say so plainly instead \
of guessing.
6. Write citations as plain parenthesised text — (Cracking the PM Interview). Never \
wrap a citation in backticks; it is prose, not code.
"""


def build_context(chunks) -> str:
    parts = []
    for i, c in enumerate(chunks, 1):
        meta = c.metadata or {}
        label = meta.get("title", "Unknown source")
        author = meta.get("author")
        if author:
            label = f"{label} ({author})"
        parts.append(f"[Source {i}: {label}]\n{c.page_content}")
    return "\n\n".join(parts)


def answer_question(question: str, chunks) -> str:
    context = build_context(chunks)
    user_prompt = f"""Question: {question}

Excerpts from the knowledge base:

{context}

Answer the question using the excerpts above. Cite sources by name inline, e.g. \
(Cracking the PM Interview)."""

    response = _client.chat.completions.create(
        model=settings.llm_model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        **_extra,
    )
    return response.choices[0].message.content


# --- Multi-turn chat -------------------------------------------------------
#
# Retrieval runs on the raw message, so a follow-up like "what about the second
# one?" would embed almost no signal. Condensing the turn against the recent
# history back into a self-contained query is what makes follow-ups retrieve
# anything useful.

CONDENSE_PROMPT = """Given a conversation and the user's latest message, rewrite \
that message as a standalone search query for a book-excerpt search engine.

Rules:
- Resolve pronouns and references ("it", "that framework", "the second one") into \
explicit terms taken from the conversation.
- Keep it short — a search query, not a sentence. No preamble, no quotes.
- If the latest message is already self-contained, return it unchanged.

Return only the query text."""

# Prior turns are for continuity, not for retrieval — the excerpts carry the facts.
# Full assistant answers are ~3k characters each and would eat the free tier's
# 8000 tokens/minute in two turns, so history goes in trimmed.
_HISTORY_TURNS = 4
_HISTORY_CHAR_CAP = 600


def _trim_history(history):
    out = []
    for m in history[-_HISTORY_TURNS:]:
        content = m.content
        if m.role == "assistant" and len(content) > _HISTORY_CHAR_CAP:
            content = content[:_HISTORY_CHAR_CAP] + "…"
        out.append({"role": m.role, "content": content})
    return out


def condense_question(history, question: str) -> str:
    """Rewrite a follow-up into a standalone retrieval query. Falls back to the
    raw question if the rewrite fails — a worse search beats a failed request."""
    if not history:
        return question

    convo = "\n".join(f"{m['role']}: {m['content']}" for m in _trim_history(history))
    try:
        response = _client.chat.completions.create(
            model=settings.llm_model,
            messages=[
                {"role": "system", "content": CONDENSE_PROMPT},
                {"role": "user", "content": f"Conversation:\n{convo}\n\nLatest message: {question}"},
            ],
            **{**_metadata_extra, "max_completion_tokens": 200},
        )
        rewritten = (response.choices[0].message.content or "").strip()
        return rewritten or question
    except Exception:
        return question


# --- Reasoning mode ---------------------------------------------------------
#
# Reasoning costs ~2.9k tokens — 85% of the output budget — and buys two things:
# citing books by name rather than "Source 3", and spotting where authors disagree.
# Neither is worth paying for on a plain lookup, so the effort is chosen per turn.
#
# Both signals below are free: no extra model call, which matters because a
# follow-up already spends one request on condensing.

_COMPARATIVE = re.compile(
    r"\b("
    r"compare|comparison|contrast|differ|differs|difference|differences|"
    r"disagree|disagreement|conflict|conflicting|versus|vs\.?|"
    r"consensus|agree|tradeoffs?|trade-offs?|pros and cons|debate|"
    r"which is better|better than|across (?:the )?(?:sources|books|authors)|"
    r"all (?:the )?(?:sources|books|authors)|every (?:source|book|author)"
    r")\b",
    re.IGNORECASE,
)


def choose_mode(question: str, chunks) -> tuple[str, str]:
    """Return (mode, why). "deep" reasons; "quick" skips straight to answering.

    Intent is the only signal. Counting how many books the retrieval touched was
    the obvious second one, but measured on a real shelf it doesn't separate the
    cases: "what is a product roadmap?" (lookup) and "compare how the authors
    approach prioritization" both come back 5 chunks / 3 chunks across two books.
    Nearly every query spans 2+ books, so that rule sent everything to deep.
    """
    if _COMPARATIVE.search(question or ""):
        return "deep", "comparative question"
    return "quick", "lookup"


def _generation_args(mode: str) -> dict:
    if mode == "quick":
        args = {"max_completion_tokens": settings.llm_quick_max_tokens}
        if settings.llm_reasoning_format:
            args["reasoning_format"] = settings.llm_reasoning_format
        # Only send the param at all if this model accepts it.
        if settings.llm_reasoning_effort:
            args["reasoning_effort"] = "none"
        return args
    return _extra


def stream_answer(question: str, chunks, history=None, mode: str = "deep"):
    """Yield answer text deltas for a chat turn."""
    context = build_context(chunks)
    user_prompt = f"""Question: {question}

Excerpts from the knowledge base:

{context}

Answer the question using the excerpts above. Cite sources by name inline, e.g. \
(Cracking the PM Interview)."""

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if history:
        messages += _trim_history(history)
    messages.append({"role": "user", "content": user_prompt})

    stream = _client.chat.completions.create(
        model=settings.llm_model,
        messages=messages,
        stream=True,
        **_generation_args(mode),
    )
    for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta


def detect_metadata(text_sample: str) -> dict:
    """Detect title, author, and topic from a document's first pages using Groq.

    The text_sample should include title page, copyright page, and table of contents.
    Returns {"title": "...", "author": "...", "topic": "..."}.
    Gracefully returns empty strings if detection fails.
    """
    if not text_sample or not text_sample.strip():
        return {"title": "", "author": "", "topic": ""}

    prompt = """You are analyzing the first page(s) of a book. This excerpt may include a cover page, copyright page, and table of contents. Use whichever of these is present to identify:
1. The book's title
2. The author's name (if present)
3. The general subject area or topic (e.g. "Product Management", "Strategy", "Business")

You MUST respond with ONLY a JSON object, no other text:
{"title": "...", "author": "...", "topic": "..."}

Use empty strings ("") for any field you cannot determine from the text.

Book excerpt:
""" + text_sample

    try:
        response = _client.chat.completions.create(
            model=settings.llm_model,
            messages=[
                {"role": "user", "content": prompt}
            ],
            **_metadata_extra,
        )
        raw_response = response.choices[0].message.content.strip()

        # Extract JSON from response (in case the model includes extra text)
        json_start = raw_response.find("{")
        json_end = raw_response.rfind("}") + 1
        if json_start != -1 and json_end > json_start:
            json_str = raw_response[json_start:json_end]
            parsed = json.loads(json_str)
            return {
                "title": parsed.get("title", "").strip(),
                "author": parsed.get("author", "").strip(),
                "topic": parsed.get("topic", "").strip(),
            }
    except Exception:
        pass

    # Graceful fallback: return empty strings if anything fails
    return {"title": "", "author": "", "topic": ""}
