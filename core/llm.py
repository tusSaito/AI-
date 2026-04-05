"""LLM loader and generation helper using HuggingFace Transformers."""
from __future__ import annotations

import os
import threading

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

DEFAULT_MODEL_ID = os.environ.get("GEMMA_MODEL_ID", "google/gemma-4-E4B-it")

_lock = threading.Lock()
_tokenizer = None
_model = None
_device = None


def _resolve_device() -> str:
    if torch.cuda.is_available():
        return "cuda"
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def load_model() -> tuple:
    """Lazy-load Gemma model & tokenizer (singleton)."""
    global _tokenizer, _model, _device
    with _lock:
        if _model is None:
            _device = _resolve_device()
            dtype = torch.float16 if _device in ("cuda", "mps") else torch.float32
            _tokenizer = AutoTokenizer.from_pretrained(
                DEFAULT_MODEL_ID, trust_remote_code=False
            )
            _model = AutoModelForCausalLM.from_pretrained(
                DEFAULT_MODEL_ID,
                torch_dtype=dtype,
                device_map=_device,
                trust_remote_code=False,
            )
            _model.eval()
    return _tokenizer, _model, _device


def generate(
    system: str,
    user: str,
    max_new_tokens: int = 512,
    temperature: float = 0.7,
) -> str:
    """Run a single-turn chat completion and return the assistant text."""
    max_new_tokens = max(16, min(max_new_tokens, 2048))
    temperature = max(0.0, min(float(temperature), 1.5))

    tokenizer, model, device = load_model()

    messages = [
        {"role": "user", "content": f"{system}\n\n---\n\n{user}"},
    ]

    prompt = tokenizer.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True
    )
    inputs = tokenizer(prompt, return_tensors="pt").to(device)

    with torch.inference_mode():
        output_ids = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            do_sample=temperature > 0.0,
            temperature=temperature if temperature > 0.0 else 1.0,
            top_p=0.9,
            pad_token_id=tokenizer.eos_token_id,
        )

    gen_ids = output_ids[0][inputs["input_ids"].shape[1]:]
    text = tokenizer.decode(gen_ids, skip_special_tokens=True).strip()
    return text
