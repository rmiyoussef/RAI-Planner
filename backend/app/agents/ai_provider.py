import httpx
import logging
import time
from typing import Optional, Dict, Any
from app.core.database import get_collection

logger = logging.getLogger(__name__)


class _TryNextProtocol(Exception):
    """Internal: the endpoint speaks another protocol — try the next one."""


PROTOCOLS = ("chat", "responses", "messages")
PROTOCOL_LABELS = {
    "chat": "chat protocol",
    "responses": "Responses protocol",
    "messages": "Messages protocol",
}


class AIProvider:
    # Last protocol that succeeded ("chat"/"responses"/"messages"/"mock"/None).
    last_protocol: Optional[str] = None
    async def get_config(self, owner_id: str) -> Optional[Dict[str, Any]]:
        col = get_collection("ai_configs")
        return await col.find_one({"owner_id": owner_id})

    # Connect fast-fail vs. generous read budget: a full engineering spec
    # (up to max_tokens) can legitimately take minutes on a loaded model.
    TIMEOUT = httpx.Timeout(connect=10.0, read=180.0, write=10.0, pool=10.0)

    @staticmethod
    def _unwrap(data: Any) -> Any:
        """Descend through gateway envelopes like {"success":..,"data":{...}}."""
        if isinstance(data, dict) and isinstance(data.get("data"), dict):
            inner = data["data"]
            if any(k in inner for k in ("choices", "output", "output_text", "content")):
                return inner
        return data

    async def generate(
        self, owner_id: str, system_prompt: str, user_prompt: str,
        max_tokens: int = 4000, on_progress=None,
    ) -> str:
        cfg = await self.get_config(owner_id)
        if not cfg or not cfg.get("api_key_encrypted"):
            raise ValueError("AI configuration missing: API key not set")
        from app.core.security import decrypt_secret
        api_key = decrypt_secret(cfg["api_key_encrypted"])
        provider_url = cfg.get("provider_url") or "https://api.openai.com/v1"
        model = cfg.get("model_name") or "gpt-4o-mini"
        # normalize URL to the chat-completions endpoint
        from urllib.parse import urlparse
        base = provider_url.strip().rstrip("/")
        if base.endswith("/chat/completions"):
            url = base
        else:
            path = urlparse(base).path.rstrip("/")
            if not path:
                # Bare host (e.g. https://api.openai.com or http://localhost:11434):
                # OpenAI-compatible servers serve chat at /v1/chat/completions.
                url = base + "/v1/chat/completions"
            else:
                # support bases like https://api.openai.com/v1 or gateway prefixes
                url = base + "/chat/completions"

        # If no real key (test/demo), fallback to mock generation
        if api_key.startswith("sk-test") or api_key == "test" or "mock" in provider_url.lower():
            self.last_protocol = "mock"
            return self._mock_generation(system_prompt, user_prompt, model)

        # Try the last working protocol first so repeat runs skip dead ends
        # instead of re-burning round trips (or timeouts) on every generation.
        self.last_protocol = None
        pref = (cfg.get("chat_protocol") or "chat")
        if pref not in PROTOCOLS:
            pref = "chat"
        order = [pref] + [p for p in PROTOCOLS if p != pref]

        last_mismatch: Optional[Exception] = None
        try:
            async with httpx.AsyncClient(timeout=self.TIMEOUT) as client:
                headers = {
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                }
                for proto in order:
                    if on_progress and proto != order[0]:
                        on_progress(f"Trying {PROTOCOL_LABELS[proto]}…")
                    try:
                        text = await self._try_protocol(
                            client, headers, url, base, proto,
                            model, system_prompt, user_prompt, max_tokens, on_progress,
                        )
                    except _TryNextProtocol as e:
                        last_mismatch = e
                        continue
                    self.last_protocol = proto
                    await self._remember_protocol(owner_id, proto)
                    return text
                # Every protocol reported "wrong endpoint".
                raise last_mismatch or RuntimeError(
                    f"AI provider has no usable endpoint at {base} — "
                    "check the Provider URL in Settings → AI Configuration."
                )
        except httpx.ConnectTimeout:
            raise RuntimeError(
                f"Could not reach the AI provider at {url} (connection timed out) — "
                "check the Provider URL in Settings → AI Configuration and that the server can reach it."
            )
        except httpx.ReadTimeout:
            raise RuntimeError(
                "The AI model took too long to respond (>3 min) — it may be overloaded. "
                "Try again, or use Test connection in Settings → AI Configuration."
            )
        except httpx.TimeoutException:
            raise RuntimeError(
                f"AI provider request timed out for {url} — "
                "check the Provider URL in Settings → AI Configuration."
            )
        except ValueError:
            raise
        except RuntimeError:
            raise
        except Exception as e:
            # fallback mock if provider unreachable in dev
            # if we have no internet, return mock
            if "test" in api_key or not api_key:
                return self._mock_generation(system_prompt, user_prompt, model)
            raise RuntimeError(f"AI provider failed: {e}")

    async def _try_protocol(
        self, client: "httpx.AsyncClient", headers: dict,
        chat_url: str, base: str, proto: str,
        model: str, system_prompt: str, user_prompt: str,
        max_tokens: int = 4000, on_progress=None,
    ) -> str:
        if proto == "chat":
            return await self._try_chat(
                client, headers, chat_url, model, system_prompt, user_prompt, max_tokens, on_progress
            )
        if proto == "responses":
            return await self._try_responses(
                client, headers, base, model, system_prompt, user_prompt, max_tokens, on_progress
            )
        return await self._try_messages(
            client, headers, base, model, system_prompt, user_prompt, max_tokens, on_progress
        )

    async def _remember_protocol(self, owner_id: str, proto: str) -> None:
        """Persist the working protocol so the next run tries it first.

        Best-effort: a bookkeeping failure must never fail a generation.
        """
        try:
            await get_collection("ai_configs").update_one(
                {"owner_id": owner_id}, {"$set": {"chat_protocol": proto}}
            )
        except Exception as e:
            logger.debug("Could not persist chat protocol: %s", e)

    async def _try_chat(
        self, client: "httpx.AsyncClient", headers: dict,
        url: str, model: str, system_prompt: str, user_prompt: str,
        max_tokens: int = 4000, on_progress=None,
    ) -> str:
        if on_progress:
            on_progress("Sending request (chat protocol)…")
        logger.info("AI request attempt chat model=%s url=%s", model, url)
        _t0 = time.monotonic()
        resp = await client.post(url, headers=headers, json={
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.4,
            "max_tokens": max_tokens
        })
        logger.info(
            "AI chat attempt done model=%s status=%s elapsed_ms=%d",
            model, resp.status_code, int((time.monotonic() - _t0) * 1000),
        )
        if resp.status_code == 200:
            data = self._unwrap(resp.json())
            return data["choices"][0]["message"]["content"]
        if resp.status_code == 404:
            # Some gateways (e.g. OpenModel) removed /v1/chat/completions.
            raise _TryNextProtocol(f"chat endpoint 404 at {url}")
        detail = resp.text[:300]
        raise RuntimeError(
            f"AI provider returned {resp.status_code} for {url} — "
            "check the Provider URL in Settings → AI Configuration. "
            f"Provider said: {detail}"
        )

    async def _try_responses(
        self, client: "httpx.AsyncClient", headers: dict,
        base: str, model: str, system_prompt: str, user_prompt: str,
        max_tokens: int = 4000, on_progress=None,
    ) -> str:
        """OpenAI Responses protocol (POST /v1/responses).

        Temperature is omitted on purpose — several served models only
        accept the default.
        """
        from urllib.parse import urlparse
        parts = urlparse(base if "://" in base else f"https://{base}")
        url = f"{parts.scheme or 'https'}://{parts.netloc}/v1/responses"
        if on_progress:
            on_progress("Sending request (Responses protocol)…")
        logger.info("AI request attempt responses model=%s url=%s", model, url)
        _t0 = time.monotonic()
        resp = await client.post(url, headers=headers, json={
            "model": model,
            "instructions": system_prompt,
            "input": user_prompt,
            "max_output_tokens": max_tokens,
        })
        logger.info(
            "AI responses attempt done model=%s status=%s elapsed_ms=%d",
            model, resp.status_code, int((time.monotonic() - _t0) * 1000),
        )
        if resp.status_code == 404 or (
            resp.status_code == 400
            and any(s in (resp.text or "").lower() for s in ("responses", "protocol", "channel"))
        ):
            # Model may only be served via the Messages protocol
            # (e.g. GLM/Zhipu models on OpenModel).
            raise _TryNextProtocol(f"responses endpoint unusable at {url}")
        if resp.status_code != 200:
            detail = resp.text[:300]
            raise RuntimeError(
                f"AI provider returned {resp.status_code} for {url} — "
                "check the Provider URL in Settings → AI Configuration. "
                f"Provider said: {detail}"
            )
        data = self._unwrap(resp.json())
        text = (data.get("output_text") or "").strip()
        if not text:
            blocks = []
            for item in data.get("output", []) or []:
                for block in item.get("content", []) or []:
                    if isinstance(block, dict) and block.get("type") == "output_text" and block.get("text"):
                        blocks.append(block["text"])
            text = "\n".join(blocks).strip()
        if not text:
            raise RuntimeError(
                f"AI provider returned an unexpected response shape for {url}."
            )
        return text

    async def _try_messages(
        self, client: "httpx.AsyncClient", headers: dict,
        base: str, model: str, system_prompt: str, user_prompt: str,
        max_tokens: int = 4000, on_progress=None,
    ) -> str:
        """Anthropic Messages protocol (POST /v1/messages).

        Used when the model is only served via the Messages protocol
        (e.g. GLM, DeepSeek, Kimi models on multi-protocol gateways).
        """
        from urllib.parse import urlparse
        parts = urlparse(base if "://" in base else f"https://{base}")
        url = f"{parts.scheme or 'https'}://{parts.netloc}/v1/messages"
        if on_progress:
            on_progress("Sending request (Messages protocol)…")
        logger.info("AI request attempt messages model=%s url=%s", model, url)
        _t0 = time.monotonic()
        resp = await client.post(url, headers=headers, json={
            "model": model,
            "max_tokens": max_tokens,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_prompt}],
        })
        logger.info(
            "AI messages attempt done model=%s status=%s elapsed_ms=%d",
            model, resp.status_code, int((time.monotonic() - _t0) * 1000),
        )
        if resp.status_code != 200:
            detail = resp.text[:300]
            raise RuntimeError(
                f"AI provider returned {resp.status_code} for {url} — "
                "check the Provider URL and Model Name in Settings → AI Configuration. "
                f"Provider said: {detail}"
            )
        data = self._unwrap(resp.json())
        content = data.get("content", [])
        if isinstance(content, str):
            text = content.strip()
        else:
            parts_out = []
            for block in content or []:
                if isinstance(block, dict) and block.get("text"):
                    parts_out.append(block["text"])
            text = "\n".join(parts_out).strip()
        if not text:
            raise RuntimeError(
                f"AI provider returned an unexpected response shape for {url}."
            )
        return text

    def _mock_generation(self, system_prompt: str, user_prompt: str, model: str) -> str:
        # Deterministic mock that shows we used context
        # Extract task title from user_prompt for realism
        title = "Generated Task"
        if "Title:" in user_prompt:
            try:
                title = user_prompt.split("Title:")[1].split("\n")[0].strip()[:80]
            except: pass
        return f"""# {title} — Engineered Task

## Objective
Improve and clarify the engineering task using available project context. This task was generated by the Smart Engineering Agent (model: {model}).

## Context
Based on project structure and `.brain` context observed. The agent inspected repository layout and relevant documentation to ground the task.

## Problem Statement
The original task description was rough and required elaboration with technical specifics and acceptance criteria.

## Technical Understanding
- Analyzed project top-level and structure sample from context builder
- Respectful of uncertainty where context is insufficient
- Ensures no fabricated architecture

## Architecture / Components
- Identify modules likely affected based on structure sample in context
- Use .brain decisions/rules if present

## Expected Behavior
- Provide clear deliverable as described in task objective

## Implementation Considerations
- Follow existing code conventions
- Handle filesystem safety and validation
- Keep changes isolated

## Acceptance Criteria
- [ ] Task objective and context clearly documented
- [ ] Implementation satisfies expected behavior
- [ ] No regressions introduced
- [ ] Tests added/updated

## Edge Cases
- Missing .brain information should be noted
- Large files or secrets must not be exposed

## Testing Requirements
- Unit tests for new behavior
- Manual verification

## Dependencies
- Project path and .brain availability

## Affected Files
- See structure sample in context

---
*Generated from prompt context (system prompt length: {len(system_prompt)} chars). Original prompt preview: {user_prompt[:300]}...*
"""
